// fib-card-callback: the FIB card gateway's callbackUrl (set by app-payment-start). The gateway
// POSTs a notification naming our orderId (top level, or inside paymentData). As with fib-webhook
// the body is only a hint: settle() reads the outcome from the gateway's signed status call.
//
// Replies follow the gateway's callback contract (as in the Tawaf project): 202 when taken, 406
// when it names nothing of ours, 500 when the outcome could not be read (it is sent again).
//
// Deploy with JWT verification OFF:
//   supabase functions deploy fib-card-callback --no-verify-jwt

import { corsHeaders, json, loadPayment, serviceClient, settle } from "../_shared/app_payments.ts";

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = text(body.orderId) || text(body.order_id) || text(body?.paymentData?.orderId);
    if (!/^[0-9a-f]{32}$/.test(orderId)) return json({ status: "unknown" }, 406);

    const service = serviceClient();
    const payment = await loadPayment(service, "card_order_id", orderId);
    if (!payment) return json({ status: "unknown" }, 406);

    const outcome = await settle(service, payment);
    if (outcome === "unreadable") return json({ status: "pending" }, 500);
    return json({ status: outcome }, 202);
  } catch (error) {
    console.error("fib-card-callback:", error instanceof Error ? error.message : error);
    return json({ error: "card payment check failed" }, 500);
  }
});
