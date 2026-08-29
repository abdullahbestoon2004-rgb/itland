import React, { useState, useEffect } from 'react';
import { ShoppingCart, Star } from 'lucide-react';
import { useWholesale } from '../context/WholesaleContext';
import './ProductCard.css';

const DEFAULT_CATEGORY_FALLBACKS = {
    Mice: 'https://resource.logitechg.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/products/pro-x-superlight-2/gallery-5-pro-x-superlight-2-gaming-mouse-black.png?v=1',
    Keyboards: 'https://resource.logitechg.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/products/pro-x-tkl/gallery-2-pro-x-tkl-black-lightspeed-gaming-keyboard.png.png',
    Headsets: 'https://resource.logitechg.com/d_transparent.gif/content/dam/gaming/en/products/pro-x-2-lightspeed/gallery/gallery-1-pro-x-2-lightspeed-gaming-headset-black.png',
    Webcams: 'https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/webcams/c920s/gallery/c920s-gallery-1.png',
    Gaming: 'https://www.logitechg.com/content/dam/gaming/en/non-braid/hyjal-g502-hero/2025/g502-hero-mouse-top-angle-gallery-1.png',
    Streaming: 'https://resource.logitechg.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/plp-microphones/pdp-yeti-gx-gaming-microphone/yeti-gx-gallery-3.png?v=1',
    Audio: 'https://m.media-amazon.com/images/I/71PBEF24hPL._AC_.jpg',
    Accessories: 'https://proflashtech.com/cdn/shop/files/otn-910602m-onten-otn-9106-usb-c-male-to-female-extension-cable-02m-787-feet-charger-converter-cable-for-mobile-phone-computer-macbook-chromebook-287620.jpg?v=1732112325&width=533'
};

export function getCleanProductName(product) {
    if (!product) return '';
    const name = (product.name || '').trim();
    const desc = (product.description || '').trim();
    if ((/^\d+$/.test(name) || name.length <= 4) && desc.length > 3) {
        const firstLine = desc.split('\n')[0]
            .replace(/office price.*$/i, '')
            .replace(/price.*$/i, '')
            .replace(/\(\d+[\$\s]*\)/g, '')
            .trim();
        if (firstLine && !/^\d+$/.test(firstLine)) return firstLine;
    }
    return name || desc.split('\n')[0] || 'Product';
}

export function getCleanProductCategory(product) {
    const cat = product?.category;
    if (cat && cat.toLowerCase() !== 'goods') {
        return cat;
    }
    const text = `${product?.name || ''} ${product?.description || ''}`.toLowerCase();
    if (text.includes('mouse') || text.includes('mice') || text.includes('trackball')) return 'Mice';
    if (text.includes('keyboard') || text.includes('keypad') || text.includes('numaric') || text.includes('numeric')) return 'Keyboards';
    if (text.includes('headset') || text.includes('headphone') || text.includes('earphone') || text.includes('earbuds') || text.includes('airpods')) return 'Headsets';
    if (text.includes('webcam') || text.includes('camera') || text.includes('brio') || text.includes('c920') || text.includes('c270') || text.includes('c310') || text.includes('c922')) return 'Webcams';
    if (text.includes('gaming') || text.includes('lightspeed') || text.includes('pro x') || text.includes('g502') || text.includes('g305') || text.includes('g915') || text.includes('gamepad') || text.includes('controller')) return 'Gaming';
    if (text.includes('mic') || text.includes('microphone') || text.includes('yeti') || text.includes('stream') || text.includes('elgato') || text.includes('capture')) return 'Streaming';
    if (text.includes('speaker') || text.includes('soundbar') || text.includes('audio') || text.includes('bluetooth speaker') || text.includes('hands free') || text.includes('speak 510') || text.includes('sync 20')) return 'Audio';
    return 'Accessories';
}

export default function ProductCard({ product, onAddToCart, onImageClick }) {
    const { wholesaleClient } = useWholesale();
    const displayName = getCleanProductName(product);
    const displayCategory = getCleanProductCategory(product);
    const initialImage = product.images && product.images.length > 0 ? product.images[0] : product.image;
    
    const [imgSrc, setImgSrc] = useState(initialImage || DEFAULT_CATEGORY_FALLBACKS[displayCategory] || DEFAULT_CATEGORY_FALLBACKS.Accessories);

    useEffect(() => {
        const nextImg = product.images && product.images.length > 0 ? product.images[0] : product.image;
        if (nextImg) {
            setImgSrc(nextImg);
        }
    }, [product.images, product.image]);

    const handleImgError = () => {
        const fallback = DEFAULT_CATEGORY_FALLBACKS[displayCategory] || DEFAULT_CATEGORY_FALLBACKS.Accessories;
        if (imgSrc !== fallback) {
            setImgSrc(fallback);
        }
    };

    // Stable rating count based on product ID
    const rawId = typeof product.id === 'string' ? product.id.slice(-4) : product.id;
    const ratingCount = (Math.abs(Number(rawId) || 12) % 40) + 12;

    return (
        <div className="product-card">
            <div className="product-image-container" onClick={() => onImageClick && onImageClick({ ...product, name: displayName, category: displayCategory, images: [imgSrc] })} style={{ cursor: 'pointer' }}>
                <img
                    src={imgSrc}
                    alt={displayName}
                    className="product-image"
                    loading="lazy"
                    onError={handleImgError}
                />
                <div className="product-overlay">
                    <button className="btn btn-primary add-to-cart-btn" onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onAddToCart({ ...product, name: displayName, category: displayCategory, images: [imgSrc] });
                    }}>
                        <ShoppingCart size={18} />
                        <span>Add to Cart</span>
                    </button>
                </div>
            </div>
            <div className="product-info">
                <div className="product-meta-header">
                    <span className="product-category">{displayCategory}</span>
                    {product.brand && <span className="product-brand-tag">{product.brand}</span>}
                </div>
                <h3 className="product-name" title={displayName}>{displayName}</h3>
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
                                Retail: ${Number(product.price).toFixed(2)}
                            </span>
                        </>
                    ) : (
                        <span className="product-price">${Number(product.price).toFixed(2)}</span>
                    )}
                </div>
            </div>
        </div>
    );
}

