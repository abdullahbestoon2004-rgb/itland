// Runs the FIB clients and settle() against a local mock of both FIB products (the FIB app / QR
// API and the HMAC-signed card gateway) and a fake database client that records which payment
// functions were called. No network beyond localhost, no real credentials.
//
//   deno test --allow-net --allow-env supabase/functions/_shared/app_payments_test.ts
// (from ../itland; add --config with {"nodeModulesDir":"none"} when the website's node_modules
// are in the way)

import { assert, assertEquals } from "jsr:@std/assert@1.0.13";

const HMAC = "test-hmac-secret";
const fibPayments = new Map<string, { status: string; amount: number; currency: string; cancelled?: boolean }>();
const cardPayments = new Map<string, { orderId: string; amount: number; status: string; returnCode: string; errorCode: string }>();
const seen: string[] = [];

async function hmacHex(body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(HMAC), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const server = Deno.serve({ port: 0, onListen: () => {} }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  seen.push(`${req.method} ${path}`);
  // FIB app / QR
  if (path === "/auth/realms/fib-online-shop/protocol/openid-connect/token") {
    const form = new URLSearchParams(await req.text());
    if (form.get("client_secret") !== "fib-secret") return new Response("no", { status: 401 });
    return Response.json({ access_token: "fib-token", expires_in: 300 });
  }
  if (path.startsWith("/protected/") && req.headers.get("Authorization") !== "Bearer fib-token") {
    return new Response("no", { status: 401 });
  }
  if (path === "/protected/v1/payments" && req.method === "POST") {
    const b = await req.json();
    const id = crypto.randomUUID();
    fibPayments.set(id, { status: "UNPAID", amount: Number(b.monetaryValue.amount), currency: b.monetaryValue.currency });
    return Response.json({
      paymentId: id,
      readableCode: "ITL1-TEST-CODE",
      qrCode: "data:image/png;base64,iVBORw0KGgo=",
      validUntil: new Date(Date.now() + 15 * 60_000).toISOString(),
      personalAppLink: `https://personal.fib.iq/pay/${id}`,
      businessAppLink: "",
      corporateAppLink: "",
    }, { status: 201 });
  }
  let m = path.match(/^\/protected\/v1\/payments\/([^/]+)\/status$/);
  if (m) {
    const p = fibPayments.get(m[1]);
    if (!p) return new Response("missing", { status: 404 });
    return Response.json({ paymentId: m[1], status: p.status, amount: { amount: p.amount, currency: p.currency } });
  }
  m = path.match(/^\/protected\/v1\/payments\/([^/]+)\/cancel$/);
  if (m) {
    const p = fibPayments.get(m[1]);
    if (!p || p.status !== "UNPAID") return new Response("no", { status: 406 });
    p.cancelled = true;
    p.status = "DECLINED";
    return new Response(null, { status: 204 });
  }
  // Card gateway: every request is HMAC-signed over its exact body.
  if (path.startsWith("/ACS24/")) {
    const body = await req.text();
    if (req.headers.get("X-HMAC") !== await hmacHex(body)) return new Response("bad hmac", { status: 401 });
    const b = JSON.parse(body);
    if (path === "/ACS24/api/v1/auth/token") {
      assert(/^\d\d\/\d\d\/\d{4} \d\d:\d\d:\d\d$/.test(b.dateTime), "dateTime format");
      return Response.json({ accessToken: `card-token-${b.orderId}` });
    }
    if (!req.headers.get("Authorization")?.startsWith("Bearer card-token-")) return new Response("no", { status: 401 });
    if (path === "/ACS24/api/v1/payment/initiate") {
      assertEquals(b.recurringFlag, "F");
      const id = `cp-${b.orderId}`;
      cardPayments.set(id, { orderId: b.orderId, amount: Number(b.amount), status: "PENDING", returnCode: "", errorCode: "" });
      return Response.json({ paymentId: id, redirectUrl: `https://uat.example/pay/${id}` });
    }
    if (path === "/ACS24/api/v1/payments/status") {
      const p = cardPayments.get(b.paymentId);
      if (!p) return new Response("missing", { status: 404 });
      return Response.json({
        errorCode: p.errorCode,
        description: p.status === "FAILED" ? "Insufficient funds" : null,
        paymentData: { paymentId: b.paymentId, orderId: p.orderId, currency: "IQD", amount: String(p.amount), status: p.status, returnCode: p.returnCode, reference: "R1", authorizationCode: "A1" },
      });
    }
  }
  return new Response("not found", { status: 404 });
});
const base = `http://localhost:${server.addr.port}`;

