// The app's public legal pages (App Store and Google Play link to them).
// Text lives in legalStrings.json: English and Arabic written by hand,
// Kurdish (Sorani) from Gemini. Sections here only point at string keys.
import strings from './legalStrings.json';

export const LEGAL_LANGUAGES = [
    { code: 'en', label: 'English', lang: 'en', dir: 'ltr' },
    { code: 'ar', label: 'عربي', lang: 'ar', dir: 'rtl' },
    { code: 'ku', label: 'کوردی', lang: 'ckb', dir: 'rtl' },
];

export const LEGAL_CONTACT = {
    phone: '+964 750 488 8570',
    tel: '+9647504888570',
    whatsapp: 'https://wa.me/9647504888570',
    email: 'info@itlandforcomputer.com',
};

export const LEGAL_DOCS = {
    privacy: {
        path: '/app/privacy',
        prefix: 'privacy',
        sections: [
            { h: 'privacy.collect.h', labelled: ['privacy.collect.account', 'privacy.collect.address', 'privacy.collect.orders', 'privacy.collect.phone'] },
            { h: 'privacy.use.h', list: ['privacy.use.li1', 'privacy.use.li2', 'privacy.use.li3'], after: ['privacy.use.note'] },
            { h: 'privacy.store.h', p: ['privacy.store.p1', 'privacy.store.p2', 'privacy.store.p3'] },
            { h: 'privacy.share.h', list: ['privacy.share.li1', 'privacy.share.li2', 'privacy.share.li3'], after: ['privacy.share.note'] },
            { h: 'privacy.ads.h', p: ['privacy.ads.p'] },
            { h: 'privacy.pay.h', p: ['privacy.pay.p'] },
            { h: 'privacy.keep.h', p: ['privacy.keep.p1', 'privacy.keep.p2'] },
            { h: 'privacy.choices.h', p: ['privacy.choices.p1', 'privacy.choices.p2'], link: { doc: 'delete-account', text: 'privacy.choices.link' } },
            { h: 'privacy.children.h', p: ['privacy.children.p'] },
            { h: 'privacy.changes.h', p: ['privacy.changes.p'] },
        ],
    },
    terms: {
        path: '/app/terms',
        prefix: 'terms',
        sections: [
            { h: 'terms.products.h', p: ['terms.products.p'] },
            { h: 'terms.prices.h', p: ['terms.prices.p'] },
            { h: 'terms.orders.h', p: ['terms.orders.p'] },
            { h: 'terms.delivery.h', p: ['terms.delivery.p'] },
            { h: 'terms.payment.h', p: ['terms.payment.p'] },
            { h: 'terms.cancel.h', p: ['terms.cancel.p'] },
            { h: 'terms.returns.h', p: ['terms.returns.p'] },
            { h: 'terms.account.h', list: ['terms.account.li1', 'terms.account.li2', 'terms.account.li3', 'terms.account.li4'], link: { doc: 'delete-account', text: 'delete.title' } },
            { h: 'terms.changes.h', p: ['terms.changes.p'] },
        ],
    },
    'delete-account': {
        path: '/app/delete-account',
        prefix: 'delete',
        sections: [
            { h: 'delete.app.h', steps: ['delete.app.li1', 'delete.app.li2', 'delete.app.li3'], after: ['delete.app.note'] },
            { h: 'delete.what.h', list: ['delete.what.li1', 'delete.what.li2', 'delete.what.li3', 'delete.what.li4'] },
            { h: 'delete.noapp.h', p: ['delete.noapp.p1', 'delete.noapp.p2'] },
        ],
    },
};

export const LEGAL_PATHS = Object.values(LEGAL_DOCS).map(doc => doc.path);

export function legalLanguage(value) {
    return LEGAL_LANGUAGES.find(item => item.code === value) ?? LEGAL_LANGUAGES[0];
}

export function legalText(code, key) {
    return strings[code]?.[key] ?? strings.en[key] ?? key;
}

// The page's own address in a language: English has no ?lang, so it stays the canonical URL.
export function legalHref(doc, code) {
    return code === 'en' ? LEGAL_DOCS[doc].path : `${LEGAL_DOCS[doc].path}?lang=${code}`;
}
