/* eslint-disable react-refresh/only-export-components -- Server entry exports request-scoped render functions. */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter, Routes, Route } from 'react-router-dom';
import WholesaleProvider from './components/WholesaleProvider';
import { MetadataContext, PageDataContext } from './context/PageDataContext';
import StoreLayout from './components/StoreLayout';
import Storefront from './pages/Storefront';
import AllProducts from './pages/AllProducts';
import ProductDetails from './pages/ProductDetails';
import About from './pages/About';
import Contact from './pages/Contact';
import ShoppingHelp from './pages/ShoppingHelp';
import { helpContent } from './data/help';
import NotFound from './pages/NotFound';
import { normalizeProduct, productIdFromSlug } from './data/products';
import imageMap from './data/productImages.json';
import { CATEGORIES, pageMetadata, renderHead, serializeJson, toProductSlug } from './utils/seo';

export function normalizeCatalog(products) {
    return products.map((product, i) => {
        const normalized = normalizeProduct(product, i, imageMap);
        // Server HTML is always the public retail view.
        delete normalized.wholesale_price;
        delete normalized.original_name;
        return normalized;
    });
}
export function renderPage(requestUrl, products = [], snapshot = null) {
    const url = new URL(requestUrl, 'https://itlandforcomputer.com');
    const path = url.pathname;
    const catalog = normalizeCatalog(products);
    const productRoute = path.startsWith('/product/');
    const slug = productRoute ? decodeURIComponent(path.slice('/product/'.length)) : null;
    const product = slug ? catalog.find(item => item.id === productIdFromSlug(slug)) : null;
    if (product && slug !== toProductSlug(product)) {
        return { status: 301, redirect: `/product/${toProductSlug(product)}` };
    }
    const pageData = productRoute ? { slug, product: product ?? null, snapshot, serverRendered: true } : { products: catalog, snapshot, serverRendered: true };
    const known = ['/', '/products', '/about', '/contact'].includes(path) || (path.startsWith('/help/') && Object.hasOwn(helpContent, path.slice(6))) || Boolean(product);
    let metadata = null;
    const collectMetadata = value => { metadata = value; };
    const body = renderToString(
        <MetadataContext.Provider value={collectMetadata}><PageDataContext.Provider value={pageData}>
            <StaticRouter location={`${path}${url.search}`}><WholesaleProvider><Routes>
                <Route element={<StoreLayout />}>
                    <Route path="/" element={<Storefront />} />
                    <Route path="/products" element={<AllProducts />} />
                    <Route path="/product/:slug" element={<ProductDetails />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/help/:topic" element={<ShoppingHelp />} />
                    <Route path="*" element={<NotFound />} />
                </Route>
            </Routes></WholesaleProvider></StaticRouter>
        </PageDataContext.Provider></MetadataContext.Provider>
    );
    return { status: known ? 200 : 404, head: renderHead(metadata ?? pageMetadata({ path, noindex: !known })), body, data: serializeJson(pageData) };
}
export { CATEGORIES, toProductSlug, helpContent };