Deno.env.set("FIB_BASE_URL", base);
Deno.env.set("FIB_CLIENT_ID", "fib-client");
Deno.env.set("FIB_CLIENT_SECRET", "fib-secret");
Deno.env.set("FIB_CARD_BASE_URL", `${base}/ACS24`);
Deno.env.set("FIB_CARD_TERMINAL_NUMBER", "T1");
Deno.env.set("FIB_CARD_INSTITUTION", "I1");
Deno.env.set("FIB_CARD_MERCHANT_ID", "M1");
Deno.env.set("FIB_CARD_ACQUIRER", "A1");
Deno.env.set("FIB_CARD_HMAC_SECRET", HMAC);
Deno.env.set("SUPABASE_URL", "https://example.supabase.co");

const { settle } = await import("./app_payments.ts");
const { fibCreatePayment } = await import("./fib.ts");
const { initiateCardPayment, cardReturnUrl } = await import("./fib_card.ts");
type PaymentRow = import("./app_payments.ts").PaymentRow;

// A fake service client: records rpc calls and answers the order lookup.
function fakeDb(order: { special: string | null; payment_status: string } = { special: null, payment_status: "unpaid" }) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const updates: Record<string, unknown>[] = [];
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const k of ["select", "eq", "in", "is", "not", "order", "limit"]) c[k] = () => c;
    c.maybeSingle = () => Promise.resolve({ data: result, error: null });
    return c;
  };
  const db = {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return Promise.resolve({ data: null, error: null });
    },
    from: (_table: string) => ({
      ...chain(order),
      update: (v: Record<string, unknown>) => {
        updates.push(v);
        return { eq: () => Promise.resolve({ data: null, error: null }) };
      },
    }),
  };
  // deno-lint-ignore no-explicit-any
  return { db: db as any, calls, updates };
}

function row(over: Partial<PaymentRow>): PaymentRow {
  return {
    id: "8f2c7a10-0000-4000-8000-000000000001",
    order_id: "ITL-30001",
    customer_id: "u1",
    amount_iqd: 177000,
    method: "fib",
    status: "initiated",
    provider_reference: null,
    provider_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    provider_payload: {},
    provider_creation_started_at: null,
    provider_terminal_at: null,
    created_at: new Date().toISOString(),
    ...over,
  };
}

Deno.test("FIB: create, then PAID is recorded as success", async () => {
  const created = await fibCreatePayment(177000, "ITland order ITL-30001", "https://example/fib-webhook");
  assertEquals(created.readableCode, "ITL1-TEST-CODE");
  const { db, calls } = fakeDb();
  const p = row({ provider_reference: created.paymentId });
  assertEquals(await settle(db, p), "pending");
  assertEquals(calls.length, 0);
  fibPayments.get(created.paymentId)!.status = "PAID";
  assertEquals(await settle(db, p), "succeeded");
  assertEquals(calls.map((c) => c.name), ["record_app_payment_success"]);
});

Deno.test("FIB: DECLINED is recorded as a failure", async () => {
  const created = await fibCreatePayment(5000, "x", "https://example/cb");
  fibPayments.get(created.paymentId)!.status = "DECLINED";
  const { db, calls } = fakeDb();
  assertEquals(await settle(db, row({ provider_reference: created.paymentId, amount_iqd: 5000 })), "failed");
  assertEquals(calls.map((c) => c.name), ["record_app_payment_failure"]);
});

