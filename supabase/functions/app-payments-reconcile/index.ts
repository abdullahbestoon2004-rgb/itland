// app-payments-reconcile: the scheduled safety net for both gateways (the Tawaf project's
// fib-reconcile-payments and fib-card-reconcile, in one). Callbacks settle most payments within
// seconds; this settles the rest: a callback that never arrived, a customer who paid and never
// came back to the app, a checkout whose time ran out. It asks FIB about every attempt still
// open, and about expired FIB attempts until FIB confirms they are cancelled. Nothing is closed as
// unpaid without FIB's answer.
//
// Called every minute by pg_cron through pg_net (app_private.invoke_payment_checks) with the
// header x-reconcile-key = the key the database generated in Vault (app_payments_reconcile_key,
// migration 20261110130000), plus the publishable key so the gateway lets it in. The key check below
// is the gate; the gateway's JWT setting does not matter.
//
// Reply 200: {"ok": true, "checked": n, "outcomes": {"succeeded": n, "pending": n, ...}}

import { json, type PaymentRow, sameSecret, serviceClient, settle } from "../_shared/app_payments.ts";

const BUDGET_MS = 45_000;
const MINUTE = 60 * 1000;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  // The key is the one the database generated in Vault (app_payment_checks_key_ok, migration
  // 20261110130000), or the Edge secret APP_PAYMENTS_RECONCILE_KEY when one is set.
  const given = req.headers.get("x-reconcile-key")?.trim() ?? "";
  if (given.length < 24) return json({ error: "unauthorized" }, 401);
  const started = Date.now();
  const service = serviceClient();
  const expected = Deno.env.get("APP_PAYMENTS_RECONCILE_KEY")?.trim() ?? "";
  let allowed = expected.length >= 24 && sameSecret(given, expected);
  if (!allowed) {
    const { data, error } = await service.rpc("app_payment_checks_key_ok", { p_key: given });
    allowed = !error && data === true;
  }
  if (!allowed) return json({ error: "unauthorized" }, 401);
  const outcomes: Record<string, number> = {};
  let checked = 0;
  try {
    while (Date.now() - started < BUDGET_MS) {
      const { data, error } = await service.rpc("claim_app_payment_checks", { p_limit: 20 });
      if (error) throw new Error(error.message);
      const due = (data ?? []) as PaymentRow[];
      if (due.length === 0) break;
      for (const payment of due) {
        if (Date.now() - started >= BUDGET_MS) break;
        let outcome: string;
        try {
          outcome = await settle(service, payment);
        } catch (e) {
          console.error("reconcile:", payment.id, e instanceof Error ? e.message : e);
          outcome = "failed_to_settle";
        }
        checked++;
        outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
        // claim_app_payment_checks leased it for 2 minutes. FIB unreadable: wait longer. An
        // expired FIB attempt FIB did not confirm cancelled yet: every 15 minutes.
        if (outcome === "unreadable" || outcome === "failed_to_settle" || payment.status !== "initiated") {
          const wait = outcome === "unreadable" || outcome === "failed_to_settle" ? 5 * MINUTE : 15 * MINUTE;
          await service.rpc("note_app_payment_check", {
            p_payment_id: payment.id,
            p_next_check_at: new Date(Date.now() + wait).toISOString(),
            p_note: {},
          });
        }
      }
    }
    // Orders whose time to pay is over, now that their attempts are settled.
    await service.rpc("cancel_unpaid_app_orders");
    return json({ ok: true, checked, outcomes });
  } catch (error) {
    console.error("app-payments-reconcile:", error instanceof Error ? error.message : error);
    return json({ ok: false, checked, outcomes, error: "internal error" }, 500);
  }
});
