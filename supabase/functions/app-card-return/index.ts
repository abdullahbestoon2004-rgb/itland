// app-card-return: where FIB's hosted card page sends the customer when they are done
// (redirectUrl, see cardReturnUrl in _shared/fib_card.ts). It sends the phone straight back into
// the app: 302 to itland://payment-return?card_payment=<orderId>. The app then asks
// app-payment-status; nothing here reads or writes a payment, and the link carries no authority.
//
// Deploy with JWT verification OFF (a browser follows the redirect, with no token):
//   supabase functions deploy app-card-return --no-verify-jwt

Deno.serve((req) => {
  const url = new URL(req.url);
  const order = url.searchParams.get("card_payment") ?? "";
  const target = new URL("itland://payment-return");
  if (/^[0-9a-f]{32}$/.test(order)) target.searchParams.set("card_payment", order);
  return new Response(
    "Payment finished. Return to the ITland app to see the result.",
    {
      status: 302,
      headers: {
        Location: target.toString(),
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
});
