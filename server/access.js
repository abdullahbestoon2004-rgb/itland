import { createHmac, timingSafeEqual } from 'node:crypto';

// Who may see wholesale prices: signed-in wholesale clients and site admins.

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Wholesale clients are stored as a JSON array in the WHOLESALE_CLIENTS env var.
 * Format: [{"email":"client@co.com","password":"pass123","name":"John","company":"ACME"}]
 * Returns null when the variable is malformed.
 */
export function wholesaleClients() {
  let clients;
  try {
    clients = JSON.parse(process.env.WHOLESALE_CLIENTS ?? '[]');
  } catch {
    return null;
  }
  if (!Array.isArray(clients)) return null;
  return clients.filter((client) => typeof client?.email === 'string' && typeof client?.password === 'string');
}

export function findWholesaleClient(email, password) {
  const wanted = normalizeEmail(email);
  return wholesaleClients()?.find(
    (client) => normalizeEmail(client.email) === wanted && safeEqual(client.password, password),
  ) ?? null;
}

// WHOLESALE_SESSION_SECRET is preferred; the Zoho client secret is already a
// server-only value, so it serves as the signing key when that isn't set.
const sessionSecret = () => process.env.WHOLESALE_SESSION_SECRET || process.env.ZOHO_CLIENT_SECRET || '';
const sign = (payload) => createHmac('sha256', sessionSecret()).update(payload).digest('base64url');

/** A signed, expiring session token, or null when no signing secret is configured. */
export function createWholesaleSession(email) {
  if (!sessionSecret()) return null;
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ email: normalizeEmail(email), exp: expiresAt })).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function verifyWholesaleToken(token) {
  if (!sessionSecret() || typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!(claims?.exp > Date.now())) return null;

  // Removing a client from WHOLESALE_CLIENTS also ends their current session.
  return wholesaleClients()?.find((client) => normalizeEmail(client.email) === claims.email) ?? null;
}

/**
 * True when the token belongs to an allow-listed admin. Row level security on
 * admin_users only returns the caller's own row, and PostgREST rejects a forged
 * or expired token, so a non-empty result is the proof.
 */
export async function isAdminToken(token) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || !token) return false;

  try {
    const res = await fetch(`${url}/rest/v1/admin_users?select=email&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return false;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export function bearerToken(req) {
  const header = req.headers?.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
}
