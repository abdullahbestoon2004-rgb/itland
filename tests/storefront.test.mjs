import test from 'node:test';
import assert from 'node:assert/strict';
import { stockLimit, isOutOfStock, cleanDescription, cleanProductName, homeProducts, shopDay, orderMessage, relatedProducts, whatsappLink } from '../src/utils/storefront.js';
import { parseMarketRate, isFreshRate, formatIqd, formatIqdAmount, iqdTotal, toIqd, MAX_RATE_AGE } from '../src/utils/currency.js';
import { shortProductTitle } from '../src/utils/seo.js';
import { colourOf, withColourVariants } from '../src/utils/colours.js';
import { erbilWeekday, maghribMinutes, maghribTime } from '../src/utils/storeHours.js';
import { ROOM_SIZES, roomSizePicks, videoConferencingGroup, videoConferencingProducts } from '../src/utils/videoConferencing.js';

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

test('related products favour same category and brand, skip sold-out items and repeated listings', () => {
    const item = (id, name, category, brand, price, extra = {}) => ({ id, name, category, brand, price, images: ['/x.png'], in_stock: true, ...extra });
    const product = item('1', 'Logitech G502 X Plus Gaming Mouse', 'Mice', 'Logitech', 140);
    const catalog = [
        product,
        item('2', 'Razer Viper Mouse', 'Mice', 'Razer', 90),
        item('3', 'Logitech M90 Mouse', 'Mice', 'Logitech', 8),
        item('4', 'Logitech G502 Hero Gaming Mouse', 'Mice', 'Logitech', 50),
        item('5', 'Logitech G502 Hero Gaming Mouse', 'Mice', 'Logitech', 50),
        item('6', 'Logitech G Pro Mouse', 'Mice', 'Logitech', 130, { in_stock: false }),
        item('7', 'Logitech K380 Keyboard', 'Keyboards', 'Logitech', 40),
        item('8', 'Onten HDMI Cable', 'Accessories', 'Onten', 10),
        item('9', 'Logitech MX Master 3S Mouse', 'Mice', 'Logitech', 120),
    ];
    assert.deepEqual(relatedProducts(product, catalog).map((related) => related.id), ['4', '9', '2', '3', '7']);
    assert.equal(relatedProducts(product, catalog, 2).length, 2);
    assert.deepEqual(relatedProducts(null, catalog), []);
});

test('search titles keep the model and colour of long catalog names', () => {
    assert.equal(shortProductTitle('Logitech M705 Marathon Wireless Mouse 910-001935 – Long 3 Year Battery Life Ergonomic Sculpted'), 'Logitech M705 Marathon Wireless Mouse 910-001935');
    assert.equal(shortProductTitle('Logitech G502 X PLUS LIGHTSPEED Wireless RGB Gaming Mouse 910-006169 White'), 'Logitech G502 X PLUS LIGHTSPEED Wireless RGB Gaming Mouse White');
    assert.equal(shortProductTitle('Plantronics Poly Blackwire 3310 MS USB-A - Wired, Single Ear (Mono) Headset'), 'Plantronics Poly Blackwire 3310 MS USB-A');
    assert.equal(shortProductTitle('Jabra 510 UC+Link 370'), 'Jabra 510 UC+Link 370');
    assert.ok(shortProductTitle('Logitech '.repeat(20)).length <= 60);
});

