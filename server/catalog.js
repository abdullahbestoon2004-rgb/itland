import { getCatalog, publicProduct } from './zoho.js';

// The public catalog for server-rendered pages and the sitemap: same cache as
// /api/products, without a loopback request or untrusted Host header.
export async function loadCatalog() {
    const { products } = await getCatalog();
    return products.map(publicProduct);
}
