/* eslint-disable react-refresh/only-export-components -- Server entry exports request-scoped render functions. */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter, Routes, Route } from 'react-router-dom';
import WholesaleProvider from './components/WholesaleProvider';
import { MetadataContext, PageDataContext } from './context/PageDataContext';
import { RouteLocaleContext } from './context/LocaleContext';
import { LOCALES, localeFromPath, localePath, stripLocale } from './utils/locale';
import StoreLayout from './components/StoreLayout';
import Storefront from './pages/Storefront';
import AllProducts from './pages/AllProducts';
import ProductDetails from './pages/ProductDetails';
import About from './pages/About';
import Contact from './pages/Contact';
import VideoConferencing, { VIDEO_CONFERENCING_PATH } from './pages/VideoConferencing';
import ShoppingHelp from './pages/ShoppingHelp';
import CityDelivery from './pages/CityDelivery';
import { CITIES, cityBySlug, cityPath } from './data/cities';
import { helpContent } from './data/help';
import NotFound from './pages/NotFound';
import LegalPage from './pages/app/LegalPage';
import { LEGAL_PATHS } from './pages/app/legalDocs';
import { normalizeProduct, productIdFromSlug } from './data/products';
import { relatedProducts, shopDay } from './utils/storefront';
import { withColourVariants } from './utils/colours';
import imageMap from './data/productImages.json';
import { brandSlug, CATEGORIES, pageMetadata, renderHead, serializeJson, toProductSlug } from './utils/seo';

export function normalizeCatalog(products) {
    return withColourVariants(products.map((product, i) => {
        const normalized = normalizeProduct(product, i, imageMap);
        // Server HTML is always the public retail view.
        delete normalized.wholesale_price;
        delete normalized.original_name;
        return normalized;
    }));
}
export function renderPage(requestUrl, products = [], snapshot = null) {
    const url = new URL(requestUrl, 'https://itlandforcomputer.com');
    // "/ar/products" is the Arabic version of "/products".
    const locale = localeFromPath(url.pathname);
    const prefix = LOCALES[locale].prefix;
    const path = stripLocale(url.pathname);
    // The app's legal pages have their own language switch and one address each.
    if (locale !== 'en' && LEGAL_PATHS.includes(path)) return { status: 301, redirect: path };
    const catalog = normalizeCatalog(products);
    const productRoute = path.startsWith('/product/');
    const slug = productRoute ? decodeURIComponent(path.slice('/product/'.length)) : null;
    const product = slug ? catalog.find(item => item.id === productIdFromSlug(slug)) : null;
    if (product && slug !== toProductSlug(product)) {
        return { status: 301, redirect: localePath(locale, `/product/${toProductSlug(product)}`) };
    }
    const pageData = productRoute ? { slug, product: product ?? null, related: relatedProducts(product, catalog), snapshot, serverRendered: true } : { products: catalog, snapshot, serverRendered: true, day: shopDay() };
    const known = ['/', '/products', '/about', '/contact', VIDEO_CONFERENCING_PATH, ...LEGAL_PATHS].includes(path) || (path.startsWith('/help/') && Object.hasOwn(helpContent, path.slice(6))) || (path.startsWith('/delivery/') && Boolean(cityBySlug(path.slice(10)))) || Boolean(product) || (path.startsWith('/brands/') && catalog.some(item => item.brand && brandSlug(item.brand) === path.slice(8)));
    let metadata = null;
    const collectMetadata = value => { metadata = value; };
    const body = renderToString(
        <RouteLocaleContext.Provider value={locale}><MetadataContext.Provider value={collectMetadata}><PageDataContext.Provider value={pageData}>
            <StaticRouter basename={prefix || undefined} location={`${prefix}${path}${url.search}`}><WholesaleProvider><Routes>
                <Route element={<StoreLayout />}>
                    <Route path="/" element={<Storefront />} />
                    <Route path="/products" element={<AllProducts />} />
                    <Route path="/brands/:brand" element={<AllProducts />} />
                    <Route path="/product/:slug" element={<ProductDetails />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path={VIDEO_CONFERENCING_PATH} element={<VideoConferencing />} />
                    <Route path="/help/:topic" element={<ShoppingHelp />} />
                    <Route path="/delivery/:city" element={<CityDelivery />} />
                    <Route path="*" element={<NotFound />} />
                </Route>
                <Route path="/app/privacy" element={<LegalPage doc="privacy" />} />
                <Route path="/app/terms" element={<LegalPage doc="terms" />} />
                <Route path="/app/delete-account" element={<LegalPage doc="delete-account" />} />
            </Routes></WholesaleProvider></StaticRouter>
        </PageDataContext.Provider></MetadataContext.Provider></RouteLocaleContext.Provider>
    );
    return { status: known ? 200 : 404, head: renderHead(metadata ?? pageMetadata({ path, noindex: !known })), body, data: serializeJson(pageData), lang: LOCALES[locale].lang, dir: LOCALES[locale].dir };
}
export { CATEGORIES, toProductSlug, helpContent, LEGAL_PATHS, VIDEO_CONFERENCING_PATH, LOCALES, localePath, CITIES, cityPath };
