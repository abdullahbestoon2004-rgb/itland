import { usePageData } from '../context/PageDataContext';
import usePageMeta from '../hooks/usePageMeta';
import { organization, SITE_URL } from '../utils/seo';
import { useLocale } from '../context/LocaleContext';
import { homeProducts } from '../utils/storefront';
import React, { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import HomeHero from '../components/HomeHero';
import FeaturedCategories from '../components/FeaturedCategories';
import WhyChooseUs from '../components/WhyChooseUs';
import PromoBanner from '../components/PromoBanner';
import CustomerReviews from '../components/CustomerReviews';
import NewsletterCTA from '../components/NewsletterCTA';
import ProductCard from '../components/ProductCard';
import ProductDetailsModal from '../components/ProductDetailsModal';
import { getAllProducts } from '../data/products';
export default function Storefront() {
  usePageMeta({
    title: 'Computer Accessories & Gaming Gear in Iraq',
    description: 'Shop computer accessories and gaming gear. Delivery across all Iraq and Kurdistan. Order through WhatsApp.',
    path: '/',
    jsonLd: [organization, { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'IT Land', url: `${SITE_URL}/`, publisher: { '@id': `${SITE_URL}/#organization` } }]
  });
  const {
    t
  } = useLocale();
  const {
    handleAddToCart
  } = useOutletContext();
  const initial = usePageData();
  const [products, setProducts] = useState(initial.products ?? []);
  const [productsError, setProductsError] = useState('');
  const [loading, setLoading] = useState(!initial.products);
  const [selectedImageProduct, setSelectedImageProduct] = useState(null);
  useEffect(() => {
    let ignore = false;
    const loadProducts = async () => {
      try {
        const nextProducts = await getAllProducts();
        if (!ignore) {
          setProducts(nextProducts);
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
  const selection = homeProducts(products);
  const bestSellers = selection.products;
  return <div className="storefront-page">
            <HomeHero />

            <FeaturedCategories />

            <section id="best-sellers" className="products-section">
                <div className="section-container">
                    <div className="section-header section-header-row">
                        <h2 className="section-title">{selection.featured ? t("Best Sellers") : t("Featured Products")}</h2>
                        <Link to="/products" className="view-all-link">{t("View All Products \u2192")}

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

            <WhyChooseUs />
            <PromoBanner />
            <CustomerReviews />
            <NewsletterCTA />

            <ProductDetailsModal key={selectedImageProduct?.id ?? 'no-product'} product={selectedImageProduct} onClose={() => setSelectedImageProduct(null)} onAddToCart={handleAddToCart} />

        </div>;
}
