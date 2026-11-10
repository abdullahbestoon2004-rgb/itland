// app-payment-status: the app asks how one of its own payments went. The answer is read from FIB
// (through settle()), never from anything the phone sends. The FIB and card sheets call this
// while they are open and when the customer comes back from the FIB app or the bank's card page.
//
// Request (the customer's session): {"payment_id": "<uuid>"} or {"order_id": "ITL-30042"} (the
// order's latest attempt).
// Reply 200: {"status": "succeeded" | "pending" | "failed" | "expired" | "cancelled",
//             "payment_id", "order_id", "order_paid": boolean}
//        400 bad_request, 401 unauthorized, 404 not_found.
//
// Deploy with JWT verification on (the default).

import {
  corsHeaders,
  customerFrom,
  json,
  loadPayment,
  PAYMENT_COLUMNS,
  type PaymentRow,
  serviceClient,
  settle,
} from "../_shared/app_payments.ts";

async function handle(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  const paymentId = typeof body.payment_id === "string" ? body.payment_id.trim() : "";
  const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
  if (!paymentId && !orderId) return json({ error: "bad_request" }, 400);
  if (paymentId && !/^[0-9a-f-]{36}$/i.test(paymentId)) return json({ error: "bad_request" }, 400);

  const caller = await customerFrom(req);
  if (!caller) return json({ error: "unauthorized" }, 401);
  const service = serviceClient();

  let payment: PaymentRow | null;
  if (paymentId) {
    payment = await loadPayment(service, "id", paymentId);
  } else {
    const { data, error } = await service.from("app_payments").select(PAYMENT_COLUMNS)
      .eq("order_id", orderId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    payment = (data as PaymentRow | null) ?? null;
  }
  // Someone else's payment reads as no payment at all.
  if (!payment || payment.customer_id !== caller.user.id) return json({ error: "not_found" }, 404);

  const outcome = await settle(service, payment);
  const { data: order } = await service.from("app_orders").select("payment_status").eq("id", payment.order_id)
    .maybeSingle();
  return json({
    status: outcome === "unreadable" ? "pending" : outcome,
    payment_id: payment.id,
    order_id: payment.order_id,
    order_paid: order?.payment_status === "paid",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    return await handle(req);
  } catch (error) {
    console.error("app-payment-status:", error instanceof Error ? error.message : error);
    return json({ error: "internal error" }, 500);
  }
});
