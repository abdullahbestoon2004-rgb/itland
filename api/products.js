import { CatalogUnavailableError, getCatalog, publicProduct } from '../server/zoho.js';
import { bearerToken, isAdminToken, verifyWholesaleToken } from '../server/access.js';

// A forced refresh bypasses the cache; admin-only and throttled so it can't be
// used to hammer Zoho's rate limit.
let lastForcedRefreshAt = 0;
const FORCED_REFRESH_COOLDOWN_MS = 30 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // The public catalog never includes wholesale prices. ?view=wholesale (signed
  // wholesale session) and ?view=admin (Supabase admin) do, and are never cached.
  const view = req.query?.view;
  const privileged = view === 'wholesale' || view === 'admin';
  if (privileged) {
    res.setHeader('Cache-Control', 'private, no-store');
    const token = bearerToken(req);
    const allowed = view === 'wholesale' ? Boolean(verifyWholesaleToken(token)) : await isAdminToken(token);
    if (!allowed) return res.status(401).json({ error: 'Please sign in again.' });
  }

  const wantsRefresh = view === 'admin' && (req.query?.refresh === '1' || req.query?.refresh === 'true');
  const refreshAllowed = wantsRefresh && Date.now() - lastForcedRefreshAt > FORCED_REFRESH_COOLDOWN_MS;
  if (refreshAllowed) lastForcedRefreshAt = Date.now();

  try {
    const { products, stale } = await getCatalog({ refresh: refreshAllowed });

    if (!privileged) {
      // A stale copy (Zoho failing) is cached briefly so the CDN retries sooner.
      res.setHeader('Cache-Control', stale ? 's-maxage=300, stale-while-revalidate=3600' : 's-maxage=3600, stale-while-revalidate=86400');
    }
    return res.status(200).json({
      products: privileged ? products : products.map(publicProduct),
      stale,
      ...(wantsRefresh ? { refreshed: refreshAllowed && !stale } : {}),
    });
  } catch (err) {
    if (!(err instanceof CatalogUnavailableError)) console.error('api/products error:', err);
    // Zoho's own error text stays in the server log.
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', '60');
    return res.status(503).json({ error: 'The product catalog is temporarily unavailable.' });
  }
}
