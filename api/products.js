const ZOHO_AUTH_DOMAIN = process.env.ZOHO_AUTH_DOMAIN ?? 'https://accounts.zoho.com';
const ZOHO_API_DOMAIN = process.env.ZOHO_API_DOMAIN ?? 'https://www.zohoapis.com';
const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=600&auto=format&fit=crop';

async function getAccessToken() {
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  const res = await fetch(`${ZOHO_AUTH_DOMAIN}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function fetchAllItems(accessToken, orgId) {
  const items = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${ZOHO_API_DOMAIN}/books/v3/items?organization_id=${orgId}&page=${page}&per_page=200&status=active`;
    const res = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Zoho API error: HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== 0) throw new Error(`Zoho error: ${data.message}`);
    items.push(...(data.items ?? []));
    hasMore = data.page_context?.has_more_page ?? false;
    page++;
  }
  return items;
}

function getCustomField(item, label) {
  return (item.custom_fields ?? []).find((f) => f.label === label)?.value ?? null;
}

function normalizeItem(item, index) {
  const wholesaleRaw = getCustomField(item, 'Wholesale Price');
  const wholesalePrice = wholesaleRaw != null ? parseFloat(String(wholesaleRaw).replace(/[^0-9.]/g, '')) : null;

  const imageUrl = getCustomField(item, 'Image URL');
  const images = imageUrl ? [imageUrl] : [PLACEHOLDER_IMAGE];

  return {
    id: String(item.item_id),
    zoho_item_id: String(item.item_id),
    name: item.name ?? '',
    description: item.description ?? '',
    price: Number(item.rate ?? 0),
    wholesale_price: isNaN(wholesalePrice) ? null : wholesalePrice,
    category: item.product_type ?? 'Accessories',
    brand: getCustomField(item, 'Brand') ?? '',
    images,
    featured: getCustomField(item, 'Featured')?.toLowerCase() === 'true',
    order_index: index,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const orgId = process.env.ZOHO_ORG_ID;
  if (!orgId) return res.status(500).json({ error: 'ZOHO_ORG_ID is not set' });

  try {
    const token = await getAccessToken();
    const items = await fetchAllItems(token, orgId);
    const products = items.map((item, i) => normalizeItem(item, i));

    // Cache at Vercel's CDN for 1 hour; serve stale up to 24h while revalidating
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ products });
  } catch (err) {
    console.error('api/products error:', err);
    return res.status(500).json({ error: err.message });
  }
}
