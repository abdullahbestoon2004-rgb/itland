// FIB card gateway ("XPI Payment Gateway") client for Edge Functions.
// Ported from the Tawaf project (Tawaf app/supabase/functions/_shared/fib_card.ts): same signing,
// same calls, same reading of the status. Secrets are read on first use.
//
// This is a DIFFERENT FIB product from the one in ./fib.ts. That one is the
// FIB app / QR flow (OAuth client-credentials against /protected/v1/payments).
// This one is the redirect-based card gateway: the customer is sent to a
// FIB-hosted 3-D Secure page, and our servers never see card data.
//
// Credentials live in Edge Function secrets, NEVER in the apps:
//   supabase secrets set \
//     FIB_CARD_BASE_URL=https://uatswitch.fib.iq/ACS24 \
//     FIB_CARD_TERMINAL_NUMBER=... FIB_CARD_INSTITUTION=... \
//     FIB_CARD_MERCHANT_ID=... FIB_CARD_ACQUIRER=... \
//     FIB_CARD_HMAC_SECRET=...
//
// The /ACS24 path prefix is part of the base URL; requests fail without it.
// Production uses https://prodswitch.fib.iq/ACS24 with the matching Production
// terminal credentials from the merchant portal. Do not mix UAT and live values.

function requiredSecret(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

type CardConfig = {
  baseUrl: string;
  terminalNumber: string;
  institution: string;
  merchantId: string;
  acquirer: string;
  hmacSecret: string;
};
let cardConfig: CardConfig | null = null;
function config(): CardConfig {
  cardConfig ??= {
    baseUrl: requiredSecret("FIB_CARD_BASE_URL").replace(/\/+$/, ""),
    terminalNumber: requiredSecret("FIB_CARD_TERMINAL_NUMBER"),
    institution: requiredSecret("FIB_CARD_INSTITUTION"),
    merchantId: requiredSecret("FIB_CARD_MERCHANT_ID"),
    acquirer: requiredSecret("FIB_CARD_ACQUIRER"),
    hmacSecret: requiredSecret("FIB_CARD_HMAC_SECRET"),
  };
  return cardConfig;
}

// The gateway rejects a token request whose dateTime it considers invalid.
// FIB is an Iraqi acquirer and its own sample client stamps local time, so
// Baghdad is the default; override if FIB says the terminal expects UTC.
const DATETIME_TIMEZONE = Deno.env.get("FIB_CARD_DATETIME_TZ")?.trim() ||
  "Asia/Baghdad";

const CURRENCY = "IQD";

// Our checkout window matches FIB's XTOKEN lifetime, so after it the hosted
// page can no longer be paid. A payment submitted in its last seconds can
// still be settling at FIB, though, so nothing is closed as unpaid until this
// much later.
export const CARD_EXPIRY_GRACE_MS = 5 * 60 * 1000;

export function checkoutWindowClosed(
  expiresAt: string | null,
  now: number = Date.now(),
): boolean {
  if (!expiresAt) return false;
  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) && timestamp + CARD_EXPIRY_GRACE_MS <= now;
}

// Where FIB sends the customer when its hosted page is done: app-card-return, which sends the
// phone straight back into the app (itland://payment-return?card_payment=<orderId>), where the
// payment's real result is read from the server. FIB_CARD_RETURN_URL moves it elsewhere (an https
// page of the website, say); card_payment=<orderId> is added to whichever it is.
export function cardReturnUrl(orderId: string): string {
  const configured = Deno.env.get("FIB_CARD_RETURN_URL")?.trim();
  const fallback = `${(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "")}/functions/v1/app-card-return`;
  let url: URL;
  try {
    url = new URL(configured || fallback);
  } catch {
    url = new URL(fallback);
  }
  url.searchParams.set("card_payment", orderId);
  return url.toString();
}

export class FibCardError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    // True when FIB has definitively refused this attempt, so replacing it
    // with a fresh one cannot double-charge. False means the outcome is
    // unknown and the attempt must be reconciled, never blindly retried.
    readonly definitiveRejection: boolean,
    options?: ErrorOptions,
  ) {
    super(message);
    this.name = "FibCardError";
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

const fetchWithTimeout = (
  input: string,
  init: RequestInit = {},
  timeoutMs = 20_000,
): Promise<Response> =>
  fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });

// Exactly the ordering FIB's own reference client uses: keys sorted
// case-insensitively, applied recursively to nested objects but NOT into
// arrays, then JSON.stringify'd. Sign that string, and send that same string
// as the body so the signature and the bytes on the wire cannot drift apart.
export function canonicalBody(value: unknown): string {
  return JSON.stringify(orderKeys(value));
}

