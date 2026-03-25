import React from 'react';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import './Hero.css';

export default function Hero({ featuredProduct, onAddToCart }) {
    if (!featuredProduct) return null;

    return (
        <div className="hero">
            <div className="hero-container">
                <div className="hero-content">
                    <span className="hero-badge">New Release</span>
                    <h1 className="hero-title">{featuredProduct.name}</h1>
                    <p className="hero-description">{featuredProduct.description}</p>
                    <div className="hero-actions">
                        <button className="btn btn-primary" onClick={() => onAddToCart(featuredProduct)}>
                            <ShoppingCart size={20} style={{ marginRight: '8px' }} />
                            Add to Cart - ${featuredProduct.price.toFixed(2)}
                        </button>
                        <a href="#products" className="btn btn-secondary">
                            Explore All <ArrowRight size={20} style={{ marginLeft: '8px' }} />
                        </a>
                    </div>
                </div>
                <div className="hero-image-container">
                    <img src={featuredProduct.images && featuredProduct.images.length > 0 ? featuredProduct.images[0] : featuredProduct.image} alt={featuredProduct.name} className="hero-image" />
                </div>
            </div>
        </div>
    );
}
