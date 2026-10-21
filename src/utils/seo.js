export const SITE_NAME = 'IT Land';
export const SITE_URL = 'https://itlandforcomputer.com';
export const DEFAULT_DESCRIPTION = 'Shop computer accessories, keyboards, mice, headsets and gaming gear at IT Land in Erbil. Delivery across Iraq and Kurdistan. Order on WhatsApp.';
export const CATEGORIES = ['Mice', 'Keyboards', 'Headsets', 'Webcams', 'Gaming', 'Accessories', 'Audio', 'Streaming'];
export const absoluteUrl = (value = '/') => new URL(value, SITE_URL).href;
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const serializeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
export const toProductSlug = product => {
    const base = String(product?.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
    return base ? `${base}-${product.id}` : String(product.id);
};
export const organization = {
    '@context': 'https://schema.org', '@type': 'Organization', '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME, url: `${SITE_URL}/`, logo: absoluteUrl('/itlandlogo.png'),
    telephone: '+9647504888570', areaServed: { '@type': 'Country', name: 'Iraq' }
};
export function pageMetadata({ title, description, image, path = '/', jsonLd, noindex = false, type = 'website' } = {}) {
    return {
        title: title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Computer Accessories & Gaming Gear in Iraq`,
        description: (description || DEFAULT_DESCRIPTION).replace(/\s+/g, ' ').trim().slice(0, 170),
        url: absoluteUrl(path), image: absoluteUrl(image || '/itlandlogo.png'), type,
        robots: noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large', jsonLd
    };
}
export function renderHead(meta) {
    const tags = { description: meta.description, robots: meta.robots, 'twitter:card': 'summary_large_image', 'twitter:title': meta.title, 'twitter:description': meta.description, 'twitter:image': meta.image };
    return `<title>${escapeHtml(meta.title)}</title>\n<link rel="canonical" href="${escapeHtml(meta.url)}" />\n` +
        Object.entries(tags).map(([name, content]) => `<meta name="${name}" content="${escapeHtml(content)}" />`).join('\n') + '\n' +
        Object.entries({ 'og:type': meta.type, 'og:site_name': SITE_NAME, 'og:title': meta.title, 'og:description': meta.description, 'og:url': meta.url, 'og:image': meta.image }).map(([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}" />`).join('\n') +
        (meta.jsonLd ? `\n<script type="application/ld+json" data-page-meta="true">${serializeJson(meta.jsonLd)}</script>` : '');
}
