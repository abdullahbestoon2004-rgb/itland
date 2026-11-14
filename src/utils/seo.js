import { LOCALES, localePath } from './locale.js';
import { maghribTime, STORE_GEO, STORE_OPEN_DAYS, STORE_OPENS } from './storeHours.js';
import { CITIES } from '../data/cities.js';

export { STORE_GEO };

export const SITE_NAME = 'IT Land';
export const SITE_URL = 'https://itlandforcomputer.com';
export const DEFAULT_TITLE = 'Computer Accessories Store in Erbil, Iraq';
export const DEFAULT_DESCRIPTION = 'IT Land in Erbil sells original Logitech, Jabra and Poly mice, keyboards, headsets, webcams and meeting room equipment. Delivery across Iraq. Order on WhatsApp.';
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
    name: SITE_NAME, url: `${SITE_URL}/`, logo: absoluteUrl('/itland-logo-square.png'),
    description: 'Computer accessories store in Erbil selling original Logitech, Jabra and Poly products, with delivery across Iraq and Kurdistan.',
    telephone: '+9647504888570', areaServed: { '@type': 'Country', name: 'Iraq' },
    contactPoint: { '@type': 'ContactPoint', telephone: '+9647504888570', contactType: 'customer service', areaServed: 'IQ', availableLanguage: ['English', 'Arabic', 'Kurdish'] }
};
// Matches the shop's Google Maps listing ("iTland For Computer"): same address,
// pin, phone and hours, so Google can tie the website to the map listing.
export const STORE_MAP_URL = 'https://www.google.com/maps?cid=3550846731506509334';
export const STORE_ADDRESS = 'Muzaffariya Street, Erbil, Kurdistan Region, Iraq';
// Open 10:00 until Maghrib, closed on Friday (see storeHours.js). The closing
// time is the one for the day the page is made, so it follows the seasons.
export const storeBusiness = (now = Date.now()) => ({
    ...organization, '@type': 'ComputerStore', '@id': `${SITE_URL}/#store`,
    alternateName: 'iTland For Computer',
    image: absoluteUrl('/itland-logo-square.png'),
    address: { '@type': 'PostalAddress', streetAddress: 'Muzaffariya Street', addressLocality: 'Erbil', addressRegion: 'Kurdistan Region', postalCode: '44001', addressCountry: 'IQ' },
    geo: { '@type': 'GeoCoordinates', ...STORE_GEO },
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: STORE_OPEN_DAYS, opens: STORE_OPENS, closes: maghribTime(now) }],
    hasMap: STORE_MAP_URL,
    sameAs: [STORE_MAP_URL],
    // Delivery reaches every city; the ones with their own page are named.
    areaServed: [{ '@type': 'Country', name: 'Iraq' }, { '@type': 'AdministrativeArea', name: 'Kurdistan Region' }, ...CITIES.map(city => ({ '@type': 'City', name: city.name }))],
    parentOrganization: { '@id': `${SITE_URL}/#organization` }
});
// The trail search results show above a page's title: Home, then each [name, path].
export const breadcrumbs = (...trail) => ({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [['Home', '/'], ...trail].map(([name, path], index) => ({ '@type': 'ListItem', position: index + 1, name, item: absoluteUrl(path) }))
});
// A description that fits a search result: whole sentences where possible,
// otherwise whole words, never a word cut in half.
export function clipDescription(value, max = 160) {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    const cut = text.slice(0, max + 1);
    const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
    if (sentenceEnd >= max * 0.6) return cut.slice(0, sentenceEnd + 1);
    return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:–—-]+$/, '')}…`;
}
// Structured data for a translated page: links to the shop's own pages point at
// that language's address, and breadcrumb names are shown in that language. The
// shop itself (#store, #organization) stays one thing in every language.
const PAGE_LINK_KEYS = new Set(['url', 'item', '@id']);
export function localizeSchema(value, locale, t = text => text, key = '', parent = null) {
    if (Array.isArray(value)) return value.map(entry => localizeSchema(entry, locale, t, key, parent));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, entry]) => [name, localizeSchema(entry, locale, t, name, value)]));
    if (typeof value !== 'string') return value;
    if (key === 'name' && parent?.['@type'] === 'ListItem' && parent.item) return t(value);
    if (!PAGE_LINK_KEYS.has(key) || !value.startsWith(`${SITE_URL}/`)) return value;
    const path = value.slice(SITE_URL.length);
    const isShopItself = path === '/' ? key !== 'item' : path.startsWith('/#');
    return isShopItself || /\.(png|jpe?g|webp|svg|gif)$/i.test(path) ? value : `${SITE_URL}${localePath(locale, path)}`;
}
/**
 * `locale` is given only for pages that exist in every language (the store
 * pages); those are listed to search engines with their other-language versions.
 */
export function pageMetadata({ title, description, image, path = '/', jsonLd, noindex = false, type = 'website', locale = null, t } = {}) {
    const language = LOCALES[locale] ? locale : 'en';
    return {
        title: title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | ${DEFAULT_TITLE}`,
        description: clipDescription(description || DEFAULT_DESCRIPTION),
        url: absoluteUrl(localePath(language, path)), image: absoluteUrl(image || '/itland-share.png'), type,
        robots: noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large',
        jsonLd: jsonLd && language !== 'en' ? localizeSchema(jsonLd, language, t) : jsonLd,
        ogLocale: LOCALES[language].og,
        alternates: locale && !noindex ? [...Object.entries(LOCALES).map(([code, { lang }]) => [lang, absoluteUrl(localePath(code, path))]), ['x-default', absoluteUrl(localePath('en', path))]] : [],
    };
}
export function renderHead(meta) {
    const tags = { description: meta.description, robots: meta.robots, 'twitter:card': 'summary_large_image', 'twitter:title': meta.title, 'twitter:description': meta.description, 'twitter:image': meta.image };
    return `<title>${escapeHtml(meta.title)}</title>\n<link rel="canonical" href="${escapeHtml(meta.url)}" />\n` +
        (meta.alternates ?? []).map(([lang, href]) => `<link rel="alternate" hreflang="${lang}" href="${escapeHtml(href)}" />\n`).join('') +
        Object.entries(tags).map(([name, content]) => `<meta name="${name}" content="${escapeHtml(content)}" />`).join('\n') + '\n' +
        Object.entries({ 'og:type': meta.type, 'og:site_name': SITE_NAME, 'og:locale': meta.ogLocale ?? 'en_US', 'og:title': meta.title, 'og:description': meta.description, 'og:url': meta.url, 'og:image': meta.image, 'og:image:alt': meta.title }).map(([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}" />`).join('\n') +
        (meta.jsonLd ? `\n<script type="application/ld+json" data-page-meta="true">${serializeJson(meta.jsonLd)}</script>` : '');
}
