// What every ITland payment function shares: the Supabase clients, the app_payments row, and
// `settle()`, the one place an attempt is moved on from what FIB says.
//
// The rule, as in the Tawaf project: whatever reaches us (an FIB callback, the app asking, the
// worker's schedule) is a HINT that a payment may have moved. The outcome is always read from
// FIB's own status endpoint, and only the database's service-role functions write it:
//   record_app_payment_success / _failure / expire_app_payment / record_app_payment_cancelled.

import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.45.4";
import { fibCancelPayment, fibPaymentStatus } from "./fib.ts";
import { cardPaymentStatus, checkoutWindowClosed } from "./fib_card.ts";

export type PaymentStatus = "initiated" | "succeeded" | "failed" | "expired" | "cancelled";

export type PaymentRow = {
  id: string;
  order_id: string;
  customer_id: string | null;
  amount_iqd: number;
  method: "fib" | "card";
  status: PaymentStatus;
  provider_reference: string | null;
  provider_expires_at: string | null;
  provider_payload: Record<string, unknown> | null;
  provider_creation_started_at: string | null;
  provider_terminal_at: string | null;
  created_at: string;
};

export const PAYMENT_COLUMNS =
  "id, order_id, customer_id, amount_iqd, method, status, provider_reference, provider_expires_at, provider_payload, provider_creation_started_at, provider_terminal_at, created_at";

// What the app is told. `pending`: FIB has no final answer yet (or could not be read: the
// softer, recoverable thing to say; a decline and a payment in flight look alike from here).
export type Outcome = "succeeded" | "failed" | "expired" | "cancelled" | "pending";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

