import { loadCatalog } from '../server/catalog.js';
import { normalizeCatalog, helpContent } from '../dist-ssr/entry-server.js';
import { SITE_URL, escapeHtml, toProductSlug, CATEGORIES, brandPath } from '../src/utils/seo.js';

export default async function handler(req, res) {
    try {
        const products = normalizeCatalog(await loadCatalog());
        const paths = new Set(['/', '/products', '/about', '/contact', ...Object.keys(helpContent).map(topic => `/help/${topic}`)]);
        for (const category of CATEGORIES) {
            if (products.some(product => product.category === category)) paths.add(`/products?category=${encodeURIComponent(category)}`);
        }
        for (const product of products) {
            paths.add(`/product/${toProductSlug(product)}`);
            if (product.brand) paths.add(brandPath(product.brand));
        }
        const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
            [...paths].map(path => `  <url><loc>${escapeHtml(SITE_URL + path)}</loc></url>`).join('\n') + '\n</urlset>\n';
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