Deno.test("FIB: an UNPAID checkout past its time is expired and cancelled at FIB", async () => {
  const created = await fibCreatePayment(5000, "x", "https://example/cb");
  const { db, calls } = fakeDb();
  const p = row({ provider_reference: created.paymentId, amount_iqd: 5000, provider_expires_at: new Date(Date.now() - 1000).toISOString() });
  assertEquals(await settle(db, p), "expired");
  assertEquals(calls.map((c) => c.name), ["expire_app_payment", "record_app_payment_cancelled"]);
  assert(fibPayments.get(created.paymentId)!.cancelled);
});

Deno.test("FIB: an UNPAID checkout for a cancelled order is cancelled at FIB", async () => {
  const created = await fibCreatePayment(5000, "x", "https://example/cb");
  const { db, calls } = fakeDb({ special: "cancelled", payment_status: "unpaid" });
  assertEquals(await settle(db, row({ provider_reference: created.paymentId, amount_iqd: 5000 })), "cancelled");
  assertEquals(calls.map((c) => c.name), ["record_app_payment_cancelled"]);
});

Deno.test("FIB: a status with the wrong amount is never believed", async () => {
  const created = await fibCreatePayment(5000, "x", "https://example/cb");
  fibPayments.get(created.paymentId)!.status = "PAID";
  const { db, calls } = fakeDb();
  assertEquals(await settle(db, row({ provider_reference: created.paymentId, amount_iqd: 6000 })), "unreadable");
  assertEquals(calls.length, 0);
});

Deno.test("Card: signed initiate, ERROR stays pending, SUCCESS 000/000 is paid", async () => {
  const orderId = "8f2c7a10000040008000000000000002";
  assertEquals(cardReturnUrl(orderId), `https://example.supabase.co/functions/v1/app-card-return?card_payment=${orderId}`);
  const created = await initiateCardPayment({ orderId, amountIqd: 177000, redirectUrl: cardReturnUrl(orderId), callbackUrl: "https://example/cb" });
  assert(created.redirectUrl.startsWith("https://"));
  const p = row({ method: "card", provider_reference: created.paymentId, provider_payload: { order_id: orderId, redirect_url: created.redirectUrl } });
  cardPayments.get(created.paymentId)!.status = "ERROR";
  const first = fakeDb();
  assertEquals(await settle(first.db, p), "pending");
  assertEquals(first.calls.map((c) => c.name), ["note_app_payment_check"]);
  Object.assign(cardPayments.get(created.paymentId)!, { status: "SUCCESS", errorCode: "000", returnCode: "000" });
  const second = fakeDb();
  assertEquals(await settle(second.db, p), "succeeded");
  assertEquals(second.calls.map((c) => c.name), ["record_app_payment_success"]);
  assertEquals((second.updates[0].provider_payload as Record<string, unknown>).authorization_code, "A1");
});

Deno.test("Card: a declined card fails; an abandoned page expires after its window and grace", async () => {
  const orderId = "8f2c7a10000040008000000000000003";
  const created = await initiateCardPayment({ orderId, amountIqd: 5000, redirectUrl: cardReturnUrl(orderId), callbackUrl: "https://example/cb" });
  const p = row({ method: "card", amount_iqd: 5000, provider_reference: created.paymentId, provider_payload: { order_id: orderId } });
  const stale = { ...p, provider_expires_at: new Date(Date.now() - 6 * 60_000).toISOString() };
  const a = fakeDb();
  assertEquals(await settle(a.db, stale), "expired");
  assertEquals(a.calls.map((c) => c.name), ["expire_app_payment"]);
  cardPayments.get(created.paymentId)!.status = "FAILED";
  const b = fakeDb();
  assertEquals(await settle(b.db, p), "failed");
  assertEquals(b.calls.map((c) => c.name), ["record_app_payment_failure"]);
});

Deno.test("Settled rows are not asked about again", async () => {
  const { db, calls } = fakeDb();
  assertEquals(await settle(db, row({ status: "succeeded", provider_reference: "x" })), "succeeded");
  assertEquals(await settle(db, row({ status: "failed", provider_reference: "x", provider_terminal_at: new Date().toISOString() })), "failed");
  assertEquals(await settle(db, row({ provider_reference: null })), "pending");
  assertEquals(calls.length, 0);
});

Deno.test({ name: "stop the mock FIB server", sanitizeResources: false, fn: async () => { await server.shutdown(); } });
