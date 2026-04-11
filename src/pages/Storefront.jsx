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
    const { handleAddToCart } = useOutletContext();
    const [products, setProducts] = useState([]);
    const [productsError, setProductsError] = useState('');
    const [selectedImageProduct, setSelectedImageProduct] = useState(null);

    useEffect(() => {
        let ignore = false;

        const loadProducts = async () => {
            try {
                const nextProducts = await getAllProducts();

                if (!ignore) {
                    setProducts(nextProducts);
                    setProductsError('');
                }
            } catch (error) {
                console.error(error);

                if (!ignore) {
                    setProductsError('Unable to load products right now.');
                }
            }
        };

        loadProducts();

        return () => {
            ignore = true;
        };
    }, []);

    const bestSellers = products.filter((product) => product.featured);

    return (
        <div className="storefront-page">
            <HomeHero />

            <FeaturedCategories />

            <section id="best-sellers" className="products-section">
                <div className="section-container">
                    <div className="section-header section-header-row">
                        <h2 className="section-title">Best Sellers</h2>
                        <Link to="/products" className="view-all-link">
                            View All Products &rarr;
                        </Link>
                    </div>

                    {productsError && (
                        <div className="no-results">
                            <p>{productsError}</p>
                        </div>
                    )}

                    <div className="products-grid">
                        {bestSellers.length > 0 ? (
                            bestSellers.map((product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    onAddToCart={handleAddToCart}
                                    onImageClick={setSelectedImageProduct}
                                />
                            ))
                        ) : (
                            <div className="no-results">
                                <p>No best sellers available.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <WhyChooseUs />
            <PromoBanner />
            <CustomerReviews />
            <NewsletterCTA />

            <ProductDetailsModal
                key={selectedImageProduct?.id ?? 'no-product'}
                product={selectedImageProduct}
                onClose={() => setSelectedImageProduct(null)}
                onAddToCart={handleAddToCart}
            />
        </div>
    );
}
