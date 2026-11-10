import { loadCatalog } from '../server/catalog.js';
import { normalizeCatalog, helpContent, LEGAL_PATHS } from '../dist-ssr/entry-server.js';
import { SITE_URL, absoluteUrl, escapeHtml, toProductSlug, CATEGORIES, brandPath } from '../src/utils/seo.js';

export default async function handler(req, res) {
    try {
        const products = normalizeCatalog(await loadCatalog());
        // Path -> product photo (if any), so product pages can show in Google Images.
        const paths = new Map(['/', '/products', '/about', '/contact', ...Object.keys(helpContent).map(topic => `/help/${topic}`), ...LEGAL_PATHS].map(path => [path, null]));
        for (const category of CATEGORIES) {
            if (products.some(product => product.category === category)) paths.set(`/products?category=${encodeURIComponent(category)}`, null);
        }
        for (const product of products) {
            paths.set(`/product/${toProductSlug(product)}`, product.images?.[0] ?? null);
            if (product.brand && !paths.has(brandPath(product.brand))) paths.set(brandPath(product.brand), null);
        }
        const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
            [...paths].map(([path, image]) => `  <url><loc>${escapeHtml(SITE_URL + path)}</loc>${image ? `<image:image><image:loc>${escapeHtml(absoluteUrl(image))}</image:loc></image:image>` : ''}</url>`).join('\n') + '\n</urlset>\n';
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
        return res.status(200).send(xml);
    } catch (error) {
        console.error('Sitemap unavailable:', error.message);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Retry-After', '300');
        return res.status(503).send('Sitemap temporarily unavailable');
    }
}
