import React from 'react';
import { ShoppingCart, Star } from 'lucide-react';
import { useWholesale } from '../context/WholesaleContext';
import './ProductCard.css';

export default function ProductCard({ product, onAddToCart, onImageClick }) {
    const { wholesaleClient } = useWholesale();
    const displayImage = product.images && product.images.length > 0 ? product.images[0] : product.image;

    // Generate a random stable rating count based on product ID for demo purposes
    const ratingCount = (product.id % 40) + 12;

    return (
        <div className="product-card">
            <div className="product-image-container" onClick={() => onImageClick && onImageClick(product)} style={{ cursor: 'pointer' }}>
                <img src={displayImage} alt={product.name} className="product-image" loading="lazy" />
                <div className="product-overlay">
                    <button className="btn btn-primary add-to-cart-btn" onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onAddToCart(product);
                    }}>
                        <ShoppingCart size={18} />
                        <span>Add to Cart</span>
                    </button>
                </div>
            </div>
            <div className="product-info">
                <span className="product-category">{product.category}</span>
                <h3 className="product-name">{product.name}</h3>
                <div className="product-rating">
                    <div className="stars">
                        {[1, 2, 3, 4, 5].map(star => (
                            <Star key={star} size={14} className="star-icon" fill="currentColor" />
                        ))}
                    </div>
                    <span className="rating-count">({ratingCount})</span>
                </div>
                <div className="product-price-block">
                    {wholesaleClient && product.wholesale_price != null ? (
                        <>
                            <span className="product-price wholesale-price">
                                ${Number(product.wholesale_price).toFixed(2)}
                            </span>
                            <span className="product-price-retail">
                                Retail: ${product.price.toFixed(2)}
                            </span>
                        </>
                    ) : (
                        <span className="product-price">${product.price.toFixed(2)}</span>
                    )}
                </div>
            </div>
        </div>
    );
}
