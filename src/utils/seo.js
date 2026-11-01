export const SITE_NAME = 'IT Land';
export const SITE_URL = 'https://itlandforcomputer.com';
export const DEFAULT_DESCRIPTION = 'Shop computer accessories, keyboards, mice, headsets and gaming gear at IT Land in Erbil. Delivery across Iraq and Kurdistan. Order on WhatsApp.';
export const brandSlug = brand => String(brand).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const brandPath = brand => `/brands/${brandSlug(brand)}`;
export const CATEGORIES = ['Mice', 'Keyboards', 'Headsets', 'Webcams', 'Gaming', 'Accessories', 'Audio', 'Streaming'];
export const absoluteUrl = (value = '/') => new URL(value, SITE_URL).href;
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const serializeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
export const toProductSlug = product => {
    const base = String(product?.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
    return base ? `${base}-${product.id}` : String(product.id);
};
// A product name short enough for a search result title: the first clause of
// long catalog names ("... 910-001935 – Long 3 Year Battery ..."), cut at a word
// boundary, without a dangling "with" or comma.
const DANGLING_END = /(?:\s+(?:with|for|and|or|to|in|the|&)|[\s,;:–—-]+)$/i;
const COLOUR = /\b(off[- ]white|space gr[ae]y|pale gr[ae]y|graphite|black|white|gr[ae]y|silver|gold|pink|rose|red|blue|green|mint|lilac|yellow)\b/gi;
export function shortProductTitle(name, max = 60) {
    const full = String(name ?? '').trim();
    let title = full;
    const clauseEnd = title.search(/\s[–—-]\s|,|\(/);
    if (clauseEnd >= 20) title = title.slice(0, clauseEnd);
    if (title.length > max) {
        const wordEnd = title.lastIndexOf(' ', max);
        title = title.slice(0, wordEnd > 20 ? wordEnd : max);
    }
    for (let previous; previous !== title;) {
        previous = title;
        title = title.replace(DANGLING_END, '');
    }
    // Keep a colour the cut dropped, so colour variants get distinct titles.
    const colour = full.match(COLOUR)?.at(-1);
    if (colour && !title.toLowerCase().includes(colour.toLowerCase())) title += ` ${colour}`;
    return title;
}
export const organization = {
    '@context': 'https://schema.org', '@type': 'Organization', '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME, url: `${SITE_URL}/`, logo: absoluteUrl('/itlandlogo.png'),
    telephone: '+9647504888570', areaServed: { '@type': 'Country', name: 'Iraq' }
};
// Matches the shop's Google Maps listing ("iTland For Computer"): same address,
// pin, phone and hours, so Google can tie the website to the map listing.
export const STORE_MAP_URL = 'https://www.google.com/maps?cid=3550846731506509334';
export const STORE_GEO = { latitude: 36.1899364, longitude: 44.0033506 };
export const STORE_ADDRESS = 'Muzaffariya Street, Erbil, Kurdistan Region, Iraq';
export const STORE_HOURS = [
    { days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'], opens: '09:00', closes: '19:30' },
    { days: ['Saturday'], opens: '09:30', closes: '19:30' },
];
export const storeBusiness = {
    ...organization, '@type': 'ComputerStore', '@id': `${SITE_URL}/#store`,
    alternateName: 'iTland For Computer',
    image: absoluteUrl('/itlandlogo.png'),
    address: { '@type': 'PostalAddress', streetAddress: 'Muzaffariya Street', addressLocality: 'Erbil', addressRegion: 'Kurdistan Region', postalCode: '44001', addressCountry: 'IQ' },
    geo: { '@type': 'GeoCoordinates', ...STORE_GEO },
    openingHoursSpecification: STORE_HOURS.map(({ days, opens, closes }) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: days, opens, closes })),
    hasMap: STORE_MAP_URL,
    sameAs: [STORE_MAP_URL],
    areaServed: [{ '@type': 'City', name: 'Erbil' }, { '@type': 'AdministrativeArea', name: 'Kurdistan Region' }, { '@type': 'Country', name: 'Iraq' }],
    parentOrganization: { '@id': `${SITE_URL}/#organization` }
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
