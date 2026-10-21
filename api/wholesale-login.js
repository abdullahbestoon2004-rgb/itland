import { createWholesaleSession, findWholesaleClient, wholesaleClients } from '../server/access.js';

// Wholesale clients live in the WHOLESALE_CLIENTS env var (see server/access.js).
// Add/remove clients by editing that env var in your Vercel project settings.

// Slows down password guessing. Per warm instance only, so it is a speed bump,
// not a hard limit.
const MAX_FAILURES = 8;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const failedAttempts = new Map();

const clientIp = (req) => String(req.headers?.['x-forwarded-for'] ?? req.socket?.remoteAddress ?? '').split(',')[0].trim();

function recordFailure(ip) {
  const now = Date.now();
  if (failedAttempts.size > 1000) {
    for (const [key, entry] of failedAttempts) if (entry.resetAt <= now) failedAttempts.delete(key);
  }
  const entry = failedAttempts.get(ip);
  if (!entry || entry.resetAt <= now) failedAttempts.set(ip, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
  else entry.count += 1;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');

  const ip = clientIp(req);
  const attempts = failedAttempts.get(ip);
  if (attempts && attempts.resetAt > Date.now() && attempts.count >= MAX_FAILURES) {
    res.setHeader('Retry-After', String(Math.ceil((attempts.resetAt - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Too many sign-in attempts. Please try again later.' });
  }

  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!wholesaleClients()) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const client = findWholesaleClient(email, password);
  if (!client) {
    recordFailure(ip);
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  failedAttempts.delete(ip);

  const session = createWholesaleSession(client.email);
  if (!session) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  return res.status(200).json({
    success: true,
    client: { name: client.name, company: client.company ?? null, email: client.email },
    token: session.token,
    expiresAt: session.expiresAt,
  });
}
