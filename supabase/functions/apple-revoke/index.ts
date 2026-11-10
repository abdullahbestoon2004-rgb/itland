// apple-revoke: Delete account for Sign in with Apple accounts (App Review Guideline 5.1.1(v)).
//
// The iOS app (ITland, com.itlandforcomputer.app) asks Apple for a fresh authorization code when an
// Apple customer taps Delete account, POSTs {"code": "<authorization code>"} here with the customer's
// session (functions.invoke), and then calls rpc delete_my_app_account. This function trades the
// code for the customer's Apple tokens (https://appleid.apple.com/auth/token) and revokes the
// refresh token (https://appleid.apple.com/auth/revoke). The Apple key stays on the server.
//
// Not deployed yet. Deploy: `supabase functions deploy apple-revoke` (JWT verification on, the default,
// so only a signed-in customer can call it). Secrets (`supabase secrets set …`), never in the apps:
//   APPLE_TEAM_ID      the Apple Developer Team ID (10 characters)
//   APPLE_KEY_ID       the Key ID of a Sign in with Apple key (Certificates, Identifiers & Profiles → Keys)
//   APPLE_PRIVATE_KEY  that key's .p8 file contents (PEM, "\n" escapes are accepted)
//   APPLE_CLIENT_ID    optional, default com.itlandforcomputer.app (the app's bundle id: native
//                      sign-in codes belong to the App ID, not a Services ID)
//
// Replies: 200 {"revoked": true}; 400 {"error": "bad_request"}; 503 {"error": "not_configured"};
// 502 {"error": "apple_token" | "apple_revoke", "status": <Apple's HTTP status>}. The app treats any
// failure as "not revoked" and still deletes the account.

import { importPKCS8, SignJWT } from "npm:jose@5.9.6";

const APPLE = "https://appleid.apple.com";

function reply(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** The client secret: an ES256 JWT signed with the Sign in with Apple key, valid for 5 minutes. */
async function clientSecret(teamId: string, keyId: string, pem: string, clientId: string): Promise<string> {
  const key = await importPKCS8(pem.replace(/\\n/g, "\n"), "ES256");
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience(APPLE)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(key);
}

function form(fields: Record<string, string>): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "bad_request" }, 405);
  let code = "";
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code.trim() : "";
  } catch {
    // Not JSON: handled below.
  }
  if (!code || code.length > 2048) return reply({ error: "bad_request" }, 400);

  const teamId = Deno.env.get("APPLE_TEAM_ID") ?? "";
  const keyId = Deno.env.get("APPLE_KEY_ID") ?? "";
  const pem = Deno.env.get("APPLE_PRIVATE_KEY") ?? "";
  const clientId = Deno.env.get("APPLE_CLIENT_ID") || "com.itlandforcomputer.app";
  if (!teamId || !keyId || !pem) return reply({ error: "not_configured" }, 503);

  const secret = await clientSecret(teamId, keyId, pem, clientId);

  // 1. The authorization code → the customer's tokens for this app.
  const tokenRes = await fetch(`${APPLE}/auth/token`, form({
    client_id: clientId,
    client_secret: secret,
    code,
    grant_type: "authorization_code",
  }));
  if (!tokenRes.ok) return reply({ error: "apple_token", status: tokenRes.status }, 502);
  const tokens = await tokenRes.json();
  const token: string | undefined = tokens.refresh_token ?? tokens.access_token;
  if (!token) return reply({ error: "apple_token", status: tokenRes.status }, 502);

  // 2. Revoke them. Revoking the refresh token ends the app's authorization for this Apple ID.
  const revokeRes = await fetch(`${APPLE}/auth/revoke`, form({
    client_id: clientId,
    client_secret: secret,
    token,
    token_type_hint: tokens.refresh_token ? "refresh_token" : "access_token",
  }));
  if (!revokeRes.ok) return reply({ error: "apple_revoke", status: revokeRes.status }, 502);
  return reply({ revoked: true });
});
