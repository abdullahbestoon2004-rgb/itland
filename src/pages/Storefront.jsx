import { usePageData } from '../context/PageDataContext';
import usePageMeta from '../hooks/usePageMeta';
import { organization, SITE_URL, storeBusiness } from '../utils/seo';
import { useLocale } from '../context/LocaleContext';
import { homeProducts, shopDay } from '../utils/storefront';
import React, { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import HomeHero from '../components/HomeHero';
import FeaturedCategories from '../components/FeaturedCategories';
import BrandMarquee from '../components/BrandMarquee';
import StoreInfo from '../components/StoreInfo';
import HomeStories from '../components/HomeStories';
import ProductCard from '../components/ProductCard';
import ProductDetailsModal from '../components/ProductDetailsModal';
import { getAllProducts } from '../data/products';
export default function Storefront() {
  const {
    t
  } = useLocale();
  usePageMeta({
    title: t('Computer & Logitech Store in Erbil, Iraq'),
    description: t('IT Land (iTland For Computer), Muzaffariya Street, Erbil: Logitech, Jabra and Poly mice, keyboards, headsets and webcams. Delivery across Iraq and Kurdistan.'),
    path: '/',
    jsonLd: [organization, storeBusiness(), { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'IT Land', alternateName: ['iTLand', 'iTland For Computer', 'IT Land Erbil'], url: `${SITE_URL}/`, inLanguage: ['en', 'ar', 'ckb'], publisher: { '@id': `${SITE_URL}/#organization` } }]
  });
  const {
    handleAddToCart
  } = useOutletContext();
  const initial = usePageData();
  const [products, setProducts] = useState(initial.products ?? []);
  const [productsError, setProductsError] = useState('');
  const [loading, setLoading] = useState(!initial.products);
  const [selectedImageProduct, setSelectedImageProduct] = useState(null);
  // The first paint uses the day the server rendered with, so both agree; the real day follows.
  const [day, setDay] = useState(initial.day ?? shopDay());
  useEffect(() => {
    let ignore = false;
    const loadProducts = async () => {
      try {
        const nextProducts = await getAllProducts();
        if (!ignore) {
          setProducts(nextProducts);
          setDay(shopDay());
          setProductsError('');
          setLoading(false);
        }
      } catch (error) {
        console.error(error);
        if (!ignore) {
          setProductsError('Unable to load products right now.');
          setLoading(false);
        }
      }
    };
    loadProducts();
    return () => {
      ignore = true;
    };
  }, []);
  const selection = homeProducts(products, day);
  const bestSellers = selection.products;
  return <div className="storefront-page">
            <HomeHero />

            <FeaturedCategories />

            <HomeStories />

            <section id="best-sellers" className="products-section">
                <div className="section-container">
                    <div className="section-header section-header-row">
                        <h2 className="section-title">{selection.featured ? t("Best Sellers") : t("Featured Products")}</h2>
                        <Link to="/products" className="view-all-link">{t("View All Products")}

            </Link>
                    </div>

                    {productsError && <div className="no-results">
                            <p>{productsError}</p>
                        </div>}

                    <div className="products-grid">
                        {bestSellers.length > 0 ? bestSellers.map(product => <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} onImageClick={setSelectedImageProduct} />) : <div className="no-results">
                                <p>{loading ? t("Loading products\u2026") : 'Browse our catalog or ask our team about product availability on WhatsApp.'}</p>
                            </div>}
                    </div>
                </div>
            </section>

            <BrandMarquee products={products} />
            <StoreInfo />

            <ProductDetailsModal key={selectedImageProduct?.id ?? 'no-product'} product={selectedImageProduct} onClose={() => setSelectedImageProduct(null)} onAddToCart={handleAddToCart} />

        </div>;
}
