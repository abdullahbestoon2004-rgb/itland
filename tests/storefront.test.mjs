import test from 'node:test';
import assert from 'node:assert/strict';
import { stockLimit, isOutOfStock, cleanDescription, cleanProductName, homeProducts, orderMessage, whatsappLink } from '../src/utils/storefront.js';
import { parseMarketRate, isFreshRate, formatIqd, MAX_RATE_AGE } from '../src/utils/currency.js';

const now = Date.now();
const market = { kind: 'fx', unit: 'IQD per 1 USD', generatedAt: new Date(now).toISOString(), parallel: { stale: false, buy: 1500, sell: 1520, publishedAt: new Date(now).toISOString() } };
const rate = parseMarketRate(market, now);

test('stock rejects explicit unavailable and zero, negative or fractional quantities', () => {
    assert.equal(stockLimit({ in_stock: false, stock_on_hand: 8 }), 0);
    for (const stock_on_hand of [0, -2, '0', 0.5]) assert.equal(isOutOfStock({ in_stock: true, stock_on_hand }), true);
    assert.equal(stockLimit({ stock_on_hand: 2.9 }), 2);
    assert.equal(stockLimit({ stock_on_hand: null }), Infinity);
});

test('public descriptions remove internal prices without stripping useful product specs', () => {
    assert.equal(cleanDescription('USB-C cable office price (5$)\nLength: 2m\nWholesale price: $8'), 'USB-C cable\nLength: 2m');
    assert.equal(cleanDescription('Price-performance keyboard\nUSB-C 3.2, 100W'), 'Price-performance keyboard\nUSB-C 3.2, 100W');
    assert.equal(cleanProductName({ name: '1234567', description: 'Logitech Mouse\nOffice price $5' }), 'Logitech Mouse');
    assert.ok(cleanProductName({ name: 'Logitech '.repeat(30) }).length <= 120);
});

test('homepage shows available selections without presenting unselected items as best sellers', () => {
    const products = [{ id: 1, featured: true, price: 10, in_stock: false }, { id: 2, price: 20, stock_on_hand: 3 }];
    assert.deepEqual(homeProducts(products), { featured: false, products: [products[1]] });
    assert.equal(homeProducts([{ ...products[1], featured: true }]).featured, true);
    assert.equal(homeProducts(Array.from({ length: 20 }, (_, id) => ({ id, price: 10 }))).products.length, 8);
    const headsets = Array.from({ length: 6 }, (_, id) => ({ id, price: 10, category: 'Headsets' }));
    const mixed = homeProducts([...headsets, { id: 'm', price: 10, category: 'Mice' }, { id: 'k', price: 10, category: 'Keyboards' }]).products;
    assert.deepEqual(mixed.slice(0, 3).map((product) => product.category), ['Headsets', 'Mice', 'Keyboards']);
    assert.equal(mixed.length, 8);
});

test('IQD uses buy/sell midpoint and rejects stale, future, official or malformed observations', () => {
    assert.equal(rate.rate, 1510);
    assert.equal(formatIqd(10, rate), '15,100 IQD');
    for (const altered of [
        { ...market, kind: 'official' },
        { ...market, parallel: { ...market.parallel, stale: true } },
        { ...market, parallel: { ...market.parallel, buy: 1700, sell: 1500 } },
        { ...market, parallel: { ...market.parallel, buy: '1500' } },
        { ...market, parallel: { ...market.parallel, publishedAt: new Date(now - MAX_RATE_AGE - 1).toISOString() } },
        { ...market, generatedAt: new Date(now + 600_000).toISOString() },
    ]) assert.throws(() => parseMarketRate(altered, now));
    assert.equal(isFreshRate({ ...rate, asOf: 'invalid' }), false);
    assert.equal(formatIqd(10, null), null);
});

test('WhatsApp request includes IQD subtotal, delivery details and confirmation boundary', () => {
    const message = orderMessage([{ id: 'abc', name: 'Mouse', price: 10, quantity: 2 }], { name: 'Test Customer', city: 'Erbil', notes: 'Call first' }, rate);
    assert.match(message, /30,200 IQD/);
    assert.match(message, /City \/ area: Erbil/);
    assert.match(message, /Delivery fee: please confirm/);
    assert.match(message, /confirmed only after your reply/);
    const link = new URL(whatsappLink(message));
    assert.equal(link.pathname, '/9647504888570');
    assert.equal(link.searchParams.get('text'), message);
    const missing = orderMessage([{ id: 'a', name: 'Mouse', price: 10, quantity: 1 }]);
    assert.match(missing, /please confirm IQD total/);
    assert.doesNotMatch(missing, /\$10/);
});