function orderKeys(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const source = value as Record<string, unknown>;
  const ordered: Record<string, unknown> = {};
  for (
    const key of Object.keys(source).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    )
  ) {
    const entry = source[key];
    ordered[key] =
      typeof entry === "object" && entry !== null && !Array.isArray(entry)
        ? orderKeys(entry)
        : entry;
  }
  return ordered;
}

let hmacKey: CryptoKey | null = null;

async function signature(payload: string): Promise<string> {
  hmacKey ??= await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(config().hmacSecret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    hmacKey,
    new TextEncoder().encode(payload),
  );
  return Array.from(new Uint8Array(signed))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// dd/MM/yyyy HH:mm:ss, 24-hour, in the terminal's timezone.
export function gatewayDateTime(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DATETIME_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "00";
  return `${part("day")}/${part("month")}/${part("year")} ` +
    `${part("hour")}:${part("minute")}:${part("second")}`;
}

async function postSigned(
  path: string,
  body: Record<string, unknown>,
  accessToken?: string,
): Promise<Response> {
  const payload = canonicalBody(body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-HMAC": await signature(payload),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return await fetchWithTimeout(`${config().baseUrl}${path}`, {
    method: "POST",
    headers,
    body: payload,
  });
}

// Every access token is bound to ONE orderId and expires in minutes, so it is
// minted per call rather than cached: mint -> initiate, then mint -> status.
export async function mintAccessToken(orderId: string): Promise<string> {
  let res: Response;
  try {
    res = await postSigned("/api/v1/auth/token", {
      dateTime: gatewayDateTime(),
      orderId,
      terminalNumber: config().terminalNumber,
      institution: config().institution,
      merchantId: config().merchantId,
      acquirer: config().acquirer,
    });
  } catch (cause) {
    throw new FibCardError("FIB card auth is unreachable", null, false, {
      cause,
    });
  }
  if (!res.ok) {
    // 4xx here is a rejected handshake: no payment can have been created by it.
    throw new FibCardError(
      `FIB card auth failed: ${res.status}`,
      res.status,
      res.status >= 400 && res.status < 500,
    );
  }
  const json = await res.json().catch(() => null);
  const token = json?.accessToken;
  if (typeof token !== "string" || !token) {
    throw new FibCardError(
      "FIB card auth response did not contain an access token",
      res.status,
      true,
    );
  }
  return token;
}

export interface FibCardClientInfo {
  clientName?: string;
  mobilePhone?: string;
  email?: string;
}

export interface FibCardInitiated {
  paymentId: string;
  redirectUrl: string;
}

export async function initiateCardPayment(options: {
  orderId: string;
  amountIqd: number;
  redirectUrl: string;
  callbackUrl: string;
  clientInfo?: FibCardClientInfo;
}): Promise<FibCardInitiated> {
  if (!Number.isSafeInteger(options.amountIqd) || options.amountIqd <= 0) {
    throw new FibCardError("invalid card payment amount", null, true);
  }
  const token = await mintAccessToken(options.orderId);

  const body: Record<string, unknown> = {
    amount: String(options.amountIqd),
    currency: CURRENCY,
    orderId: options.orderId,
    redirectUrl: options.redirectUrl,
    callbackUrl: options.callbackUrl,
    // ITland charges an order once. Stored-card / recurring is a separate
    // product decision and would need a vault and a token lifecycle.
    recurringFlag: "F",
  };
  const info = options.clientInfo ?? {};
  const clientInfo: Record<string, string> = {};
  if (info.clientName) clientInfo.clientName = info.clientName;
  if (info.mobilePhone) clientInfo.mobilePhone = info.mobilePhone;
  if (info.email) clientInfo.email = info.email;
  if (Object.keys(clientInfo).length > 0) body.clientInfo = clientInfo;

  let res: Response;
  try {
    res = await postSigned("/api/v1/payment/initiate", body, token);
  } catch (cause) {
    // The POST may have reached FIB. Never auto-retry this into a second
    // checkout — reconcile the attempt by orderId instead.
    throw new FibCardError(
      "FIB card initiate outcome is unknown",
      null,
      false,
      { cause },
    );
  }

  if (!res.ok) {
    // 403 "Order id already processed" means this orderId is spent. That is
    // definitive for this attempt: a new attempt needs a new orderId.
    throw new FibCardError(
      `FIB card initiate failed: ${res.status}`,
      res.status,
      res.status === 400 || res.status === 403 || res.status === 404,
    );
  }

  const json = await res.json().catch(() => null);
  const paymentId = json?.paymentId;
  const redirect = json?.redirectUrl;
  if (
    typeof paymentId !== "string" || !paymentId ||
    typeof redirect !== "string" || !redirect
  ) {
    // A 2xx without a usable checkout still means FIB may hold a payment
    // against this orderId, so this is not a safe-to-replace rejection.
    throw new FibCardError(
      "FIB card initiate returned no usable checkout",
      res.status,
      false,
      { cause: json },
    );
  }
  return { paymentId, redirectUrl: redirect };
}

