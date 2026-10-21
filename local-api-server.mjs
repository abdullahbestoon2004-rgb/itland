// Local API server — runs the same handlers as the Vercel serverless functions.
// Run alongside Vite: node local-api-server.mjs
// Vite proxies /api/* to this server (see vite.config.js).

import http from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// Load .env before the handlers read process.env at import time.
try {
  const lines = readFileSync(join(__dir, '.env'), 'utf8').split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const { default: productsHandler } = await import('./api/products.js');
const { default: wholesaleLoginHandler } = await import('./api/wholesale-login.js');
const { default: currencyHandler } = await import('./api/currency.js');

const ZOHO_AUTH_DOMAIN = process.env.ZOHO_AUTH_DOMAIN ?? 'https://accounts.zoho.com';
const PORT = 3001;

// Adds the Vercel request/response helpers the handlers rely on.
function adapt(req, res, url) {
  req.query = Object.fromEntries(url.searchParams);
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); return res; };
}

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  try {
    return JSON.parse(body || '{}');
  } catch {
    return {};
  }
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// ── Server ───────────────────────────────────────────────────────────────────
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  adapt(req, res, url);

  try {
    if (url.pathname === '/api/currency') return await currencyHandler(req, res);
    if (url.pathname === '/api/products') return await productsHandler(req, res);
    if (url.pathname === '/api/wholesale-login') {
      if (req.method === 'POST') req.body = await readJsonBody(req);
      return await wholesaleLoginHandler(req, res);
    }
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: 'Local API error' });
  }

  if (url.pathname === '/api/zoho-auth') {
    const secret = url.searchParams.get('secret');
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) return json(res, 401, { error: 'Unauthorized' });
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.ZOHO_CLIENT_ID,
      scope: 'ZohoBooks.fullaccess.all',
      redirect_uri: process.env.ZOHO_REDIRECT_URI,
      access_type: 'offline',
      prompt: 'consent',
    });
    res.writeHead(302, { Location: `${ZOHO_AUTH_DOMAIN}/oauth/v2/auth?${params}` });
    return res.end();
  }

  json(res, 404, { error: 'Not found' });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`✓ Local API server running on http://localhost:${PORT}`);
});
