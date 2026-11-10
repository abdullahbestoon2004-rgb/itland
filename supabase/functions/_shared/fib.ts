// Shared FIB (First Iraqi Bank) online-payment client for Edge Functions: the FIB app / QR product.
// Ported from the Tawaf project (Tawaf app/supabase/functions/_shared/fib.ts), same API calls and
// the same checks; only the secrets are read on first use, so a function that never pays by FIB
// still starts when they are missing.
// Credentials live in Edge Function secrets, NEVER in the apps:
//   supabase secrets set FIB_BASE_URL=https://fib.stage.fib.iq \
//     FIB_CLIENT_ID=... FIB_CLIENT_SECRET=...
// (production base URL: https://fib.prod.fib.iq, only with production credentials)

function requiredSecret(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

// Never silently fall back to FIB stage in a release build. Deployment must
// explicitly choose the stage or production endpoint through Edge secrets.
type FibConfig = { baseUrl: string; clientId: string; clientSecret: string };
let fibConfig: FibConfig | null = null;
function config(): FibConfig {
  fibConfig ??= {
    baseUrl: requiredSecret("FIB_BASE_URL").replace(/\/+$/, ""),
    clientId: requiredSecret("FIB_CLIENT_ID"),
    clientSecret: requiredSecret("FIB_CLIENT_SECRET"),
  };
  return fibConfig;
}

const fetchWithTimeout = (
  input: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> =>
  fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });

type CachedFibToken = {
  value: string;
  refreshAt: number;
};

let cachedFibToken: CachedFibToken | null = null;
let fibTokenPromise: Promise<string> | null = null;

async function requestFibToken(): Promise<string> {
  const res = await fetchWithTimeout(
    `${config().baseUrl}/auth/realms/fib-online-shop/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config().clientId,
        client_secret: config().clientSecret,
      }),
    },
    15_000,
  );
  if (!res.ok) throw new Error(`FIB auth failed: ${res.status}`);
  const json = await res.json();
  if (typeof json.access_token !== "string" || !json.access_token) {
    throw new Error("FIB auth response did not contain an access token");
  }
  const expiresInSeconds = Number(json.expires_in);
  const ttlMs = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
    ? expiresInSeconds * 1_000
    : 60_000;
  // Refresh before expiry, while still retaining at least a short useful
  // cache window for unusually small provider TTLs.
  const safetyMarginMs = Math.min(30_000, Math.max(1_000, ttlMs * 0.1));
  cachedFibToken = {
    value: json.access_token,
    refreshAt: Date.now() + Math.max(1_000, ttlMs - safetyMarginMs),
  };
  return json.access_token;
}

async function fibToken(): Promise<string> {
  if (cachedFibToken && cachedFibToken.refreshAt > Date.now()) {
    return cachedFibToken.value;
  }
  if (fibTokenPromise) return await fibTokenPromise;

  fibTokenPromise = requestFibToken();
  try {
    return await fibTokenPromise;
  } finally {
    fibTokenPromise = null;
  }
}

function invalidateFibToken(token: string): void {
  if (cachedFibToken?.value === token) cachedFibToken = null;
}

// Reuse one OAuth token across a reconciliation batch. If FIB invalidates it
// early, clear the cache and retry the authenticated request exactly once.
async function fibAuthorizedFetch(
  input: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> {
  let token = await fibToken();
  let response = await fetchWithTimeout(input, {
    ...init,
    headers: {
      ...Object.fromEntries(new Headers(init.headers).entries()),
      Authorization: `Bearer ${token}`,
    },
  }, timeoutMs);
  if (response.status !== 401) return response;

  invalidateFibToken(token);
  token = await fibToken();
  response = await fetchWithTimeout(input, {
    ...init,
    headers: {
      ...Object.fromEntries(new Headers(init.headers).entries()),
      Authorization: `Bearer ${token}`,
    },
  }, timeoutMs);
  return response;
}

export interface FibCreatedPayment {
  paymentId: string;
  readableCode: string;
  qrCode: string; // data URI
  validUntil: string;
  personalAppLink: string;
  businessAppLink: string;
  corporateAppLink: string;
}

export class FibCreatePaymentError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly definitiveRejection: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "FibCreatePaymentError";
  }
}

export class FibPaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FibPaymentValidationError";
  }
}

export async function fibCreatePayment(
  amountIqd: number,
  description: string,
  callbackUrl: string,
): Promise<FibCreatedPayment> {
  let res: Response;
  try {
    res = await fibAuthorizedFetch(
      `${config().baseUrl}/protected/v1/payments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          monetaryValue: { amount: String(amountIqd), currency: "IQD" },
          statusCallbackUrl: callbackUrl,
          description,
        }),
      },
      30_000,
    );
  } catch (cause) {
    // FIB has no create idempotency key. A network failure after sending the
    // POST cannot prove whether an external checkout now exists.
    throw new FibCreatePaymentError(
      "FIB create payment outcome is unknown",
      null,
      false,
      { cause },
    );
  }

  if (!res.ok) {
    throw new FibCreatePaymentError(
      `FIB create payment failed: ${res.status}`,
      res.status,
      res.status === 406,
    );
  }

  try {
    return await res.json();
  } catch (cause) {
    // A 2xx means FIB may have created the checkout even though its identifier
    // could not be decoded locally. Automatic retry could double-charge.
    throw new FibCreatePaymentError(
      "FIB created a payment but returned an unreadable response",
      res.status,
      false,
      { cause },
    );
  }
}

// The ONLY trusted way to learn a payment's outcome: ask FIB directly.
// Webhook bodies are treated as hints, never as truth.
export async function fibPaymentStatus(
  fibPaymentId: string,
  expectedAmountIqd: number,
): Promise<"PAID" | "UNPAID" | "DECLINED"> {
  const res = await fibAuthorizedFetch(
    `${config().baseUrl}/protected/v1/payments/${fibPaymentId}/status`,
    {},
    15_000,
  );
  if (!res.ok) throw new Error(`FIB status check failed: ${res.status}`);
  const json = await res.json();
  const returnedAmount = Number(json?.amount?.amount);
  if (json?.paymentId !== fibPaymentId) {
    throw new FibPaymentValidationError(
      "FIB status reference validation failed",
    );
  }
  if (json?.amount?.currency !== "IQD") {
    throw new FibPaymentValidationError(
      "FIB status currency validation failed",
    );
  }
  if (
    !Number.isSafeInteger(expectedAmountIqd) ||
    !Number.isSafeInteger(returnedAmount) ||
    returnedAmount !== expectedAmountIqd
  ) {
    throw new FibPaymentValidationError(
      "FIB status monetary value validation failed",
    );
  }
  if (!(["PAID", "UNPAID", "DECLINED"] as unknown[]).includes(json.status)) {
    throw new Error(
      `FIB returned an unknown payment status: ${String(json.status)}`,
    );
  }
  return json.status;
}

// Cancel only after an immediately preceding authoritative UNPAID check.
// Callers must re-check status if this request races or fails: a payment that
// became PAID must be applied and refunded where necessary, never cancelled.
export async function fibCancelPayment(fibPaymentId: string): Promise<void> {
  const res = await fibAuthorizedFetch(
    `${config().baseUrl}/protected/v1/payments/${fibPaymentId}/cancel`,
    {
      method: "POST",
    },
    15_000,
  );
  if (res.status !== 204) {
    throw new Error(`FIB cancel payment failed: ${res.status}`);
  }
}