export type FibCardOutcome = "PAID" | "PENDING" | "DECLINED";

export interface FibCardStatus {
  outcome: FibCardOutcome;
  reference: string | null;
  authorizationCode: string | null;
  rawStatus: string;
  description: string | null;
  // Kept alongside rawStatus because `status` alone cannot separate a payment
  // in flight from one the bank denied — both read ERROR.
  errorCode: string;
  returnCode: string;
}

// The only trusted source of a card payment's outcome. Callback bodies are
// hints; this is what the database is allowed to act on.
export async function cardPaymentStatus(options: {
  orderId: string;
  paymentId: string;
  expectedAmountIqd: number;
}): Promise<FibCardStatus> {
  const token = await mintAccessToken(options.orderId);
  const res = await postSigned("/api/v1/payments/status", {
    paymentId: options.paymentId,
    orderId: options.orderId,
  }, token);
  if (!res.ok) {
    throw new FibCardError(
      `FIB card status check failed: ${res.status}`,
      res.status,
      false,
    );
  }
  const json = await res.json().catch(() => null);
  const data = json?.paymentData;
  if (!data || typeof data !== "object") {
    throw new FibCardError(
      "FIB card status returned no payment data",
      res.status,
      false,
    );
  }

  // Bind the answer to the payment we asked about before believing any of it.
  if (String(data.paymentId ?? "") !== options.paymentId) {
    throw new FibCardError(
      "FIB card status payment reference validation failed",
      res.status,
      false,
    );
  }
  if (String(data.orderId ?? "") !== options.orderId) {
    throw new FibCardError(
      "FIB card status order reference validation failed",
      res.status,
      false,
    );
  }
  if (String(data.currency ?? "") !== CURRENCY) {
    throw new FibCardError(
      "FIB card status currency validation failed",
      res.status,
      false,
    );
  }
  const returnedAmount = Number(String(data.amount ?? ""));
  if (
    !Number.isSafeInteger(options.expectedAmountIqd) ||
    !Number.isSafeInteger(returnedAmount) ||
    returnedAmount !== options.expectedAmountIqd
  ) {
    throw new FibCardError(
      "FIB card status monetary value validation failed",
      res.status,
      false,
    );
  }

  const rawStatus = String(data.status ?? "").toUpperCase();
  const errorCode = String(json.errorCode ?? "");
  const returnCode = String(data.returnCode ?? "");
  const description = typeof json.description === "string"
    ? json.description
    : null;

  let outcome: FibCardOutcome;
  if (rawStatus === "SUCCESS" && errorCode === "000" && returnCode === "000") {
    outcome = "PAID";
  } else if (
    rawStatus === "PENDING" || rawStatus === "" || rawStatus === "ERROR"
  ) {
    // An empty status is "no outcome yet", not a decline. Treating it as a
    // decline would release the seat while the customer is still on the 3-D
    // Secure page.
    //
    // ERROR is the same thing, and this was measured rather than assumed:
    // against FIB UAT on 2026-09-14 a checkout read PENDING while its hosted
    // page had never been opened, and ERROR from the moment it was opened —
    // with nothing typed into the card form at all. ERROR is therefore the
    // normal state of a payment the customer is still in the middle of, and
    // every customer passes through it. Failing on it killed live checkouts:
    // the sheet's "check again" button would mark a payment declined while
    // the customer was still making it.
    //
    // The cost of this reading: a genuinely declined card also reports ERROR,
    // so it is no longer failed fast. It stays pending until the checkout
    // window lapses, and the expiry path retires it. Slower, but it can only
    // delay a retry — where the old reading destroyed payments in flight.
    outcome = "PENDING";
  } else {
    outcome = "DECLINED";
  }

  return {
    outcome,
    reference: typeof data.reference === "string" && data.reference
      ? data.reference
      : null,
    authorizationCode:
      typeof data.authorizationCode === "string" && data.authorizationCode
        ? data.authorizationCode
        : null,
    rawStatus: rawStatus || "UNKNOWN",
    description,
    errorCode,
    returnCode,
  };
}
