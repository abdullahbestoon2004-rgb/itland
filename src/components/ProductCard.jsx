import { useLocale } from '../context/LocaleContext';
import Price from './Price';
import { cleanProductName as getCleanProductName, getCleanProductCategory, isOutOfStock, whatsappLink } from '../utils/storefront';
import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ShoppingCart } from 'lucide-react';
import { toProductSlug } from '../data/products';
import { shortProductTitle } from '../utils/seo';
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
  const openPreview = () => onImageClick && onImageClick({
    ...product,
    name: displayName,
    category: displayCategory
  });
  const retailPrice = hasRetailPrice ? <span className="product-price"><Price usd={product.price} /></span> : <button type="button" className="product-price contact-price contact-price-btn" onClick={handleContactForPrice} title="Click to inquire via WhatsApp">{t("Contact for price")}</button>;
  // A grey tile with the photo, then the name, a short line of detail, and the
  // price next to the action — the same order on every card.
  return <div className="product-card">
            <div className="product-image-container" onClick={openPreview} style={{
      cursor: 'pointer'
    }}>
                {unavailable && <span className="stock-badge out">{t("Out of stock")}</span>}
                <ProductImage src={image} alt={displayName} category={displayCategory} className="product-image" loading="lazy" />
                {product.variants?.length > 1 && <div className="product-swatches" role="group" aria-label={t("Colours")}>
                        {product.variants.map(variant => <Link key={variant.id} to={`/product/${toProductSlug(variant)}`} className={`product-swatch ${String(variant.id) === String(product.id) ? 'active' : ''}`} style={{
          backgroundColor: variant.hex
        }} title={variant.colour} aria-label={variant.colour} onClick={event => event.stopPropagation()} />)}
                    </div>}
            </div>
            <div className="product-info">
                <h3 className="product-name" title={displayName}>
                    <Link to={`/product/${toProductSlug({
          ...product,
          name: displayName
        })}`} className="product-name-link">
                        {shortProductTitle(displayName)}
                    </Link>
                </h3>
                {product.tagline ? <p className="product-tagline">{product.tagline}</p> : <div className="product-meta-header">
                    <span className="product-category">{t(displayCategory)}</span>
                    {product.brand && <span className="product-brand-tag">{product.brand}</span>}
                </div>}
                {!unavailable && <p className={`product-stock ${product.in_stock === true ? 'in' : ''}`}>{product.in_stock === true ? t("In stock") : t("Confirm availability on WhatsApp")}</p>}
                <div className="product-footer">
                    <div className="product-price-block">
                        {wholesaleClient ? hasWholesalePrice ? <>
                                <span className="product-price wholesale-price">
                                    <Price usd={wholesalePrice} />
                                </span>
                                {hasRetailPrice && <span className="product-price-retail">{t("Retail:")}
              <Price usd={product.price} />
                                    </span>}
                            </> : <button type="button" className="product-price contact-price contact-price-btn" onClick={handleContactForPrice} title="Click to inquire via WhatsApp">{t("Contact for price")}</button> : retailPrice}
                    </div>
                    {unavailable ? null : isContactForPrice ? <button type="button" className="product-action contact-action-btn" onClick={handleContactForPrice}>
                            <span>{t("Contact for Price")}</span>
                            <MessageCircle size={18} aria-hidden="true" />
                        </button> : <button type="button" className="product-action add-to-cart-btn" onClick={handleCardAddToCart}>
                            <span>{t("Add to Cart")}</span>
                            <ShoppingCart size={18} aria-hidden="true" />
                        </button>}
                </div>
            </div>
        </div>;
}