function env(name: string): string {
  const v = Deno.env.get(name)?.trim();
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

export function supabaseUrl(): string {
  return env("SUPABASE_URL").replace(/\/+$/, "");
}

export function functionsBase(): string {
  return `${supabaseUrl()}/functions/v1`;
}

// The project's keys: the legacy anon / service_role variables when they exist, else the first of
// the new SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS (JSON {"default": "sb_..."}) that the
// Edge runtime provides.
function projectKey(legacy: string, modern: string): string {
  const value = Deno.env.get(legacy)?.trim();
  if (value) return value;
  try {
    const keys = JSON.parse(Deno.env.get(modern) ?? "{}") as Record<string, string>;
    const first = keys.default ?? Object.values(keys)[0];
    if (typeof first === "string" && first) return first;
  } catch {
    // not JSON: treated as missing
  }
  throw new Error(`${legacy} / ${modern} is not configured`);
}

export function serviceClient(): SupabaseClient {
  return createClient(supabaseUrl(), projectKey("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// The signed-in customer behind the request, and a client that acts as them (so RLS and the
// database's own checks apply). Null when the token is missing or not valid.
export async function customerFrom(
  req: Request,
): Promise<{ asUser: SupabaseClient; user: User } | null> {
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization) return null;
  const asUser = createClient(supabaseUrl(), projectKey("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS"), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data?.user || data.user.is_anonymous) return null;
  return { asUser, user: data.user };
}

export async function loadPayment(
  service: SupabaseClient,
  column: "id" | "provider_reference" | "card_order_id",
  value: string,
  method?: "fib" | "card",
): Promise<PaymentRow | null> {
  let query = service.from("app_payments").select(PAYMENT_COLUMNS);
  query = column === "card_order_id"
    ? query.eq("provider_payload->>order_id", value).eq("method", "card")
    : query.eq(column, value);
  if (method) query = query.eq("method", method);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PaymentRow | null) ?? null;
}

async function rpc(service: SupabaseClient, name: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await service.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
}

const isPast = (value: string | null): boolean => {
  if (!value) return false;
  const t = Date.parse(value);
  return Number.isFinite(t) && t <= Date.now();
};

async function orderClosed(service: SupabaseClient, orderId: string): Promise<boolean> {
  const { data } = await service.from("app_orders").select("special, payment_status").eq("id", orderId)
    .maybeSingle();
  return data?.special === "cancelled" || data?.payment_status === "paid";
}

// Reads one attempt's outcome from FIB and records it. Returns what the app should be told, or
// "unreadable" when FIB could not be asked (nothing was written; ask again later).
export async function settle(
  service: SupabaseClient,
  payment: PaymentRow,
): Promise<Outcome | "unreadable"> {
  if (payment.status === "succeeded") return "succeeded";
  const finished = payment.status !== "initiated";
  if (!payment.provider_reference) {
    // Nothing was ever created at FIB for this row: there is no outcome to read.
    return finished ? payment.status as Outcome : "pending";
  }
  if (finished && payment.provider_terminal_at) return payment.status as Outcome;

  return payment.method === "fib"
    ? await settleFib(service, payment, payment.provider_reference)
    : await settleCard(service, payment, payment.provider_reference);
}

async function settleFib(
  service: SupabaseClient,
  payment: PaymentRow,
  reference: string,
): Promise<Outcome | "unreadable"> {
  const amount = Number(payment.amount_iqd);
  let status: "PAID" | "UNPAID" | "DECLINED";
  try {
    status = await fibPaymentStatus(reference, amount);
  } catch (error) {
    console.error("fib status:", payment.id, error instanceof Error ? error.message : error);
    return "unreadable";
  }
  if (status === "PAID") {
    await rpc(service, "record_app_payment_success", { p_payment_id: payment.id, p_provider_reference: reference });
    return "succeeded";
  }
  if (status === "DECLINED") {
    await rpc(service, "record_app_payment_failure", { p_payment_id: payment.id, p_reason: "Declined by FIB" });
    return "failed";
  }

  // UNPAID. A checkout that is still good stays open. One whose time is over, or whose order no
  // longer needs it, is cancelled at FIB, but only straight after this authoritative UNPAID, and
  // re-read afterwards: a payment that became PAID must be applied, never cancelled.
  const expired = isPast(payment.provider_expires_at);
  const closed = payment.status !== "initiated" || expired || await orderClosed(service, payment.order_id);
  if (!closed) return "pending";

  if (payment.status === "initiated" && expired) {
    await rpc(service, "expire_app_payment", {
      p_payment_id: payment.id,
      p_reason: "FIB validity window elapsed while UNPAID",
    });
  }
  try {
    await fibCancelPayment(reference);
  } catch (error) {
    // Cancelling failed (or raced a payment): ask again before deciding anything.
    let raced: "PAID" | "UNPAID" | "DECLINED";
    try {
      raced = await fibPaymentStatus(reference, amount);
    } catch {
      return expired || payment.status === "expired" ? "expired" : "pending";
    }
    if (raced === "PAID") {
      await rpc(service, "record_app_payment_success", { p_payment_id: payment.id, p_provider_reference: reference });
      return "succeeded";
    }
    if (raced === "DECLINED") {
      await rpc(service, "record_app_payment_failure", { p_payment_id: payment.id, p_reason: "Declined by FIB" });
      return "failed";
    }
    console.error("fib cancel:", payment.id, error instanceof Error ? error.message : error);
    return expired || payment.status === "expired" ? "expired" : "pending";
  }
  // Never assume the cancellation beat settlement.
  try {
    if (await fibPaymentStatus(reference, amount) === "PAID") {
      await rpc(service, "record_app_payment_success", { p_payment_id: payment.id, p_provider_reference: reference });
      return "succeeded";
    }
  } catch {
    // FIB accepted the cancel; a failed re-read is checked again by the worker later.
    return expired || payment.status === "expired" ? "expired" : "pending";
  }
  await rpc(service, "record_app_payment_cancelled", {
    p_payment_id: payment.id,
    p_reason: expired ? "FIB checkout expired and was cancelled" : "FIB checkout cancelled: order closed",
  });
  if (payment.status === "expired" || expired) return "expired";
  return payment.status === "initiated" ? "cancelled" : payment.status as Outcome;
}

async function settleCard(
  service: SupabaseClient,
  payment: PaymentRow,
  reference: string,
): Promise<Outcome | "unreadable"> {
  const orderId = typeof payment.provider_payload?.order_id === "string"
    ? payment.provider_payload.order_id
    : payment.id.replace(/-/g, "").toLowerCase();
  let status;
  try {
    status = await cardPaymentStatus({
      orderId,
      paymentId: reference,
      expectedAmountIqd: Number(payment.amount_iqd),
    });
  } catch (error) {
    console.error("card status:", payment.id, error instanceof Error ? error.message : error);
    return "unreadable";
  }

  if (status.outcome === "PAID") {
    // FIB's transaction reference and authorization code are kept beside our reference.
    await service.from("app_payments").update({
      provider_payload: {
        ...(payment.provider_payload ?? {}),
        fib_reference: status.reference,
        authorization_code: status.authorizationCode,
      },
    }).eq("id", payment.id);
    await rpc(service, "record_app_payment_success", { p_payment_id: payment.id, p_provider_reference: reference });
    return "succeeded";
  }
  if (status.outcome === "DECLINED") {
    await rpc(service, "record_app_payment_failure", {
      p_payment_id: payment.id,
      p_reason: status.description ?? `card payment ${status.rawStatus}`,
    });
    return "failed";
  }

  // Still pending (FIB reads ERROR for a payment the customer is still making: see fib_card.ts).
  // The gateway has no cancel call, so an attempt is closed only once its window, plus the grace
  // for a payment submitted in the last seconds, is over.
  if (checkoutWindowClosed(payment.provider_expires_at)) {
    await rpc(service, "expire_app_payment", {
      p_payment_id: payment.id,
      p_reason: "card checkout window elapsed without payment",
    });
    return "expired";
  }
  await rpc(service, "note_app_payment_check", {
    p_payment_id: payment.id,
    p_next_check_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    p_note: {
      last_status: status.rawStatus,
      last_description: status.description,
      last_error_code: status.errorCode,
      last_return_code: status.returnCode,
      last_checked_at: new Date().toISOString(),
    },
  });
  return "pending";
}

// Plain-text equality that does not stop at the first differing character.
export function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
