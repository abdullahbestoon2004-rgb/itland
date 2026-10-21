import productsHandler from '../api/products.js';

// Reuse the existing catalog cache without a loopback request or untrusted Host header.
export async function loadCatalog() {
    let status = 200;
    let payload;
    const response = {
        setHeader() {},
        status(code) { status = code; return this; },
        json(value) { payload = value; return this; }
    };
    await productsHandler({ method: 'GET', query: {} }, response);
    if (status !== 200 || !Array.isArray(payload?.products)) throw new Error('Catalog unavailable');
    return payload.products;
}
