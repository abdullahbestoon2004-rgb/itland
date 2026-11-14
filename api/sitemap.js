import { loadCatalog } from '../server/catalog.js';
import { normalizeCatalog, helpContent, LEGAL_PATHS, VIDEO_CONFERENCING_PATH, LOCALES, localePath } from '../dist-ssr/entry-server.js';
import { SITE_URL, absoluteUrl, escapeHtml, toProductSlug, CATEGORIES, brandPath } from '../src/utils/seo.js';

export default async function handler(req, res) {
    try {
        const products = normalizeCatalog(await loadCatalog());
        // Path -> product photo (if any), so product pages can show in Google Images.
        const paths = new Map(['/', '/products', VIDEO_CONFERENCING_PATH, '/about', '/contact', ...Object.keys(helpContent).map(topic => `/help/${topic}`)].map(path => [path, null]));
        for (const category of CATEGORIES) {
            if (products.some(product => product.category === category)) paths.set(`/products?category=${encodeURIComponent(category)}`, null);
        }
        for (const product of products) {
            paths.set(`/product/${toProductSlug(product)}`, product.images?.[0] ?? null);
            if (product.brand && !paths.has(brandPath(product.brand))) paths.set(brandPath(product.brand), null);
        }
        // Every store page is listed once per language, each entry naming the others,
        // so a search in Arabic or Kurdish is shown that language's page.
        const address = (locale, path) => escapeHtml(SITE_URL + localePath(locale, path));
        const alternates = path => [...Object.entries(LOCALES).map(([locale, { lang }]) => [lang, address(locale, path)]), ['x-default', address('en', path)]]
            .map(([lang, href]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`).join('');
        const entry = (loc, image, links = '') => `  <url><loc>${loc}</loc>${links}${image ? `<image:image><image:loc>${escapeHtml(absoluteUrl(image))}</image:loc></image:image>` : ''}</url>`;
        const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
            [...[...paths].flatMap(([path, image]) => Object.keys(LOCALES).map(locale => entry(address(locale, path), image, alternates(path)))),
                // The mobile app's legal pages have one address each.
                ...LEGAL_PATHS.map(path => entry(escapeHtml(SITE_URL + path)))].join('\n') + '\n</urlset>\n';
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
