// Generates sitemap.xml from the live Zoho catalog so every product page is
// discoverable. Wired to /sitemap.xml by the rewrite in vercel.json.

const SITE_URL = 'https://itlandforcomputer.com';

const STATIC_PAGES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/products', changefreq: 'daily', priority: '0.9' },
  { path: '/about', changefreq: 'monthly', priority: '0.7' },
  { path: '/contact', changefreq: 'monthly', priority: '0.7' },
];

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const toSlug = (name, id) => {
  const base = String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);

  return base ? `${base}-${id}` : String(id);
};

const urlEntry = ({ path, changefreq, priority, lastmod }) =>
  `  <url>\n` +
  `    <loc>${escapeXml(SITE_URL + path)}</loc>\n` +
  `    <lastmod>${lastmod}</lastmod>\n` +
  `    <changefreq>${changefreq}</changefreq>\n` +
  `    <priority>${priority}</priority>\n` +
  `  </url>`;

export default async function handler(req, res) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = STATIC_PAGES.map((page) => urlEntry({ ...page, lastmod: today }));

  try {
    const origin = `https://${req.headers['x-forwarded-host'] ?? req.headers.host}`;
    const response = await fetch(`${origin}/api/products`);

    if (response.ok) {
      const { products } = await response.json();

      (products ?? []).forEach((product) => {
        entries.push(
          urlEntry({
            path: `/product/${toSlug(product.name, product.id)}`,
            changefreq: 'weekly',
            priority: '0.8',
            lastmod: today,
          }),
        );
      });
    }
  } catch (err) {
    // A product fetch failure must not take the sitemap down — serve the static pages.
    console.error('sitemap: product fetch failed', err);
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${entries.join('\n')}\n` +
    `</urlset>\n`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
  return res.status(200).send(xml);
}
