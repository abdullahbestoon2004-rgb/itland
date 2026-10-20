import { useLocale } from '../context/LocaleContext';
import Price from './Price';
import { cleanProductName as getCleanProductName, getCleanProductCategory, isOutOfStock, whatsappLink } from '../utils/storefront';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ShoppingCart } from 'lucide-react';
import { toProductSlug } from '../data/products';
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
export default function ProductCard({
  product,
  onAddToCart,
  onImageClick
}) {
  const {
    t
  } = useLocale();
  const {
    wholesaleClient
  } = useWholesale();
  const unavailable = isOutOfStock(product);
  const displayName = getCleanProductName(product);
  const displayCategory = getCleanProductCategory(product);
  const initialImage = product.images && product.images.length > 0 ? product.images[0] : product.image;
  const [failedImage, setFailedImage] = useState(null);
  const fallback = DEFAULT_CATEGORY_FALLBACKS[displayCategory] || DEFAULT_CATEGORY_FALLBACKS.Accessories;
  const imgSrc = !initialImage || failedImage === initialImage ? fallback : initialImage;
  const handleImgError = () => setFailedImage(initialImage);
  const hasWholesalePrice = product.wholesale_price != null && !isNaN(product.wholesale_price) && Number(product.wholesale_price) > 0;
  const hasRetailPrice = product.price != null && !isNaN(product.price) && Number(product.price) > 0;

  // Wholesale user without an explicit wholesale price must NOT have the retail price auto-assigned
  const isWholesaleMissingPrice = wholesaleClient && !hasWholesalePrice;
  const isContactForPrice = isWholesaleMissingPrice || !wholesaleClient && !hasRetailPrice;
  const handleContactForPrice = e => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const inquiryType = wholesaleClient ? 'wholesale pricing' : 'pricing';
    const message = `*Hello! I'm inquiring about ${inquiryType} for:*\n\n- ${displayName}\n\nPlease let me know the price!`;
    const whatsappUrl = whatsappLink(message);
    window.open(whatsappUrl, '_blank');
  };
  const handleCardAddToCart = e => {
    e.stopPropagation();
    e.preventDefault();
    if (unavailable) return;
    if (isContactForPrice) {
      handleContactForPrice(e);
      return;
    }
    const effectivePrice = wholesaleClient && hasWholesalePrice ? Number(product.wholesale_price) : Number(product.price);
    onAddToCart({
      ...product,
      price: effectivePrice,
      name: displayName,
      category: displayCategory,
      images: [imgSrc]
    });
  };
  return <div className="product-card">
            <div className="product-image-container" onClick={() => onImageClick && onImageClick({
      ...product,
      name: displayName,
      category: displayCategory,
      images: [imgSrc]
    })} style={{
      cursor: 'pointer'
    }}>
                <img src={imgSrc} alt={displayName} className="product-image" loading="lazy" onError={handleImgError} />

                <div className="product-overlay">
                    {unavailable ? <span className="stock-badge out">{t("Out of stock")}</span> : isContactForPrice ? <button type="button" className="btn btn-primary add-to-cart-btn contact-action-btn" onClick={handleContactForPrice}>

                            <MessageCircle size={18} />
                            <span>{t("Contact for Price")}</span>
                        </button> : <button type="button" className="btn btn-primary add-to-cart-btn" onClick={handleCardAddToCart}>

                            <ShoppingCart size={18} />
                            <span>{t("Add to Cart")}</span>
                        </button>}
                </div>
            </div>
            <div className="product-info">
                <div className="product-meta-header">
                    <span className="product-category">{t(displayCategory)}</span>
                    {product.brand && <span className="product-brand-tag">{product.brand}</span>}
                </div>
                <h3 className="product-name" title={displayName}>
                    <Link to={`/product/${toProductSlug({
          ...product,
          name: displayName
        })}`} className="product-name-link">
                        {displayName}
                    </Link>
                </h3>
                <p className={`product-stock ${unavailable ? 'out' : ''}`}>{unavailable ? t("Out of stock") : product.in_stock === true ? t("In stock") : t("Confirm availability on WhatsApp")}</p>
                <div className="product-price-block">
                    {wholesaleClient ? hasWholesalePrice ? <>
                                <span className="product-price wholesale-price">
                                    <Price usd={product.wholesale_price} />
                                </span>
                                {hasRetailPrice && <span className="product-price-retail">{t("Retail:")}
              <Price usd={product.price} />
                                    </span>}
                            </> : <button type="button" className="product-price contact-price contact-price-btn" onClick={handleContactForPrice} title="Click to inquire via WhatsApp">{t("Contact for price")}


          </button> : hasRetailPrice ? <span className="product-price"><Price usd={product.price} /></span> : <button type="button" className="product-price contact-price contact-price-btn" onClick={handleContactForPrice} title="Click to inquire via WhatsApp">{t("Contact for price")}


          </button>}
                </div>
            </div>
        </div>;
}
