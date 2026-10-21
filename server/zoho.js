import productImagesMap from '../api/productImages.json' with { type: 'json' };
import { cleanDescription } from '../src/utils/storefront.js';

const ZOHO_AUTH_DOMAIN = process.env.ZOHO_AUTH_DOMAIN ?? 'https://accounts.zoho.com';
const ZOHO_API_DOMAIN = process.env.ZOHO_API_DOMAIN ?? 'https://www.zohoapis.com';
const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=600&auto=format&fit=crop';
const PER_PAGE = 200;
const BATCH_SIZE = 5; // fetch 5 pages at a time in parallel
const PRODUCTS_TTL_MS = 60 * 60 * 1000; // 1 hour

// Zoho rate-limits token requests per refresh token. After a failure, wait
// before asking again (30s, doubling to 10 min) instead of retrying on every
// visitor's request, which only extends the lockout.
const MIN_RETRY_MS = 30 * 1000;
const MAX_RETRY_MS = 10 * 60 * 1000;

// ── Module-level caches (survive across requests on the same warm instance) ──
let cachedToken = null;
let tokenExpiresAt = 0;

let cachedProducts = null;
let productsFetchedAt = 0;
let pendingProducts = null;
let failures = 0;
let retryAt = 0;

export class CatalogUnavailableError extends Error {
  constructor() {
    super('The product catalog is temporarily unavailable.');
    this.name = 'CatalogUnavailableError';
  }
}

export const isCatalogConfigured = () => Boolean(process.env.ZOHO_ORG_ID && process.env.ZOHO_REFRESH_TOKEN);

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const res = await fetch(`${ZOHO_AUTH_DOMAIN}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data)}`);

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000;
  return cachedToken;
}

async function fetchPage(accessToken, orgId, page) {
  const url = `${ZOHO_API_DOMAIN}/books/v3/items?organization_id=${orgId}&page=${page}&per_page=${PER_PAGE}&status=active`;
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  // A revoked or expired token must not be reused for the next attempt.
  if (res.status === 401) cachedToken = null;
  if (!res.ok) throw new Error(`Zoho API error: HTTP ${res.status}`);
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Zoho error: ${data.message}`);
  return data;
}

async function fetchAllItems(accessToken, orgId) {
  // Fetch page 1 to get first batch and check if there are more pages
  const first = await fetchPage(accessToken, orgId, 1);
  const items = [...(first.items ?? [])];
  if (!first.page_context?.has_more_page) return items;

  // Keep fetching batches of BATCH_SIZE pages in parallel until done
  let nextPage = 2;
  while (true) {
    const batch = await Promise.all(
      Array.from({ length: BATCH_SIZE }, (_, i) => fetchPage(accessToken, orgId, nextPage + i))
    );
    let done = false;
    for (const page of batch) {
      items.push(...(page.items ?? []));
      if (!page.page_context?.has_more_page) { done = true; break; }
    }
    if (done) break;
    nextPage += BATCH_SIZE;
  }

  return items;
}

function getCustomField(item, label) {
  return (item.custom_fields ?? []).find((f) => f.label === label)?.value ?? null;
}

function normalizeItem(item, index) {
  const wholesaleRaw = getCustomField(item, 'Wholesale Price');
  const wholesalePrice = wholesaleRaw != null ? parseFloat(String(wholesaleRaw).replace(/[^0-9.]/g, '')) : null;

  const itemId = String(item.item_id);
  const mappedImage = productImagesMap[itemId] || productImagesMap[item.name] || null;
  const imageUrl = getCustomField(item, 'Image URL') || mappedImage;
  const stockOnHand = item.stock_on_hand != null ? Number(item.stock_on_hand) : null;

  return {
    id: itemId,
    zoho_item_id: itemId,
    name: item.name ?? '',
    description: item.description ?? '',
    price: Number(item.rate ?? 0),
    wholesale_price: isNaN(wholesalePrice) ? null : wholesalePrice,
    category: item.product_type ?? 'Accessories',
    brand: getCustomField(item, 'Brand') ?? '',
    images: imageUrl ? [imageUrl] : [PLACEHOLDER_IMAGE],
    featured: getCustomField(item, 'Featured')?.toLowerCase() === 'true',
    order_index: index,
    stock_on_hand: stockOnHand,
    in_stock: stockOnHand === null ? null : stockOnHand > 0,
  };
}

async function loadFromZoho() {
  const token = await getAccessToken();
  const items = await fetchAllItems(token, process.env.ZOHO_ORG_ID);
  return items.map((item, i) => normalizeItem(item, i));
}

/**
 * The full catalog, including wholesale prices — never send this to a visitor
 * as-is; pass each product through publicProduct() first.
 *
 * Serves the cached copy for an hour, and keeps serving it (marked stale) while
 * Zoho is failing, so an outage or rate limit doesn't empty the shop.
 */
export async function getCatalog({ refresh = false } = {}) {
  if (!isCatalogConfigured()) throw new CatalogUnavailableError();

  const isFresh = cachedProducts && Date.now() - productsFetchedAt < PRODUCTS_TTL_MS;
  if (isFresh && !refresh) return { products: cachedProducts, stale: false };

  if (Date.now() < retryAt) {
    if (cachedProducts) return { products: cachedProducts, stale: true };
    throw new CatalogUnavailableError();
  }

  pendingProducts ??= loadFromZoho()
    .then((products) => {
      cachedProducts = products;
      productsFetchedAt = Date.now();
      failures = 0;
      retryAt = 0;
      return products;
    }, (error) => {
      failures += 1;
      retryAt = Date.now() + Math.min(MIN_RETRY_MS * 2 ** (failures - 1), MAX_RETRY_MS);
      throw error;
    })
    .finally(() => { pendingProducts = null; });

  try {
    return { products: await pendingProducts, stale: false };
  } catch (error) {
    console.error('Zoho catalog fetch failed:', error.message);
    if (cachedProducts) return { products: cachedProducts, stale: true };
    throw new CatalogUnavailableError();
  }
}

/** Strips internal notes ("office price 5$") and the wholesale price. */
export function publicProduct(product) {
  const { wholesale_price: _wholesalePrice, ...rest } = product;
  return { ...rest, name: cleanDescription(rest.name), description: cleanDescription(rest.description) };
}
