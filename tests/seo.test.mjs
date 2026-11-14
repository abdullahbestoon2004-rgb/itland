import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from '../dist-ssr/entry-server.js';
import { clipDescription, pageMetadata, renderHead, serializeJson, toProductSlug } from '../src/utils/seo.js';
import pageHandler from '../api/page.js';
import sitemapHandler from '../api/sitemap.js';

const products = Array.from({ length: 30 }, (_, i) => ({ id: String(100 + i), name: `Logitech Mouse ${i}`, description: 'Wireless mouse\noffice price (5$)', category: 'Mice', brand: 'Logitech', images: ['/itlandlogo.png'], price: 20, in_stock: i === 0 ? null : i !== 1, stock_on_hand: i === 0 ? null : i === 1 ? 0 : 10, wholesale_price: 5 }));
const snapshot = { rate: 1500, asOf: new Date().toISOString(), provider: 'IQWealth Baghdad market' };
const schemas = head => [...head.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].flatMap(match => JSON.parse(match[1]));
const response = () => ({ headers: {}, code: 200, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, send(body) { this.body = body; return this; }, end() { return this; }, redirect(code, path) { this.code = code; this.location = path; return this; } });

test('public pages render actual content and unique metadata without JavaScript', () => {
    const titles = new Set();
    for (const path of ['/', '/products', '/about', '/contact', '/help/delivery', '/help/warranty', '/help/returns']) {
        const page = renderPage(path, products, snapshot);
        assert.equal(page.status, 200);
        assert.match(page.body, /<h1/);
        assert.match(page.head, new RegExp(`rel="canonical" href="https://itlandforcomputer.com${path}"`));
        titles.add(page.head.match(/<title>(.*?)<\/title>/)[1]);
    }
    assert.equal(titles.size, 7);
    assert.equal(schemas(renderPage('/', products).head)[0]['@type'], 'Organization');
    // The store's address, map pin and hours match its Google Maps listing.
    for (const path of ['/', '/contact']) {
        const store = schemas(renderPage(path, products).head).find(item => item['@type'] === 'ComputerStore');
        assert.equal(store.address.streetAddress, 'Muzaffariya Street');
        assert.deepEqual(store.geo, { '@type': 'GeoCoordinates', latitude: 36.1899364, longitude: 44.0033506 });
        assert.equal(store.openingHoursSpecification.length, 2);
        assert.ok(!store.openingHoursSpecification.some(spec => spec.dayOfWeek.includes('Friday')));
    }
    assert.match(renderPage('/contact', products).body, /Muzaffariya Street/);
});

