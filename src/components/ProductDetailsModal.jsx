import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle, ShoppingCart, X } from 'lucide-react';
import { useWholesale } from '../context/WholesaleContext';
import { getCleanProductName, getCleanProductCategory } from './ProductCard';
import './ProductDetailsModal.css';

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

export default function ProductDetailsModal({ product, onClose, onAddToCart }) {
    const { wholesaleClient } = useWholesale();
    const [currentIndex, setCurrentIndex] = useState(0);

    const displayName = getCleanProductName(product);
    const displayCategory = getCleanProductCategory(product);

    const rawImages = product?.images || (product?.image ? [product.image] : []);
    const fallbackImage = DEFAULT_CATEGORY_FALLBACKS[displayCategory] || DEFAULT_CATEGORY_FALLBACKS.Accessories;
    const images = rawImages.length > 0 ? rawImages : [fallbackImage];

    const [currentImageSrc, setCurrentImageSrc] = useState(images[currentIndex] || fallbackImage);

    useEffect(() => {
        setCurrentImageSrc(images[currentIndex] || fallbackImage);
    }, [currentIndex, images, fallbackImage]);

    const handlePrev = useCallback(() => {
        setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    }, [images.length]);

    const handleNext = useCallback(() => {
        setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    }, [images.length]);

    useEffect(() => {
        if (!product) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowRight') handleNext();
            if (event.key === 'ArrowLeft') handlePrev();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleNext, handlePrev, onClose, product]);

    if (!product || images.length === 0) return null;

    const handleDirectWhatsAppBuy = (event) => {
        event.stopPropagation();

        const phoneNumber = '+9647502045634';
        const message = `*Hello! I'm interested in buying this product:*\n\n- ${displayName} - $${Number(product.price).toFixed(2)}\n\nPlease let me know if it's available!`;
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${phoneNumber.replace('+', '')}?text=${encodedMessage}`;

        window.open(whatsappUrl, '_blank');
    };

    const handleBackdropClick = (event) => {
        if (event.target.classList.contains('gallery-backdrop')) {
            onClose();
        }
    };

    return (
        <div className="gallery-backdrop" onClick={handleBackdropClick}>
            <div className="product-modal-container">
                <button className="gallery-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <div className="product-modal-content">
                    <div className="product-modal-left">
                        <div className="modal-main-image-wrapper">
                            {images.length > 1 && (
                                <button className="modal-nav prev" onClick={(event) => {
                                    event.stopPropagation();
                                    handlePrev();
                                }}>
                                    <ChevronLeft size={32} />
                                </button>
                            )}

                            <img
                                src={currentImageSrc}
                                alt={`${displayName} view`}
                                className="modal-main-image"
                                onError={() => setCurrentImageSrc(fallbackImage)}
                            />

                            {images.length > 1 && (
                                <button className="modal-nav next" onClick={(event) => {
                                    event.stopPropagation();
                                    handleNext();
                                }}>
                                    <ChevronRight size={32} />
                                </button>
                            )}
                        </div>

                        {images.length > 1 && (
                            <div className="gallery-thumbnails">
                                {images.map((image, index) => (
                                    <button
                                        key={index}
                                        className={`thumbnail-btn ${index === currentIndex ? 'active' : ''}`}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setCurrentIndex(index);
                                        }}
                                    >
                                        <img src={image} alt={`Thumbnail ${index + 1}`} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="product-modal-right">
                        <div className="modal-header-info">
                            <span className="modal-category">{displayCategory}</span>
                            <h2 className="modal-title">{displayName}</h2>
                            {wholesaleClient && product.wholesale_price != null ? (
                                <div className="modal-price-block">
                                    <div className="modal-price modal-price-wholesale">
                                        ${Number(product.wholesale_price).toFixed(2)}
                                        <span className="modal-wholesale-badge">Wholesale</span>
                                    </div>
                                    <div className="modal-price-retail">Retail: ${Number(product.price).toFixed(2)}</div>
                                </div>
                            ) : (
                                <div className="modal-price">${Number(product.price).toFixed(2)}</div>
                            )}
                        </div>

                        <div className="modal-description-wrapper">
                            <p className="modal-description">{product.description || displayName}</p>
                        </div>

                        <div className="modal-actions modal-actions-stack">
                            <button
                                className="btn btn-primary modal-buy-btn"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onAddToCart({ ...product, name: displayName, category: displayCategory, images: [currentImageSrc] });
                                    onClose();
                                }}
                            >
                                <ShoppingCart size={20} className="modal-buy-icon" />
                                Add to Cart
                            </button>

                            <button
                                className="btn btn-secondary modal-whatsapp-btn"
                                onClick={handleDirectWhatsAppBuy}
                            >
                                <MessageCircle size={20} />
                                Buy via WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

