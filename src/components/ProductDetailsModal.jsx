import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle, ShoppingCart, X } from 'lucide-react';
import './ProductDetailsModal.css';

export default function ProductDetailsModal({ product, onClose, onAddToCart }) {
    const [currentIndex, setCurrentIndex] = useState(0);

    const images = product?.images || (product?.image ? [product.image] : []);

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
        const message = `*Hello! I'm interested in buying this product:*\n\n- ${product.name} - $${product.price.toFixed(2)}\n\nPlease let me know if it's available!`;
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

                            <img src={images[currentIndex]} alt={`${product.name} view`} className="modal-main-image" />

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
                            <span className="modal-category">{product.category}</span>
                            <h2 className="modal-title">{product.name}</h2>
                            <div className="modal-price">${product.price.toFixed(2)}</div>
                        </div>

                        <div className="modal-description-wrapper">
                            <p className="modal-description">{product.description}</p>
                        </div>

                        <div className="modal-actions modal-actions-stack">
                            <button
                                className="btn btn-primary modal-buy-btn"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onAddToCart(product);
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