test('category pagination has distinct metadata, content and crawlable links', () => {
    const page = renderPage('/products?category=Mice&page=2', products, snapshot);
    assert.match(page.head, /Mice in Iraq - Page 2/);
    assert.match(page.head, /category=Mice&amp;page=2/);
    // Only page 1 is indexed, so a brand or category search lands on it, not on
    // a later page of sold-out items; later pages still pass on their links.
    assert.match(page.head, /content="noindex, follow"/);
    const first = renderPage('/products?category=Mice', products, snapshot);
    assert.match(first.head, /content="index, follow/);
    assert.match(first.body, /Shop mice from Logitech at IT Land in Erbil/);
    assert.match(page.body, /href="\/products\?category=Mice&amp;page=3"/);
    // Out-of-stock products sort last, so page 2 starts after twelve available ones.
    assert.match(page.body, /href="\/product\/logitech-mouse-13-113"/);
    assert.match(renderPage('/products?category=Mice&page=3', products, snapshot).body, /href="\/product\/logitech-mouse-1-101"/);
    assert.doesNotMatch(page.body, />All Products</);
    assert.match(renderPage('/products?category=Keyboards', products).head, /noindex, follow/);
    assert.match(renderPage('/products?page=999', products).head, /noindex, follow/);
});

test('product markup uses public price, accurate availability, breadcrumbs and canonical slug', () => {
    const path = `/product/${toProductSlug(products[0])}`;
    const page = renderPage(path, products, snapshot);
    const schema = schemas(page.head);
    assert.equal(schema[0]['@type'], 'Product');
    assert.equal(schema[0].offers.priceCurrency, 'IQD');
    assert.equal(schema[0].offers.price, '30000');
    assert.equal(schema[0].offers.availability, undefined);
    assert.equal(schema[1]['@type'], 'BreadcrumbList');
    assert.doesNotMatch(page.data, /office price|wholesale_price/);
    assert.equal(schemas(renderPage(`/product/${toProductSlug(products[1])}`, products, snapshot).head)[0].offers.availability, 'https://schema.org/OutOfStock');
    assert.equal(schemas(renderPage(path, products).head)[0].offers, undefined);
    assert.deepEqual(renderPage('/product/old-name-100', products), { status: 301, redirect: path });
    assert.match(page.head, /<title>Logitech Mouse 0 Price in Iraq \| IT Land<\/title>/);
    assert.match(page.head, /price in Iraq: 30,000 IQD at IT Land, Erbil/);
    assert.deepEqual(schema[1].itemListElement.map(item => item.name), ['Home', 'Shop', 'Mice', 'Logitech Mouse 0']);
    assert.match(page.body, /href="\/products\?category=Mice"/);
    const partNumbered = { ...products[2], id: '999', name: 'Logitech M705 Marathon Mouse 910-001935 – Long Battery Life' };
    const partSchema = schemas(renderPage(`/product/${toProductSlug(partNumbered)}`, [...products, partNumbered], snapshot).head)[0];
    assert.equal(partSchema.mpn, '910-001935');
    // Related products are crawlable links in the first response; sold-out ones are left out.
    assert.match(page.body, /Related products/);
    assert.match(page.body, /href="\/product\/logitech-mouse-2-102"/);
    assert.doesNotMatch(page.body.split('Related products')[1], /href="\/product\/logitech-mouse-1-101"/);
    assert.equal(JSON.parse(page.data).related.length, 8);
});

test('app legal pages render in English, Arabic and Kurdish without JavaScript', () => {
    for (const path of ['/app/privacy', '/app/terms', '/app/delete-account']) {
        const page = renderPage(path, []);
        assert.equal(page.status, 200);
        assert.match(page.body, /<h1/);
        assert.match(page.body, /Last updated: 8 November 2026/);
        assert.match(page.body, /info@itlandforcomputer\.com/);
        assert.match(page.head, new RegExp(`rel="canonical" href="https://itlandforcomputer.com${path}"`));
        assert.match(page.head, /content="index, follow/);
        for (const [code, lang] of [['ar', 'ar'], ['ku', 'ckb']]) {
            const translated = renderPage(`${path}?lang=${code}`, []);
            assert.equal(translated.status, 200);
            assert.match(translated.body, new RegExp(`class="lgl-page" lang="${lang}" dir="rtl"`));
            assert.match(translated.head, new RegExp(`rel="canonical" href="https://itlandforcomputer.com${path}\\?lang=${code}"`));
        }
    }
    assert.match(renderPage('/app/privacy', []).body, /href="\/app\/delete-account"/);
    assert.match(renderPage('/app/privacy?lang=ar', []).body, /href="\/app\/delete-account\?lang=ar"/);
    assert.match(renderPage('/app/terms', []).body, /5,000 IQD/);
    assert.equal(renderPage('/app/missing', []).status, 404);
});

test('missing pages and products return 404 and noindex', () => {
    for (const path of ['/missing', '/help/missing', '/product/missing-999']) {
        const page = renderPage(path, products);
        assert.equal(page.status, 404);
        assert.match(page.head, /noindex, follow/);
    }
});

test('metadata resets defaults and safely escapes HTML and inline JSON', () => {
    const first = renderHead(pageMetadata({ title: '"><script>alert(1)</script>', image: '/test.png' }));
    assert.doesNotMatch(first, /<script>alert/);
    const second = pageMetadata({ title: 'About' });
    assert.equal(second.image, 'https://itlandforcomputer.com/itland-share.png');
    assert.match(second.description, /Erbil/);
    assert.ok(!serializeJson({ name: '</script><script>alert(1)</script>' }).includes('</script>'));
});

test('HTTP rendering, authentication exclusions and sitemap handle live data and upstream failures', async () => {
    const oldFetch = globalThis.fetch;
    const oldEnv = { ...process.env };
    try {
        globalThis.fetch = async () => { throw new Error('Unavailable'); };
        delete process.env.ZOHO_ORG_ID;
        const failed = response();
        await pageHandler({ method: 'GET', url: '/products', query: {} }, failed);
        assert.equal(failed.code, 503);
        assert.equal(failed.headers['Retry-After'], '300');
        process.env.ZOHO_ORG_ID = 'test';
        process.env.ZOHO_REFRESH_TOKEN = 'test';
        globalThis.fetch = async url => {
            if (String(url).includes('/oauth/')) return { json: async () => ({ access_token: 'test', expires_in: 3600 }) };
            if (String(url).includes('/books/')) return { ok: true, json: async () => ({ code: 0, items: products.map(p => ({ item_id: p.id, name: p.name, description: p.description, rate: p.price, product_type: 'goods', stock_on_hand: p.stock_on_hand, custom_fields: p.id === '100' ? [{ label: 'Image URL', value: '/itlandlogo.png' }] : [] })), page_context: {} }) };
            throw new Error('Rate unavailable');
        };
        const rendered = response();
        await pageHandler({ method: 'GET', url: '/api/page?__path=/products', query: { __path: '/products' } }, rendered);
        assert.equal(rendered.code, 200);
        assert.match(rendered.body, /<div id="root">[\s\S]*?<div class="app-container"/);
        assert.match(rendered.body, /id="itland-page-data"/);
        assert.equal((rendered.body.match(/rel="canonical"/g) || []).length, 1);
        assert.match(rendered.body, /href="https:\/\/itlandforcomputer.com\/products"/);
        const admin = response();
        await pageHandler({ method: 'GET', url: '/admin/login', query: {} }, admin);
        assert.equal(admin.headers['X-Robots-Tag'], 'noindex, nofollow');
        // The video conferencing page is sent with its products, not an empty shell.
        const meetings = response();
        await pageHandler({ method: 'GET', url: '/video-conferencing', query: {} }, meetings);
        assert.equal(meetings.code, 200);
        assert.match(meetings.body, /"products":\[\{/);
        const missing = response();
        await pageHandler({ method: 'GET', url: '/missing', query: {} }, missing);
        assert.equal(missing.code, 404);
        const sitemap = response();
        await sitemapHandler({}, sitemap);
        assert.equal(sitemap.code, 200);
        assert.match(sitemap.body, /\/help\/delivery/);
        assert.match(sitemap.body, /\/video-conferencing<\/loc>/);
        assert.match(sitemap.body, /\/app\/privacy<\/loc>[\s\S]*\/app\/terms<\/loc>[\s\S]*\/app\/delete-account<\/loc>/);
        assert.match(sitemap.body, /\/brands\/logitech/);
        assert.match(sitemap.body, /\/products\?category=Mice/);
        assert.match(sitemap.body, /\/product\/logitech-mouse-0-100<\/loc>(<xhtml:link[^>]*\/>)+<image:image><image:loc>https:\/\/itlandforcomputer.com\/itlandlogo.png<\/image:loc>/);
        // Each store page is listed in all three languages, every entry naming the others.
        assert.match(sitemap.body, /<loc>https:\/\/itlandforcomputer.com\/ar\/products<\/loc><xhtml:link rel="alternate" hreflang="en" href="https:\/\/itlandforcomputer.com\/products"\/><xhtml:link rel="alternate" hreflang="ar" href="https:\/\/itlandforcomputer.com\/ar\/products"\/><xhtml:link rel="alternate" hreflang="ckb" href="https:\/\/itlandforcomputer.com\/ku\/products"\/><xhtml:link rel="alternate" hreflang="x-default" href="https:\/\/itlandforcomputer.com\/products"\/>/);
        assert.match(sitemap.body, /<loc>https:\/\/itlandforcomputer.com\/ku<\/loc>/);
        assert.match(sitemap.body, /<loc>https:\/\/itlandforcomputer.com\/ku\/product\/logitech-mouse-0-100<\/loc>/);
        assert.doesNotMatch(sitemap.body, /\/(ar|ku)\/app\//);
        // The server marks the page's language and direction on the <html> tag.
        const arabic = response();
        await pageHandler({ method: 'GET', url: '/ar/products', query: {} }, arabic);
        assert.equal(arabic.code, 200);
        assert.match(arabic.body, /<html lang="ar" dir="rtl">/);
        assert.match(arabic.body, /"products":\[\{/);
        assert.match(rendered.body, /<html lang="en" dir="ltr">/);
        const arabicAdmin = response();
        await pageHandler({ method: 'GET', url: '/ar/admin/login', query: {} }, arabicAdmin);
        assert.equal(arabicAdmin.headers['X-Robots-Tag'], 'noindex, nofollow');
        assert.doesNotMatch(sitemap.body, /<lastmod>|\/admin\/|\/wholesale\//);
    } finally {
        globalThis.fetch = oldFetch;
        process.env = oldEnv;
    }
});


test('every page type gives search engines a full title, description, breadcrumb trail and social preview', () => {
    const trail = path => schemas(renderPage(path, products, snapshot).head).find(item => item['@type'] === 'BreadcrumbList')?.itemListElement.map(item => item.name);
    assert.deepEqual(trail('/products'), ['Home', 'Shop']);
    assert.deepEqual(trail('/products?category=Mice'), ['Home', 'Shop', 'Mice']);
    assert.deepEqual(trail('/brands/logitech'), ['Home', 'Shop', 'Logitech']);
    assert.deepEqual(trail('/about'), ['Home', 'About']);
    assert.deepEqual(trail('/contact'), ['Home', 'Contact']);
    assert.deepEqual(trail('/help/delivery'), ['Home', 'Delivery & WhatsApp orders']);
    assert.deepEqual(schemas(renderPage('/about', products).head).map(item => item['@type']), ['AboutPage', 'ComputerStore', 'BreadcrumbList']);
    assert.equal(schemas(renderPage('/contact', products).head)[0]['@type'], 'ContactPage');

    const descriptions = new Set();
    for (const path of ['/', '/products', '/products?category=Mice', '/brands/logitech', '/video-conferencing', '/about', '/contact', '/help/delivery', '/help/warranty', '/help/returns', `/product/${toProductSlug(products[0])}`]) {
        const head = renderPage(path, products, snapshot).head;
        const title = head.match(/<title>(.*?)<\/title>/)[1].replace(/&amp;/g, '&');
        const description = head.match(/name="description" content="(.*?)"/)[1];
        assert.ok(title.length >= 30 && title.length <= 70, `${path} title length ${title.length}: ${title}`);
        assert.ok(description.length >= 110 && description.length <= 161, `${path} description length ${description.length}`);
        assert.match(head, /property="og:image" content="https:\/\//);
        assert.match(head, /property="og:locale" content="en_US"/);
        descriptions.add(description);
    }
    assert.equal(descriptions.size, 11);
    assert.match(renderPage('/products?category=Mice', products, snapshot).head, /<title>Computer Mice in Iraq: Prices &amp; Stock \| IT Land<\/title>/);
    assert.match(renderPage(`/product/${toProductSlug(products[0])}`, products, snapshot).head, /property="og:type" content="product"/);
    // A long catalog name is shortened so "Price in Iraq" still fits in a search result.
    const long = { ...products[2], id: '998', name: 'Logitech Keys S Combo 920-011889 Performance Combo MX Master 3S, MX keys S MX Palm rest English' };
    const longTitle = renderPage(`/product/${toProductSlug(long)}`, [...products, long], snapshot).head.match(/<title>(.*?)<\/title>/)[1];
    assert.equal(longTitle, 'Logitech Keys S Combo 920-011889 Price in Iraq | IT Land');
    assert.ok(longTitle.length <= 70, longTitle);
    // The home page's main heading carries the store line as well as the headline.
    assert.match(renderPage('/', products).body.match(/<h1[^>]*>(.*?)<\/h1>/s)[1].replace(/<[^>]+>/g, ''), /Computer store in Erbil\s+Everything for your desk/);
    // Descriptions end on a whole sentence or word, never mid-word.
    assert.equal(clipDescription('One short sentence.'), 'One short sentence.');
    assert.equal(clipDescription(`${'A full sentence that is long enough to keep. '.repeat(3)}And a last one that will not fit in the space that is left over.`), 'A full sentence that is long enough to keep. '.repeat(3).trim());
    assert.match(clipDescription('word '.repeat(60)), /word…$/);
});

test('Arabic and Kurdish pages have their own addresses, translated titles and links that keep the language', () => {
    const site = 'https://itlandforcomputer.com';
    const english = renderPage('/products?category=Mice', products, snapshot);
    const productPath = `/product/${toProductSlug(products[0])}`;
    for (const [prefix, lang] of [['/ar', 'ar'], ['/ku', 'ckb']]) {
        const page = renderPage(`${prefix}/products?category=Mice`, products, snapshot);
        assert.equal(page.status, 200);
        assert.deepEqual([page.lang, page.dir], [lang, 'rtl']);
        assert.match(page.head, new RegExp(`rel="canonical" href="${site}${prefix}/products\\?category=Mice"`));
        for (const [code, href] of [['en', '/products?category=Mice'], ['ar', '/ar/products?category=Mice'], ['ckb', '/ku/products?category=Mice'], ['x-default', '/products?category=Mice']]) {
            assert.ok(page.head.includes(`<link rel="alternate" hreflang="${code}" href="${site}${href}" />`), `${prefix} lists ${code}`);
        }
        // The title and description are in the page's language, not copies of the English ones.
        const title = text => text.match(/<title>(.*?)<\/title>/)[1];
        const description = text => text.match(/name="description" content="(.*?)"/)[1];
        assert.notEqual(title(page.head), title(english.head));
        assert.notEqual(description(page.head), description(english.head));
        assert.doesNotMatch(title(page.head) + description(page.head), /[{}]/);
        // Every link on the page stays in the same language.
        const links = [...page.body.matchAll(/<a\b[^>]*href="(\/[^"]*)"/g)].map(match => match[1]);
        assert.ok(links.length > 20);
        assert.deepEqual(links.filter(href => href !== prefix && !href.startsWith(`${prefix}/`) && !href.startsWith(`${prefix}?`)), []);
        // Product pages: address, structured data and breadcrumbs all use the language's address.
        const product = renderPage(`${prefix}${productPath}`, products, snapshot);
        assert.match(product.head, new RegExp(`rel="canonical" href="${site}${prefix}${productPath}"`));
        const [schema, trail] = schemas(product.head);
        assert.equal(schema.url, `${site}${prefix}${productPath}`);
        assert.equal(schema.offers.url, `${site}${prefix}${productPath}`);
        assert.equal(schema.offers.seller['@id'], `${site}/#store`);
        assert.deepEqual(trail.itemListElement.map(item => item.item), [`${site}${prefix}`, `${site}${prefix}/products`, `${site}${prefix}/products?category=Mice`, `${site}${prefix}${productPath}`]);
        assert.notEqual(trail.itemListElement[0].name, 'Home');
        assert.equal(trail.itemListElement[3].name, 'Logitech Mouse 0');
        assert.notEqual(title(product.head), title(renderPage(productPath, products, snapshot).head));
        // An old product address keeps its language when it is redirected.
        assert.deepEqual(renderPage(`${prefix}/product/old-name-100`, products), { status: 301, redirect: `${prefix}${productPath}` });
        // The home page of each language, and pages that are not indexed.
        const home = renderPage(prefix, products, snapshot);
        assert.match(home.head, new RegExp(`rel="canonical" href="${site}${prefix}"`));
        assert.match(home.body, /<h1/);
        assert.doesNotMatch(renderPage(`${prefix}/products?page=2`, products, snapshot).head, /hreflang/);
        assert.equal(renderPage(`${prefix}/nope`, products).status, 404);
        // The app's legal pages have one address only.
        assert.deepEqual(renderPage(`${prefix}/app/privacy`, products), { status: 301, redirect: '/app/privacy' });
        for (const path of ['/about', '/contact', '/help/delivery', '/video-conferencing', '/brands/logitech']) {
            const other = renderPage(`${prefix}${path}`, products, snapshot);
            assert.equal(other.status, 200, `${prefix}${path}`);
            assert.notEqual(title(other.head), title(renderPage(path, products, snapshot).head), `${prefix}${path} title is translated`);
            assert.doesNotMatch(title(other.head) + description(other.head), /[{}]/);
        }
    }
    // English pages name their translations too; pages outside the store do not.
    assert.match(english.head, /hreflang="ckb" href="https:\/\/itlandforcomputer.com\/ku\/products\?category=Mice"/);
    assert.doesNotMatch(renderPage('/app/privacy', products).head, /hreflang/);
    assert.match(english.head, /property="og:locale" content="en_US"/);
    assert.match(renderPage('/ar', products).head, /property="og:locale" content="ar_IQ"/);
});

test('brand landing pages are rendered, linked, paginated and canonical', () => {
    const page = renderPage('/brands/logitech', products, snapshot);
    assert.equal(page.status, 200);
    assert.match(page.head, /Logitech Products in Iraq/);
    assert.match(page.head, /href="https:\/\/itlandforcomputer.com\/brands\/logitech"/);
    assert.match(page.head, /content="index, follow/);
    assert.match(page.body, /lang="ar" dir="rtl"/);
    assert.match(page.body, /href="\/brands\/logitech\?page=2"/);
    assert.match(page.body, /href="\/brands\/logitech\?category=Mice"/);
    assert.equal(schemas(page.head)[0]['@type'], 'CollectionPage');
    const secondPage = renderPage('/brands/logitech?page=2', products, snapshot);
    assert.match(secondPage.body, /logitech-mouse-13-113/);
    assert.match(secondPage.head, /content="noindex, follow"/);
    assert.match(renderPage('/', products, snapshot).body, /href="\/brands\/logitech"/);
    assert.match(renderPage('/product/logitech-mouse-0-100', products, snapshot).body, /href="\/brands\/logitech"/);
    const missing = renderPage('/brands/nonexistent', products, snapshot);
    assert.equal(missing.status, 404);
    assert.match(missing.head, /noindex, follow/);
    assert.match(renderPage('/brands/logitech?category=Keyboards', products, snapshot).head, /noindex, follow/);
    assert.match(renderPage('/wp-admin/', products, snapshot).head, /noindex, follow/);
    assert.equal(renderPage('/wp-admin/', products, snapshot).status, 404);
});

test('video conferencing page is rendered with its products, schema, links and sitemap entry', () => {
    const catalog = [...products,
        { id: '900', name: 'Logitech Rally Bar Video Conferencing Bar 960-001312 Graphite', description: '', category: 'goods', images: ['https://resource.logitech.com/rally-bar.png'], price: 3600, in_stock: true, stock_on_hand: 2 },
        { id: '901', name: '960-001057', description: '960-001057', category: 'goods', images: ['/itlandlogo.png'], price: 900, in_stock: true, stock_on_hand: 1 },
        { id: '902', name: 'Jabra Speak2 40 Portable Speakerphone', description: '', category: 'goods', images: ['/itlandlogo.png'], price: 170, in_stock: false, stock_on_hand: 0 }];
    const page = renderPage('/video-conferencing', catalog, snapshot);
    assert.equal(page.status, 200);
    assert.match(page.head, /<title>Video Conferencing Equipment in Erbil, Iraq \| IT Land<\/title>/);
    assert.match(page.head, /rel="canonical" href="https:\/\/itlandforcomputer.com\/video-conferencing"/);
    assert.match(page.head, /content="index, follow/);
    assert.match(page.body, /<h1[^>]*>Video Conferencing Equipment in Erbil, Iraq<\/h1>/);
    // A listing named with only a Logitech part number is shown under the product's name.
    assert.match(page.body, /Logitech GROUP Video Conferencing System/);
    assert.match(page.body, /href="\/product\/logitech-rally-bar-video-conferencing-bar-960-001312-graphite-900"/);
    assert.doesNotMatch(page.body, /logitech-mouse-0-100/);
    const types = schemas(page.head).map(item => item['@type']);
    assert.deepEqual(types, ['CollectionPage', 'BreadcrumbList', 'FAQPage']);
    const list = schemas(page.head)[0].mainEntity;
    assert.equal(list.numberOfItems, 3);
    assert.equal(list.itemListElement[0].url, 'https://itlandforcomputer.com/product/logitech-rally-bar-video-conferencing-bar-960-001312-graphite-900');
    // Every question shown on the page is in the FAQ schema.
    const faq = schemas(page.head)[2].mainEntity;
    assert.ok(faq.length >= 5);
    for (const { name } of faq) assert.ok(page.body.includes(name.replace(/'/g, '&#x27;')), name);
    // Linked from the home page and every page's navigation.
    assert.match(renderPage('/', catalog, snapshot).body, /href="\/video-conferencing"/);
    assert.match(renderPage('/about', catalog, snapshot).body, /href="\/video-conferencing"/);
});