test('IQD uses buy/sell midpoint and rejects stale, future, official or malformed observations', () => {
    assert.equal(rate.rate, 1510);
    // 10 USD at 1,510 is 15,100, shown as the nearest 250.
    assert.equal(formatIqd(10, rate), '15,000 IQD');
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

test('the shop closes at Maghrib in Erbil, which follows the seasons', () => {
    const at = (date, time = '09:00') => Date.parse(`${date}T${time}:00Z`);
    // Within a minute of the published Erbil timetable for these days.
    const published = { '2026-11-14': '16:57', '2026-12-21': '16:53', '2027-03-20': '18:15', '2027-06-21': '19:25' };
    for (const [date, expected] of Object.entries(published)) {
        const [hours, minutes] = expected.split(':').map(Number);
        assert.ok(Math.abs(maghribMinutes(at(date)) - (hours * 60 + minutes)) <= 1, `${date}: ${maghribTime(at(date))} vs ${expected}`);
    }
    // Earliest in December, latest in June, and never outside 16:45 to 19:30.
    const year = Array.from({ length: 365 }, (_, day) => maghribMinutes(at('2027-01-01') + day * 86_400_000));
    assert.ok(Math.min(...year) >= 16 * 60 + 45 && Math.max(...year) <= 19 * 60 + 30);
    assert.match(maghribTime(at('2027-06-21')), /^19:2\d$/);
    // The day is Erbil's: 22:00 UTC on Thursday is already Friday there.
    assert.equal(erbilWeekday(at('2026-11-12', '20:59')), 'Thursday');
    assert.equal(erbilWeekday(at('2026-11-12', '21:00')), 'Friday');
    assert.equal(maghribTime(at('2026-11-14', '00:30')), maghribTime(at('2026-11-14', '20:00')));
});

test('IQD prices are rounded to the nearest 250, and totals equal their lines added up', () => {
    const at = snapshotRate => ({ ...rate, rate: snapshotRate });
    assert.equal(toIqd(30, at(1694.5)), 50750);       // 50,835
    assert.equal(toIqd(100, at(1694.5)), 169500);     // 169,450
    assert.equal(toIqd(75, at(1694.5)), 127000);      // 127,087.5
    assert.equal(toIqd(120, at(1694.5)), 203250);     // 203,340
    assert.equal(toIqd(0.25, at(1500)), 500);         // 375 is halfway and rounds up
    for (const usd of [1, 7.5, 19.99, 45, 333]) assert.equal(toIqd(usd, at(1694.5)) % 250, 0);
    assert.equal(toIqd(10, null), null);
    // Two of a 50,835 item cost 2 x 50,750, not 101,670 rounded on its own.
    assert.equal(formatIqd(30, at(1694.5), 2), '101,500 IQD');
    const cart = [{ price: 30, quantity: 2 }, { price: 100, quantity: 1 }];
    assert.equal(iqdTotal(cart, at(1694.5)), 101500 + 169500);
    assert.equal(formatIqdAmount(iqdTotal(cart, at(1694.5))), '271,000 IQD');
    assert.equal(formatIqdAmount(iqdTotal(cart, null)), null);
});

test('WhatsApp request includes IQD subtotal, delivery details and confirmation boundary', () => {
    const message = orderMessage([{ id: 'abc', name: 'Mouse', price: 10, quantity: 2 }], { name: 'Test Customer', city: 'Erbil', notes: 'Call first' }, rate);
    assert.match(message, /30,000 IQD/);
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

test('admin catalog access needs an admin_users row and a two-step (aal2) session', async (t) => {
    const original = { fetch: globalThis.fetch, env: { ...process.env } };
    Object.assign(process.env, { SUPABASE_URL: 'https://db.example.co', SUPABASE_PUBLISHABLE_KEY: 'public-key' });
    const requests = [];
    let rows = [{ email: 'owner@example.com' }];
    globalThis.fetch = async (url, init) => {
        requests.push({ url: String(url), auth: init?.headers?.Authorization });
        return { ok: true, status: 200, json: async () => rows };
    };
    t.after(() => { globalThis.fetch = original.fetch; process.env = original.env; });
    const { isAdminToken } = await import('../server/access.js');
    const jwt = (claims) => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;

    assert.equal(await isAdminToken(jwt({ aal: 'aal1', email: 'owner@example.com' })), false);
    assert.equal(await isAdminToken(jwt({ email: 'owner@example.com' })), false);
    assert.equal(await isAdminToken('not-a-jwt'), false);
    assert.equal(requests.length, 0);

    const verified = jwt({ aal: 'aal2', email: 'owner@example.com' });
    assert.equal(await isAdminToken(verified), true);
    assert.equal(requests.at(-1).url, 'https://db.example.co/rest/v1/admin_users?select=email&limit=1');
    assert.equal(requests.at(-1).auth, `Bearer ${verified}`);
    rows = [];
    assert.equal(await isAdminToken(verified), false);
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

test('products new in Zoho without a photo get no stand-in photo', async (t) => {
    const original = { fetch: globalThis.fetch, env: { ...process.env } };
    Object.assign(process.env, { ZOHO_ORG_ID: 'org', ZOHO_REFRESH_TOKEN: 'refresh' });
    const items = [
        { item_id: '999000000000000001', name: 'Dell Thunderbolt 4 USB-C to USB-C Cable', rate: 30, custom_fields: [] },
        { item_id: '999000000000000002', name: 'Poly Blackwire 5220', rate: 100, custom_fields: [{ label: 'Image URL', value: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800' }] },
        { item_id: '999000000000000003', name: 'Logitech M171', rate: 8, custom_fields: [{ label: 'Image URL', value: 'https://example.com/m171.jpg' }] },
    ];
    globalThis.fetch = async (url) => String(url).includes('/oauth/')
        ? { json: async () => ({ access_token: 'token', expires_in: 3600 }) }
        : { ok: true, status: 200, json: async () => ({ code: 0, items, page_context: { has_more_page: false } }) };
    t.after(() => { globalThis.fetch = original.fetch; process.env = original.env; });
    const { getCatalog } = await import('../server/zoho.js?test=photos');
    const { products } = await getCatalog();
    assert.deepEqual(products.map((product) => product.images), [[], [], ['https://example.com/m171.jpg']]);
});

test('home page prefers products with a photo and keeps Zoho featured order', () => {
    const bare = { id: 'a', price: 10, category: 'Mice' };
    const photo = { id: 'b', price: 10, category: 'Mice', images: ['/b.png'] };
    assert.deepEqual(homeProducts([bare, photo]).products.map(p => p.id), ['b', 'a']);
    assert.deepEqual(homeProducts([{ ...bare, featured: true }, { ...photo, featured: true }]).products.map(p => p.id), ['a', 'b']);
});

test('home page picks change every day, stay the same within a day and cover the whole catalog', () => {
    const catalog = ['Mice', 'Keyboards', 'Headsets', 'Webcams'].flatMap(category => Array.from({ length: 10 }, (_, n) => ({ id: `${category}-${n}`, price: 10, category, images: ['/x.png'] })));
    const ids = day => homeProducts(catalog, day).products.map(product => product.id);
    assert.deepEqual(ids(100), ids(100));
    assert.equal(ids(100).length, 8);
    assert.equal(ids(100).filter(id => ids(101).includes(id)).length, 0);
    assert.deepEqual(homeProducts(catalog, 100).products.slice(0, 4).map(product => product.category), ['Mice', 'Keyboards', 'Headsets', 'Webcams']);
    assert.equal(new Set(Array.from({ length: 5 }, (_, day) => ids(day)).flat()).size, 40);
    // The day turns over at midnight in Erbil (21:00 UTC), not at midnight UTC.
    assert.equal(shopDay(Date.UTC(2026, 10, 14, 20, 59)), shopDay(Date.UTC(2026, 10, 14, 0, 0)));
    assert.equal(shopDay(Date.UTC(2026, 10, 14, 21, 0)), shopDay(Date.UTC(2026, 10, 14, 20, 59)) + 1);
    // More than eight Featured products rotate among themselves; eight or fewer stay as marked.
    const marked = catalog.slice(0, 12).map(product => ({ ...product, featured: true }));
    assert.ok(homeProducts([...marked, ...catalog.slice(12)], 7).products.every(product => product.featured));
    assert.notDeepEqual(homeProducts(marked, 7).products, homeProducts(marked, 8).products);
});

test('video conferencing page groups meeting-room products and leaves other items out', () => {
    const group = name => videoConferencingGroup({ name, description: '' });
    assert.equal(group('Logitech Rally Bar Video Conferencing Bar 960-001312 Graphite'), 'rooms');
    assert.equal(group('Logitech MeetUp All-in-One 4K ConferenceCam with 120° FOV Lens 960-001101'), 'rooms');
    assert.equal(group('Logitech Conference Cam BCC950 Video Conference Webcam, HD 1080p Camera with Built-In Speakerphone'), 'rooms');
    assert.equal(group('LOGITECH MEETUP EXPANSION MICROPHONE 989-000405'), 'audio');
    assert.equal(group('Jabra Speak2 40 Portable Speakerphone'), 'audio');
    assert.equal(group('Logitech PTZ Pro 2 HD Video Conference Camera CC2900ep'), 'cameras');
    assert.equal(group('Logitech C930e 1080p Business Webcam'), 'cameras');
    assert.equal(group('Logitech TAP Touch Meeting Room Controller 939-001950'), 'control');
    assert.equal(group('Logitech 939-001498 TV Mount for MeetUp Conference Camera'), 'accessories');
    assert.equal(group('Meetup 10M Extended cable for Expansion mic 950-000005'), 'accessories');
    for (const name of ['Logitech C270 HD Webcam', 'Logitech G502 Gaming Mouse', 'Heckler Tripod Mount for Logitech MeetUp', 'Rapoo C280 2K Business Webcam', 'Blue Yeti USB Microphone', 'B09WTS338X']) assert.equal(group(name), null, name);

    const catalog = [
        { id: '1', name: 'Logitech Rally Bar Video Conferencing Bar 960-001312 Graphite', price: 3600, in_stock: false },
        { id: '2', name: 'Logitech Wall Mount for Video Bars & Bar mini 952-000044', price: 130, in_stock: true },
        { id: '3', name: 'Logitech GROUP Video Conferencing System 960-001057', price: 900, in_stock: true },
        { id: '4', name: 'Logitech Mouse', price: 20, in_stock: true },
    ];
    // In stock first; unrelated products never appear.
    assert.deepEqual(videoConferencingProducts(catalog).map(item => item.product.id), ['3', '2', '1']);
    // Suggestions never include mounts or cables, and offer what is in stock before sold-out models.
    const medium = ROOM_SIZES.find(size => size.id === 'medium');
    assert.deepEqual(roomSizePicks(catalog, medium).map(product => product.id), ['3', '1']);
});

test('video conferencing page shows each model once, keeping the listing that is in stock', () => {
    const item = (id, name, extra = {}) => ({ id, name, description: '', price: 100, in_stock: true, ...extra });
    const shown = catalog => videoConferencingProducts(catalog).map(entry => entry.product.id);
    // Five barcodes of the Brio 4K, one of them in stock: only that one is shown.
    assert.deepEqual(shown([
        item('1', 'Logitech Brio 4K Pro webcam with RightLight3 and HDR', { in_stock: false }),
        item('2', 'Logitech BRIO ULTRA HD PRO BUSINESS WEBCAM Premium 4K', { in_stock: false }),
        item('3', 'Logitech C1000e MPN:960-001107 BRIO 4K webcast wide-angle'),
        item('4', 'Logitech BRIO 4K STREAM EDITION WEBCAM C1000e', { in_stock: false }),
    ]), ['3']);
    // All sold out: the model still appears, once. A different model stays.
    assert.deepEqual(shown([
        item('1', 'Logitech MX BRIO 4K Ultra HD 960-001545 Collaboration Webcam', { in_stock: false }),
        item('2', 'Logitech MX Brio 705 for Business 4K Webcam with Auto Light', { in_stock: false }),
        item('3', 'Logitech Brio 4K Webcam', { in_stock: false }),
    ]), ['1', '3']);
    // Several in stock: the listing with the shop's own short name wins.
    assert.deepEqual(shown([item('1', 'Logitech MX BRIO 4K Ultra HD 960-001545'), item('2', 'Logitech MX Brio', { tagline: '4K, AI framing, USB-C' })]), ['2']);
    // Another colour is its own card; so is a different product that shares a word.
    assert.deepEqual(shown([item('1', 'Logitech MX Brio 4K Webcam Graphite'), item('2', 'Logitech MX Brio 4K Webcam Pale Grey')]).length, 2);
    // A colour word on only one of the listings does not split the model.
    assert.deepEqual(shown([item('1', 'Logitech MX Brio', { in_stock: false }), item('2', 'Logitech MX BRIO 4K Ultra HD 960-001545 Graphite', { in_stock: false })]), ['1']);
    assert.deepEqual(shown([item('1', 'Logitech MeetUp 4K ConferenceCam'), item('2', 'Logitech MeetUp Expansion Mic'), item('3', 'Jabra Speak 510 UC'), item('4', 'Jabra Speak 710 MS')]).length, 4);
    // Mounts and cables only merge when they show the very same photo.
    assert.deepEqual(shown([
        item('1', 'Logitech Group 10M Extended Cable 939-001487', { images: ['/10m.png'] }),
        item('2', 'Logitech Group 10M Extended Cable 939-001488', { images: ['/10m.png'], in_stock: false }),
        item('3', 'Logitech Group 15M Extended Cable 939-001490', { images: ['/15m.png'] }),
    ]), ['1', '3']);
});

test('colour dots group listings of one model and ignore look-alikes', () => {
    assert.equal(colourOf('Logitech MX Master 3S Wireless Mouse - Pale Grey').label, 'Pale Grey');
    assert.equal(colourOf('Logitech M185 Bluetooth Mouse'), null);
    // "Blue" in Blue Yeti is the brand, not a colour.
    assert.equal(colourOf('Blue Yeti USB Microphone'), null);
    const item = (id, name, extra = {}) => ({ id, name, brand: 'Logitech', price: 10, in_stock: true, ...extra });
    const catalog = withColourVariants([
        item('1', 'Logitech G502 X PLUS LIGHTSPEED Wireless Gaming Mouse 910-006160 Black'),
        item('2', 'Logitech G502 X PLUS LIGHTSPEED Wireless Gaming Mouse 910-006169 White'),
        item('3', 'Logitech G502 X PLUS LIGHTSPEED Wireless Gaming Mouse 910-006170 White', { in_stock: false }),
        item('4', 'Logitech MX Keys Mini Keyboard Graphite'),
        item('5', 'Logitech C920 Webcam'),
    ]);
    // One dot per colour, pointing at the listing that is in stock.
    assert.deepEqual(catalog[0].variants.map(variant => [variant.id, variant.colour]), [['1', 'Black'], ['2', 'White']]);
    assert.equal(catalog[1].variants, catalog[0].variants);
    // A second listing of a colour, a model with one colour and a model with none get no dots.
    for (const index of [2, 3, 4]) assert.equal(catalog[index].variants, undefined);
});
