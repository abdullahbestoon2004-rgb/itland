import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from '../dist-ssr/entry-server.js';
import { pageMetadata, renderHead, serializeJson, toProductSlug } from '../src/utils/seo.js';
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
});

test('category pagination has distinct metadata, content and crawlable links', () => {
    const page = renderPage('/products?category=Mice&page=2', products, snapshot);
    assert.match(page.head, /Mice in Iraq - Page 2/);
    assert.match(page.head, /category=Mice&amp;page=2/);
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
    assert.equal(second.image, 'https://itlandforcomputer.com/itlandlogo.png');
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
            if (String(url).includes('/books/')) return { ok: true, json: async () => ({ code: 0, items: products.map(p => ({ item_id: p.id, name: p.name, description: p.description, rate: p.price, product_type: 'goods', stock_on_hand: p.stock_on_hand, custom_fields: [] })), page_context: {} }) };
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
        const missing = response();
        await pageHandler({ method: 'GET', url: '/missing', query: {} }, missing);
        assert.equal(missing.code, 404);
        const sitemap = response();
        await sitemapHandler({}, sitemap);
        assert.equal(sitemap.code, 200);
        assert.match(sitemap.body, /\/help\/delivery/);
        assert.match(sitemap.body, /\/brands\/logitech/);
        assert.match(sitemap.body, /\/products\?category=Mice/);
        assert.match(sitemap.body, /\/product\/logitech-mouse-0-100/);
        assert.doesNotMatch(sitemap.body, /<lastmod>|\/admin\/|\/wholesale\//);
    } finally {
        globalThis.fetch = oldFetch;
        process.env = oldEnv;
    }
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
    assert.match(renderPage('/brands/logitech?page=2', products, snapshot).body, /logitech-mouse-13-113/);
    assert.match(renderPage('/', products, snapshot).body, /href="\/brands\/logitech"/);
    assert.match(renderPage('/product/logitech-mouse-0-100', products, snapshot).body, /href="\/brands\/logitech"/);
    const missing = renderPage('/brands/nonexistent', products, snapshot);
    assert.equal(missing.status, 404);
    assert.match(missing.head, /noindex, follow/);
    assert.match(renderPage('/brands/logitech?category=Keyboards', products, snapshot).head, /noindex, follow/);
    assert.match(renderPage('/wp-admin/', products, snapshot).head, /noindex, follow/);
    assert.equal(renderPage('/wp-admin/', products, snapshot).status, 404);
});
