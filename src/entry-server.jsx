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
import LegalPage from './pages/app/LegalPage';
import { LEGAL_PATHS } from './pages/app/legalDocs';
import { normalizeProduct, productIdFromSlug } from './data/products';
import { relatedProducts } from './utils/storefront';
import imageMap from './data/productImages.json';
import { brandSlug, CATEGORIES, pageMetadata, renderHead, serializeJson, toProductSlug } from './utils/seo';

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
    const pageData = productRoute ? { slug, product: product ?? null, related: relatedProducts(product, catalog), snapshot, serverRendered: true } : { products: catalog, snapshot, serverRendered: true };
    const known = ['/', '/products', '/about', '/contact', ...LEGAL_PATHS].includes(path) || (path.startsWith('/help/') && Object.hasOwn(helpContent, path.slice(6))) || Boolean(product) || (path.startsWith('/brands/') && catalog.some(item => item.brand && brandSlug(item.brand) === path.slice(8)));
    let metadata = null;
    const collectMetadata = value => { metadata = value; };
    const body = renderToString(
        <MetadataContext.Provider value={collectMetadata}><PageDataContext.Provider value={pageData}>
            <StaticRouter location={`${path}${url.search}`}><WholesaleProvider><Routes>
                <Route element={<StoreLayout />}>
                    <Route path="/" element={<Storefront />} />
                    <Route path="/products" element={<AllProducts />} />
                    <Route path="/brands/:brand" element={<AllProducts />} />
                    <Route path="/product/:slug" element={<ProductDetails />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/help/:topic" element={<ShoppingHelp />} />
                    <Route path="*" element={<NotFound />} />
                </Route>
                <Route path="/app/privacy" element={<LegalPage doc="privacy" />} />
                <Route path="/app/terms" element={<LegalPage doc="terms" />} />
                <Route path="/app/delete-account" element={<LegalPage doc="delete-account" />} />
            </Routes></WholesaleProvider></StaticRouter>
        </PageDataContext.Provider></MetadataContext.Provider>
    );
    return { status: known ? 200 : 404, head: renderHead(metadata ?? pageMetadata({ path, noindex: !known })), body, data: serializeJson(pageData) };
}
export { CATEGORIES, toProductSlug, helpContent, LEGAL_PATHS };
