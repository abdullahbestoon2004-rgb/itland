import { useLocale } from '../context/LocaleContext';
import { useCurrency } from '../context/CurrencyContext';
import { formatIqd } from '../utils/currency';
import Price from './Price';
import { isOutOfStock, cleanDescription, whatsappLink } from '../utils/storefront';
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MessageCircle, ShoppingCart, X } from 'lucide-react';
import { toProductSlug } from '../data/products';
import { useWholesale } from '../context/WholesaleContext';
import { cleanProductName as getCleanProductName, getCleanProductCategory } from '../utils/storefront';
import ProductImage from './ProductImage';
import './ProductDetailsModal.css';
export default function ProductDetailsModal({
  product,
  onClose,
  onAddToCart
}) {
  const {
    t
  } = useLocale();
  const {
    snapshot
  } = useCurrency();
  const {
    wholesaleClient,
    wholesalePriceOf
  } = useWholesale();
  const [currentIndex, setCurrentIndex] = useState(0);
  const displayName = getCleanProductName(product);
  const displayCategory = getCleanProductCategory(product);
  const images = product?.images?.length ? product.images : product?.image ? [product.image] : [];
  const imageCount = images.length;
  const handlePrev = useCallback(() => {
    if (imageCount > 1) setCurrentIndex(prev => prev === 0 ? imageCount - 1 : prev - 1);
  }, [imageCount]);
  const handleNext = useCallback(() => {
    if (imageCount > 1) setCurrentIndex(prev => prev === imageCount - 1 ? 0 : prev + 1);
  }, [imageCount]);
  useEffect(() => {
    if (!product) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') handleNext();
      if (event.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose, product]);
  if (!product) return null;
  const unavailable = isOutOfStock(product);
  const wholesalePrice = wholesalePriceOf(product);
  const hasWholesalePrice = wholesalePrice > 0;
  const hasRetailPrice = product.price != null && !isNaN(product.price) && Number(product.price) > 0;
  const isWholesaleMissingPrice = wholesaleClient && !hasWholesalePrice;
  const isContactForPrice = isWholesaleMissingPrice || !wholesaleClient && !hasRetailPrice;
  const handleDirectWhatsAppBuy = event => {
    if (event) event.stopPropagation();
    let message;
    if (isContactForPrice) {
      const inquiryType = wholesaleClient ? 'wholesale pricing' : 'pricing';
      message = `*Hello! I'm inquiring about ${inquiryType} for:*\n\n- ${displayName}\n\nPlease let me know the price!`;
    } else {
      const activePrice = wholesaleClient && hasWholesalePrice ? wholesalePrice : Number(product.price);
      message = `*Hello! I'm interested in buying this product:*\n\n- ${displayName} - ${formatIqd(activePrice, snapshot) ?? 'Please confirm IQD price'}\n\nPlease let me know if it's available!`;
    }
    const whatsappUrl = whatsappLink(message);
    window.open(whatsappUrl, '_blank');
  };
  const handleModalAddToCart = event => {
    event.stopPropagation();
    if (unavailable) return;
    if (isContactForPrice) {
      handleDirectWhatsAppBuy(event);
      return;
    }
    const effectivePrice = wholesaleClient && hasWholesalePrice ? wholesalePrice : Number(product.price);
    onAddToCart({
      ...product,
      price: effectivePrice,
      name: displayName,
      category: displayCategory
    });
    onClose();
  };
  const handleBackdropClick = event => {
    if (event.target.classList.contains('gallery-backdrop')) {
      onClose();
    }
  };
  return <div className="gallery-backdrop" onClick={handleBackdropClick}>
            <div className="product-modal-container" role="dialog" aria-modal="true" aria-label={displayName}>
                <button aria-label={t("Close product preview")} className="gallery-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <div className="product-modal-content">
                    <div className="product-modal-left">
                        <div className="modal-main-image-wrapper">
                            {images.length > 1 && <button type="button" className="modal-nav prev" aria-label={t("Previous image")} onClick={event => {
              event.stopPropagation();
              handlePrev();
            }}>
                                    <ChevronLeft size={32} />
                                </button>}

                            <ProductImage src={images[currentIndex]} alt={`${displayName} view`} category={displayCategory} className="modal-main-image" />


                            {images.length > 1 && <button type="button" className="modal-nav next" aria-label={t("Next image")} onClick={event => {
              event.stopPropagation();
              handleNext();
            }}>
                                    <ChevronRight size={32} />
                                </button>}
                        </div>

                        {images.length > 1 && <div className="gallery-thumbnails">
                                {images.map((image, index) => <button key={index} className={`thumbnail-btn ${index === currentIndex ? 'active' : ''}`} onClick={event => {
              event.stopPropagation();
              setCurrentIndex(index);
            }}>

                                        <ProductImage src={image} alt={`Thumbnail ${index + 1}`} category={displayCategory} />
                                    </button>)}
                            </div>}
                    </div>

                    <div className="product-modal-right">
                        <div className="modal-header-info">
                            <span className="modal-category">{t(displayCategory)}</span>
                            <h2 className="modal-title">{displayName}</h2>
                            {wholesaleClient ? hasWholesalePrice ? <div className="modal-price-block">
                                        <div className="modal-price modal-price-wholesale">
                                            <Price usd={wholesalePrice} />
                                            <span className="modal-wholesale-badge">{t("Wholesale")}</span>
                                        </div>
                                        {hasRetailPrice && <div className="modal-price-retail">{t("Retail:")}<Price usd={product.price} /></div>}
                                    </div> : <div className="modal-price-block">
                                        <button type="button" className="modal-price modal-price-contact modal-contact-btn" onClick={handleDirectWhatsAppBuy} title="Click to inquire via WhatsApp">{t("Contact for price")}


                </button>
                                    </div> : hasRetailPrice ? <div className="modal-price"><Price usd={product.price} /></div> : <div className="modal-price-block">
                                    <button type="button" className="modal-price modal-price-contact modal-contact-btn" onClick={handleDirectWhatsAppBuy} title="Click to inquire via WhatsApp">{t("Contact for price")}


                </button>
                                </div>}
                        </div>

                        <div className="modal-description-wrapper">
                            <p className="modal-description">{cleanDescription(product.description) || displayName}</p>
                        </div>

                        <p className="order-note">{t("Delivery across all Iraq and Kurdistan. Delivery fee, timing and final total confirmed on WhatsApp.")}</p>
                        <div className="modal-actions modal-actions-stack">
                            {unavailable ? <p className="stock-badge out">{t("Currently out of stock.")}<a href={whatsappLink(`Hello! When will ${displayName} be available again?`)} target="_blank" rel="noreferrer">{t("Ask about restocking")}</a></p> : isContactForPrice ? <button className="btn btn-primary modal-buy-btn modal-contact-action-btn" onClick={handleDirectWhatsAppBuy}>

                                    <MessageCircle size={20} className="modal-buy-icon" />{t("Contact for Price")}

              </button> : <>
                                    <button className="btn btn-primary modal-buy-btn" onClick={handleModalAddToCart}>

                                        <ShoppingCart size={20} className="modal-buy-icon" />{t("Add to Cart")}

                </button>

                                    <button className="btn btn-secondary modal-whatsapp-btn" onClick={handleDirectWhatsAppBuy}>

                                        <MessageCircle size={20} />{t("Buy via WhatsApp")}

                </button>
                                </>}

                            <Link to={`/product/${toProductSlug({
              ...product,
              name: displayName
            })}`} className="modal-details-link" onClick={onClose}>{t("View full product page")}


              </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>;
}
