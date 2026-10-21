import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import WholesaleProvider from '../src/components/WholesaleProvider';
import { CurrencyContext } from '../src/context/CurrencyContext';
import ProductCard from '../src/components/ProductCard';
import ProductDetailsModal from '../src/components/ProductDetailsModal';
import CartDrawer from '../src/components/CartDrawer';
import NewsletterForm from '../src/components/NewsletterForm';
import { subscribeToNewsletter } from '../src/data/newsletter';

const product = { id: 'test', name: 'USB-C cable', description: 'USB-C cable office price (5$)', price: 10, category: 'Accessories', images: ['/test.png'], in_stock: false, stock_on_hand: 0 };
const render = (node) => renderToStaticMarkup(<MemoryRouter><WholesaleProvider><CurrencyContext.Provider value={{ snapshot: { rate: 1510, asOf: new Date().toISOString() }, loading: false }}>{node}</CurrencyContext.Provider></WholesaleProvider></MemoryRouter>);

test('unavailable cards and previews do not offer add-to-cart', () => {
    const card = render(<ProductCard product={product} onAddToCart={() => {}} />);
    const preview = render(<ProductDetailsModal product={product} onClose={() => {}} onAddToCart={() => {}} />);
    assert.doesNotMatch(card, /Add to Cart/);
    assert.doesNotMatch(preview, /Add to Cart|office price/);
    assert.match(preview, /Ask about restocking/);
    assert.match(card, /15,100 IQD/);
});

test('available cards offer add-to-cart and closed cart is absent from accessibility tree', () => {
    assert.match(render(<ProductCard product={{ ...product, in_stock: true, stock_on_hand: 2 }} onAddToCart={() => {}} />), /Add to Cart/);
    assert.doesNotMatch(render(<CartDrawer isOpen={false} cartItems={[]} />), /Your Cart/);
});

test('newsletter renders an accessible real signup form', () => {
    const html = render(<NewsletterForm />);
    assert.match(html, /aria-label="Email address"/);
    assert.match(html, /type="email"/);
    assert.match(html, /aria-label="Subscribe"/);
});

test('newsletter insert is normalized and duplicate signup is idempotent', async () => {
    let inserted;
    globalThis.__newsletterTestDb = { from(table) { assert.equal(table, 'newsletter_subscribers'); return { insert: async (rows) => { inserted = rows; return { error: null }; } }; } };
    await subscribeToNewsletter(' User@Example.com ');
    assert.deepEqual(inserted, [{ email: 'user@example.com' }]);
    globalThis.__newsletterTestDb = { from() { return { insert: async () => ({ error: { code: '23505' } }) }; } };
    await assert.doesNotReject(() => subscribeToNewsletter('user@example.com'));
});

test('newsletter rejects invalid input and never reports success after a failed insert', async () => {
    await assert.rejects(() => subscribeToNewsletter('bad-address'), /valid email/);
    globalThis.__newsletterTestDb = { from() { return { insert: async () => ({ error: { code: '42501' } }) }; } };
    const previous = console.error; console.error = () => {};
    try { await assert.rejects(() => subscribeToNewsletter('user@example.com'), /could not add/); }
    finally { console.error = previous; }
});
