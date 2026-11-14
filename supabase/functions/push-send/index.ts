// push-send: delivers ITland's order notifications (migration 20261111100000_app_push_history_quick_edits.sql).
//
// The database queues events in app_private.push_outbox (trigger on app_orders) and calls this function
// through pg_net right away and every minute (app_private.invoke_push), with x-push-key = the key it made
// in Vault (app_push_key), plus the publishable key so the gateway lets it in. This function claims the
// events (claim_app_push: one message per phone, already in that phone's language), sends them and reports
// back (finish_app_push: delivered, try again later, dead tokens).
//
// iOS (SwiftUI app): APNs HTTP/2 with a token-based (.p8) key.  Android (Flutter app): FCM HTTP v1.
// Edge secrets (Edge Functions → Secrets; values never in the apps or this repo):
//   APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY (the .p8 file's text; "\n" escapes are fine)
//     – the Sign in with Apple key can do push too if "Apple Push Notifications service" is ticked on it;
//       then APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY are used when the APNS_* ones are missing.
//   APNS_BUNDLE_ID (optional, default com.itlandforcomputer.app)
//   FCM_SERVICE_ACCOUNT (the Firebase service account JSON, whole file as one value)
// A missing provider just leaves its messages for later (retried with back-off, up to 6 tries).
//
// JWT setting: any (the key check below is the gate). Reply 200 {"ok":true,"sent":n,"retry":n,"dead":n}.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { importPKCS8, SignJWT } from "npm:jose@5.9.6";

type Message = {
  outbox_id: number;
  token: string;
  provider: "apns" | "fcm";
  apns_env: "sandbox" | "production" | null;
  kind: string;
  title: string;
  body: string;
  url: string;
  order_id: string | null;
};
type Result = "sent" | "retry" | "dead";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const env = (k: string) => (Deno.env.get(k) ?? "").trim();
const pem = (v: string) => v.replace(/\\n/g, "\n");

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ── APNs ─────────────────────────────────────────────────────────────────────
let apnsJwt: { token: string; at: number } | null = null;
async function apnsToken(): Promise<string | null> {
  const team = env("APNS_TEAM_ID") || env("APPLE_TEAM_ID");
  const kid = env("APNS_KEY_ID") || env("APPLE_KEY_ID");
  const key = env("APNS_PRIVATE_KEY") || env("APPLE_PRIVATE_KEY");
  if (!team || !kid || !key) return null;
  // Apple wants a token no older than an hour and refreshed at most every 20 minutes.
  if (apnsJwt && Date.now() - apnsJwt.at < 40 * 60 * 1000) return apnsJwt.token;
  const k = await importPKCS8(pem(key), "ES256");
  const token = await new SignJWT({}).setProtectedHeader({ alg: "ES256", kid }).setIssuer(team).setIssuedAt().sign(k);
  apnsJwt = { token, at: Date.now() };
  return token;
}

async function sendApns(m: Message): Promise<Result> {
  const jwt = await apnsToken();
  if (!jwt) return "retry";
  const host = m.apns_env === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const res = await fetch(`${host}/3/device/${m.token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": env("APNS_BUNDLE_ID") || "com.itlandforcomputer.app",
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-collapse-id": `${m.kind}-${m.order_id ?? ""}`.slice(0, 64),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: { alert: { title: m.title, body: m.body }, sound: "default", "thread-id": m.order_id ?? m.kind },
      url: m.url,
      kind: m.kind,
      order_id: m.order_id,
    }),
  });
  if (res.ok) return "sent";
  const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason ?? "";
  console.error("apns", res.status, reason);
  if (res.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered" || reason === "DeviceTokenNotForTopic") {
    return "dead";
  }
  return "retry";
}

// ── FCM (HTTP v1) ────────────────────────────────────────────────────────────
let fcmAuth: { token: string; until: number; project: string } | null = null;
async function fcmAccess(): Promise<{ token: string; project: string } | null> {
  const raw = env("FCM_SERVICE_ACCOUNT");
  if (!raw) return null;
  if (fcmAuth && Date.now() < fcmAuth.until) return fcmAuth;
  const sa = JSON.parse(raw) as { client_email: string; private_key: string; project_id: string };
  const k = await importPKCS8(pem(sa.private_key), "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(k);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) {
    console.error("fcm auth", res.status, await res.text());
    return null;
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  fcmAuth = { token: body.access_token, until: Date.now() + (body.expires_in - 120) * 1000, project: sa.project_id };
  return fcmAuth;
}

async function sendFcm(m: Message): Promise<Result> {
  const auth = await fcmAccess();
  if (!auth) return "retry";
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.project}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${auth.token}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token: m.token,
        notification: { title: m.title, body: m.body },
        data: { url: m.url, kind: m.kind, order_id: m.order_id ?? "" },
        android: {
          priority: "HIGH",
          collapse_key: `${m.kind}-${m.order_id ?? ""}`.slice(0, 64),
          notification: { channel_id: m.kind.startsWith("admin.") ? "store" : "orders", sound: "default", tag: m.order_id ?? m.kind },
        },
      },
    }),
  });
  if (res.ok) return "sent";
  const text = await res.text();
  console.error("fcm", res.status, text.slice(0, 300));
  if (res.status === 404 || text.includes("UNREGISTERED") || (res.status === 400 && text.includes("registration token"))) return "dead";
  return "retry";
}

// ── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const given = req.headers.get("x-push-key")?.trim() ?? "";
  if (given.length < 24) return json({ error: "unauthorized" }, 401);
  const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const expected = env("APP_PUSH_KEY");
  let allowed = expected.length >= 24 && sameSecret(given, expected);
  if (!allowed) {
    const { data, error } = await service.rpc("app_push_key_ok", { p_key: given });
    allowed = !error && data === true;
  }
  if (!allowed) return json({ error: "unauthorized" }, 401);

  let sent = 0, retry = 0, dead = 0;
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    const { data, error } = await service.rpc("claim_app_push", { p_limit: 50 });
    if (error) return json({ error: error.message }, 500);
    const messages = (data ?? []) as Message[];
    if (messages.length === 0) break;

    const byOutbox = new Map<number, Result[]>();
    const deadTokens: string[] = [];
    let lastError: string | null = null;
    await Promise.all(messages.map(async (m) => {
      let r: Result;
      try {
        r = m.provider === "apns" ? await sendApns(m) : await sendFcm(m);
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.error("push", m.provider, lastError);
        r = "retry";
      }
      if (r === "dead") deadTokens.push(m.token);
      byOutbox.set(m.outbox_id, [...(byOutbox.get(m.outbox_id) ?? []), r]);
    }));

    // An event is delivered once any of the person's phones got it; it is tried again only when none did
    // and at least one failed for a passing reason.
    const sentIds: number[] = [], retryIds: number[] = [];
    for (const [id, results] of byOutbox) {
      if (results.includes("sent")) sentIds.push(id);
      else if (results.includes("retry")) retryIds.push(id);
      else sentIds.push(id); // every phone is gone
    }
    sent += sentIds.length;
    retry += retryIds.length;
    dead += deadTokens.length;
    const { error: finishError } = await service.rpc("finish_app_push", {
      p_sent: sentIds, p_retry: retryIds, p_dead: deadTokens, p_error: lastError ?? (retryIds.length ? "provider not configured or unavailable" : null),
    });
    if (finishError) return json({ error: finishError.message }, 500);
    if (retryIds.length > 0 && sentIds.length === 0) break; // nothing is getting through right now
  }
  return json({ ok: true, sent, retry, dead });
});
