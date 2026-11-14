// The site's languages. English has no prefix; Arabic and Kurdish (Sorani)
// live under /ar and /ku, so each has an address a search engine can index.
export const LOCALES = {
    en: { prefix: '', lang: 'en', dir: 'ltr', og: 'en_US' },
    ar: { prefix: '/ar', lang: 'ar', dir: 'rtl', og: 'ar_IQ' },
    ku: { prefix: '/ku', lang: 'ckb', dir: 'rtl', og: 'ckb_IQ' },
};
const PREFIX = /^\/(ar|ku)(?=\/|$)/;

/** The language a path is written in: "/ar/products" is Arabic, "/products" English. */
export const localeFromPath = (pathname = '/') => PREFIX.exec(pathname)?.[1] ?? 'en';

/** The path without its language prefix: "/ar/products" becomes "/products". */
export const stripLocale = (pathname = '/') => pathname.replace(PREFIX, '') || '/';

/** The same page in another language: ("ar", "/products?page=2") becomes "/ar/products?page=2". */
export function localePath(locale, path = '/') {
    const prefix = LOCALES[locale]?.prefix ?? '';
    const bare = stripLocale(path);
    return bare === '/' || bare.startsWith('/?') || bare.startsWith('/#') ? `${prefix || '/'}${bare.slice(1)}` : `${prefix}${bare}`;
}

/** Puts values into a translated sentence: fill("{name} Price in Iraq", { name }). */
export const fill = (text, values = {}) => String(text).replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
