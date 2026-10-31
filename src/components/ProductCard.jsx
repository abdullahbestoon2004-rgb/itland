import { useLocale } from '../context/LocaleContext';
import Price from './Price';
import { cleanProductName as getCleanProductName, getCleanProductCategory, isOutOfStock, whatsappLink } from '../utils/storefront';
import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ShoppingCart } from 'lucide-react';
import { toProductSlug } from '../data/products';
import { useWholesale } from '../context/WholesaleContext';
import ProductImage from './ProductImage';
import './ProductCard.css';
export default function ProductCard({
  product,
  onAddToCart,
  onImageClick
}) {
  const {
    t
  } = useLocale();
  const {
    wholesaleClient,
    wholesalePriceOf
  } = useWholesale();
  const unavailable = isOutOfStock(product);
  const displayName = getCleanProductName(product);
  const displayCategory = getCleanProductCategory(product);
  const image = product.images?.[0] || product.image;
  const wholesalePrice = wholesalePriceOf(product);
  const hasWholesalePrice = wholesalePrice > 0;
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
    const effectivePrice = wholesaleClient && hasWholesalePrice ? wholesalePrice : Number(product.price);
    onAddToCart({
      ...product,
      price: effectivePrice,
      name: displayName,
      category: displayCategory
    });
  };
  return <div className="product-card">
            <div className="product-image-container" onClick={() => onImageClick && onImageClick({
      ...product,
      name: displayName,
      category: displayCategory
    })} style={{
      cursor: 'pointer'
    }}>
                <ProductImage src={image} alt={displayName} category={displayCategory} className="product-image" loading="lazy" />

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
                                    <Price usd={wholesalePrice} />
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
