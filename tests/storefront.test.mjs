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
