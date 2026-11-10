// fib-webhook: FIB's statusCallbackUrl for FIB app / QR payments (set by app-payment-start).
// FIB POSTs {"id": "<FIB paymentId>", "status": "..."} when a payment changes. The body is only a
// reference: settle() asks FIB's authenticated status endpoint before anything is written, so a
// forged callback can at most make us re-check a payment, which the worker does anyway.
//
// Replies: 202 when taken (also for a reference that is not ours, so FIB stops retrying it),
// 406 when the body names no payment, 500 when FIB could not be asked (FIB sends it again).
//
// Deploy with JWT verification OFF (FIB has no Supabase token):
//   supabase functions deploy fib-webhook --no-verify-jwt

import { corsHeaders, json, loadPayment, serviceClient, settle } from "../_shared/app_payments.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const reference = typeof body.id === "string" ? body.id.trim() : "";
    if (!reference || reference.length > 100) return json({ error: "missing payment reference" }, 406);

    const service = serviceClient();
    const payment = await loadPayment(service, "provider_reference", reference, "fib");
    if (!payment) return json({ ok: true, matched: false }, 202);

    const outcome = await settle(service, payment);
    if (outcome === "unreadable") return json({ error: "status unavailable" }, 500);
    return json({ ok: true }, 202);
  } catch (error) {
    console.error("fib-webhook:", error instanceof Error ? error.message : error);
    return json({ error: "internal error" }, 500);
  }
});
