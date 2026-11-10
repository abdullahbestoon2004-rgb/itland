// app-payment-start: opens (or resumes) the FIB or card checkout for one of the signed-in
// customer's orders. Same design as the Tawaf project's shop-fib-create-payment and
// shop-fib-card-create-payment, in one function: the order chose its gateway when it was placed
// (app_orders.pay = fib | card), so this only dispatches.
//
// The database decides everything that matters. start_app_payment() runs as the customer, so
// ownership, the method, the amount and "is it already paid" are settled there; nothing here
// trusts a number from the request.
//
// Request (functions.invoke, the customer's session): {"order_id": "ITL-30042"}
// Reply (200 unless the request itself is wrong):
//   {"status": "initiated", "payment_id", "method": "fib", "fib": {paymentId, readableCode, qrCode,
//       validUntil, personalAppLink, businessAppLink, corporateAppLink}}
//   {"status": "initiated", "payment_id", "method": "card", "card": {"redirect_url", "order_id"}}
//   {"status": "succeeded", "payment_id"}            paid already
//   {"status": "creating", "payment_id"}             another request is opening it: try again shortly
//   {"status": "failed" | "closed" | "unavailable", "reason"?}
//   400 {"error": "bad_request" | "order_not_found" | "not_online" | ...}, 401 {"error": "unauthorized"}
//
// Deploy with JWT verification on (the default).

import {
  corsHeaders,
  customerFrom,
  functionsBase,
  json,
  loadPayment,
  type PaymentRow,
  serviceClient,
  settle,
} from "../_shared/app_payments.ts";
import { type FibCreatedPayment, fibCreatePayment, FibCreatePaymentError } from "../_shared/fib.ts";
import { cardReturnUrl, FibCardError, initiateCardPayment } from "../_shared/fib_card.ts";

// Our own window for a card checkout (the gateway returns no validUntil), matching FIB's XTOKEN.
const CARD_WINDOW_MS = 30 * 60 * 1000;

// A checkout the sheet can render: without a code or a link there is nothing to scan or tap.
const hasUsableFib = (p: Record<string, unknown> | null): boolean =>
  !!p && [p.qrCode, p.readableCode, p.personalAppLink].some((v) => typeof v === "string" && v.trim() !== "");

const cardRedirect = (p: Record<string, unknown> | null): string =>
  typeof p?.redirect_url === "string" ? p.redirect_url.trim() : "";

const isPast = (value: string | null): boolean => {
  if (!value) return false;
  const t = Date.parse(value);
  return Number.isFinite(t) && t <= Date.now();
};

// FIB requires a card orderId unique per terminal and never reused: the attempt's own id is that.
const gatewayOrderId = (paymentId: string): string => paymentId.replace(/-/g, "").toLowerCase();

// The database's refusals that the app turns into words; anything else is internal.
const REFUSALS: Record<string, { status: string; http?: number }> = {
  already_paid: { status: "succeeded" },
  order_cancelled: { status: "closed" },
  pay_window_over: { status: "closed" },
  payment_unavailable: { status: "unavailable" },
  order_not_found: { status: "error", http: 400 },
  not_online: { status: "error", http: 400 },
  nothing_to_pay: { status: "error", http: 400 },
  sign_in_required: { status: "error", http: 401 },
};

function live(payment: PaymentRow): Response {
  if (payment.method === "fib") {
    return json({
      status: "initiated",
      payment_id: payment.id,
      method: "fib",
      fib: { ...payment.provider_payload, paymentId: payment.provider_reference },
    });
  }
  return json({
    status: "initiated",
    payment_id: payment.id,
    method: "card",
    card: { redirect_url: cardRedirect(payment.provider_payload), order_id: gatewayOrderId(payment.id) },
  });
}