const response = () => ({ headers: {}, statusCode: 0, body: '', setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = value; } });
test('currency API caches valid observations and refuses non-GET requests', async (t) => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls++; return { ok: true, json: async () => market }; };
    t.after(() => { globalThis.fetch = original; });
    const { default: handler } = await import('../api/currency.js?test=success');
    for (let i = 0; i < 2; i++) {
        const res = response(); await handler({ method: 'GET' }, res);
        assert.equal(res.statusCode, 200); assert.equal(JSON.parse(res.body).rate, 1510);
    }
    assert.equal(calls, 1);
    const res = response(); await handler({ method: 'POST' }, res);
    assert.equal(res.statusCode, 405); assert.equal(calls, 1);
});
test('currency API fails closed when provider marks a rate stale', async (t) => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ ...market, parallel: { ...market.parallel, stale: true } }) });
    t.after(() => { globalThis.fetch = original; });
    const { default: handler } = await import('../api/currency.js?test=stale');
    const res = response(); await handler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 503); assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(JSON.parse(res.body).rate, undefined);
});

const apiResponse = () => ({ headers: {}, statusCode: 0, body: null, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } });
const zohoItem = { item_id: '4513374000001460273', name: 'Cable', description: 'USB-C cable office price (5$)', rate: 8, stock_on_hand: 3, custom_fields: [{ label: 'Wholesale Price', value: '5' }] };
test('products API hides internal and wholesale prices except from signed wholesale sessions', async (t) => {
    const original = { fetch: globalThis.fetch, env: { ...process.env } };
    Object.assign(process.env, { ZOHO_ORG_ID: 'org', ZOHO_REFRESH_TOKEN: 'refresh', ZOHO_CLIENT_ID: 'id', ZOHO_CLIENT_SECRET: 'secret', WHOLESALE_CLIENTS: JSON.stringify([{ email: 'Shop@Example.com', password: 'pass123', name: 'Shop' }]) });
    globalThis.fetch = async (url) => String(url).includes('/oauth/')
        ? { json: async () => ({ access_token: 'token', expires_in: 3600 }) }
        : { ok: true, status: 200, json: async () => ({ code: 0, items: [zohoItem], page_context: { has_more_page: false } }) };
    t.after(() => { globalThis.fetch = original.fetch; process.env = original.env; });
    const { default: products } = await import('../api/products.js');
    const { default: login } = await import('../api/wholesale-login.js');

    let res = apiResponse(); await products({ method: 'GET', query: {}, headers: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.products[0].description, 'USB-C cable');
    assert.equal('wholesale_price' in res.body.products[0], false);

    res = apiResponse(); await products({ method: 'GET', query: { view: 'wholesale' }, headers: {} }, res);
    assert.equal(res.statusCode, 401);
    res = apiResponse(); await login({ method: 'POST', body: { email: 'shop@example.com', password: 'wrong' }, headers: {} }, res);
    assert.equal(res.statusCode, 401);
    res = apiResponse(); await login({ method: 'POST', body: { email: ' shop@example.com ', password: 'pass123' }, headers: {} }, res);
    assert.equal(res.statusCode, 200);
    const { token } = res.body;

    res = apiResponse(); await products({ method: 'GET', query: { view: 'wholesale' }, headers: { authorization: `Bearer ${token}` } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.products[0].wholesale_price, 5);
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
    res = apiResponse(); await products({ method: 'GET', query: { view: 'wholesale' }, headers: { authorization: `Bearer ${token.slice(0, -2)}xx` } }, res);
    assert.equal(res.statusCode, 401);
    res = apiResponse(); await products({ method: 'GET', query: { view: 'admin' }, headers: { authorization: `Bearer ${token}` } }, res);
    assert.equal(res.statusCode, 401);
});

test('catalog keeps serving the last good list while Zoho fails, without retrying on every request', async (t) => {
    const original = { fetch: globalThis.fetch, env: { ...process.env } };
    Object.assign(process.env, { ZOHO_ORG_ID: 'org', ZOHO_REFRESH_TOKEN: 'refresh' });
    let calls = 0;
    let failing = false;
    globalThis.fetch = async (url) => {
        calls++;
        if (failing) return String(url).includes('/oauth/') ? { json: async () => ({ error: 'Access Denied', error_description: 'too many requests' }) } : { ok: false, status: 500 };
        return String(url).includes('/oauth/') ? { json: async () => ({ access_token: 'token', expires_in: 3600 }) } : { ok: true, status: 200, json: async () => ({ code: 0, items: [zohoItem], page_context: { has_more_page: false } }) };
    };
    t.after(() => { globalThis.fetch = original.fetch; process.env = original.env; });
    const { getCatalog, CatalogUnavailableError } = await import('../server/zoho.js?test=backoff');
    const previous = console.error; console.error = () => {};
    try {
        assert.equal((await getCatalog()).products.length, 1);
        failing = true;
        const before = calls;
        assert.deepEqual(await getCatalog({ refresh: true }).then((result) => [result.stale, result.products.length]), [true, 1]);
        const afterFailure = calls;
        assert.ok(afterFailure > before);
        await getCatalog({ refresh: true });
        assert.equal(calls, afterFailure);

        const { getCatalog: getEmptyCatalog } = await import('../server/zoho.js?test=empty');
        await assert.rejects(() => getEmptyCatalog(), (error) => error instanceof Error && !/too many|Access Denied/.test(error.message));
        assert.ok(CatalogUnavailableError);
    } finally { console.error = previous; }
});