async function handle(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
  if (!orderId || orderId.length > 40) return json({ error: "bad_request" }, 400);

  const caller = await customerFrom(req);
  if (!caller) return json({ error: "unauthorized" }, 401);
  const service = serviceClient();

  const start = async (): Promise<PaymentRow | Response> => {
    const { data, error } = await caller.asUser.rpc("start_app_payment", {
      p_order_id: orderId,
      p_idempotency_key: typeof body.idempotency_key === "string" ? body.idempotency_key : null,
    });
    if (error) {
      const code = error.message.trim();
      const refusal = REFUSALS[code];
      if (!refusal) throw new Error(code);
      return refusal.http
        ? json({ error: code }, refusal.http)
        : json({ status: refusal.status, reason: code });
    }
    const row = await loadPayment(service, "id", String(data));
    // The RPC ran as the caller; the row is read with the service key, so check again.
    if (!row || row.customer_id !== caller.user.id || row.order_id !== orderId) {
      throw new Error("payment ownership mismatch");
    }
    return row;
  };

  let started = await start();
  if (started instanceof Response) return started;
  let payment = started;

  // ── an attempt that already reached FIB: ask FIB before handing anything back ──
  if (payment.status === "succeeded") return json({ status: "succeeded", payment_id: payment.id });
  if (payment.provider_reference) {
    const outcome = await settle(service, payment);
    if (outcome === "succeeded") return json({ status: "succeeded", payment_id: payment.id });
    if (outcome === "unreadable") return json({ status: "creating", payment_id: payment.id });
    if (outcome === "pending") {
      const usable = payment.method === "fib"
        ? hasUsableFib(payment.provider_payload) && !isPast(payment.provider_expires_at)
        : cardRedirect(payment.provider_payload) !== "" && !isPast(payment.provider_expires_at);
      if (usable) return live(payment);
      // A live reference without its checkout details: never open a second checkout over it.
      return json({ status: "creating", payment_id: payment.id });
    }
    // That attempt is over (declined, expired, cancelled): open a fresh one.
    started = await start();
    if (started instanceof Response) return started;
    payment = started;
    if (payment.status === "succeeded") return json({ status: "succeeded", payment_id: payment.id });
    if (payment.provider_reference) return json({ status: "creating", payment_id: payment.id });
  }

  // ── open a new checkout at FIB: one winner only ──
  const { data: claimed, error: claimError } = await service.rpc("claim_app_payment_creation", {
    p_payment_id: payment.id,
  });
  if (claimError) throw new Error(claimError.message);
  if (claimed !== true) return json({ status: "creating", payment_id: payment.id });

  if (payment.method === "fib") {
    let created: FibCreatedPayment;
    try {
      created = await fibCreatePayment(
        Number(payment.amount_iqd),
        `ITland order ${orderId}`,
        `${functionsBase()}/fib-webhook`,
      );
    } catch (error) {
      if (error instanceof FibCreatePaymentError && error.definitiveRejection) {
        await service.rpc("record_app_payment_failure", { p_payment_id: payment.id, p_reason: error.message });
        return json({ status: "failed", payment_id: payment.id });
      }
      // Outcome unknown: the attempt stays open (the claim lapses after 2 minutes).
      console.error("app-payment-start fib create:", error instanceof Error ? error.message : error);
      return json({ status: "creating", payment_id: payment.id });
    }
    if (typeof created.paymentId !== "string" || !created.paymentId.trim()) {
      return json({ status: "creating", payment_id: payment.id });
    }
    const { error } = await service.rpc("record_app_payment_provider_details", {
      p_payment_id: payment.id,
      p_provider_reference: created.paymentId,
      p_provider_expires_at: created.validUntil,
      p_provider_payload: created as unknown as Record<string, unknown>,
    });
    if (error) throw new Error(error.message);
    const fresh = await loadPayment(service, "id", payment.id);
    if (!fresh || !hasUsableFib(fresh.provider_payload) || isPast(fresh.provider_expires_at)) {
      // Unusable or already closed: settle() cancels it at FIB after an authoritative UNPAID.
      if (fresh) await settle(service, { ...fresh, provider_expires_at: new Date(0).toISOString() });
      return json({ status: "failed", payment_id: payment.id });
    }
    return live(fresh);
  }

  // Card. Name and phone help FIB's own fraud checks; no card data ever reaches us.
  const { data: customer } = await service.from("app_customers").select("name, phone, email")
    .eq("id", caller.user.id).maybeSingle();
  const cardOrderId = gatewayOrderId(payment.id);
  try {
    const created = await initiateCardPayment({
      orderId: cardOrderId,
      amountIqd: Number(payment.amount_iqd),
      redirectUrl: cardReturnUrl(cardOrderId),
      callbackUrl: `${functionsBase()}/fib-card-callback`,
      clientInfo: {
        clientName: typeof customer?.name === "string" ? customer.name : undefined,
        mobilePhone: typeof customer?.phone === "string" ? customer.phone : undefined,
        email: typeof customer?.email === "string" ? customer.email : caller.user.email ?? undefined,
      },
    });
    const { error } = await service.rpc("record_app_payment_provider_details", {
      p_payment_id: payment.id,
      p_provider_reference: created.paymentId,
      p_provider_expires_at: new Date(Date.now() + CARD_WINDOW_MS).toISOString(),
      p_provider_payload: { gateway: "fib_card", order_id: cardOrderId, redirect_url: created.redirectUrl },
    });
    if (error) throw new Error(error.message);
    const fresh = await loadPayment(service, "id", payment.id);
    return fresh ? live(fresh) : json({ status: "creating", payment_id: payment.id });
  } catch (error) {
    if (error instanceof FibCardError && error.definitiveRejection) {
      await service.rpc("record_app_payment_failure", { p_payment_id: payment.id, p_reason: error.message });
      return json({ status: "failed", payment_id: payment.id });
    }
    // Unknown outcome: retrying here could open a second card order. Leave it to lapse.
    console.error("app-payment-start card initiate:", error instanceof Error ? error.message : error);
    return json({ status: "creating", payment_id: payment.id });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    return await handle(req);
  } catch (error) {
    console.error("app-payment-start:", error instanceof Error ? error.message : error);
    return json({ error: "internal error" }, 500);
  }
});
