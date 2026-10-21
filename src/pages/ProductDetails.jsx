import { absoluteUrl } from '../utils/seo';
import { usePageData } from '../context/PageDataContext';
import { useLocale } from '../context/LocaleContext';
import { useCurrency } from '../context/CurrencyContext';
import { formatIqd, isFreshRate } from '../utils/currency';
import Price from '../components/Price';
import { isOutOfStock, whatsappLink } from '../utils/storefront';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MessageCircle, ShoppingCart } from 'lucide-react';
import { getProductBySlug, toProductSlug } from '../data/products';
import { useWholesale } from '../context/WholesaleContext';
import usePageMeta, { SITE_URL } from '../hooks/usePageMeta';
import './ProductDetails.css';
export default function ProductDetails() {
  const {
    t
  } = useLocale();
  const {
    slug
  } = useParams();
  const {
    handleAddToCart
  } = useOutletContext();
  const {
    snapshot
  } = useCurrency();
  const {
    wholesaleClient,
    wholesalePriceOf
  } = useWholesale();
  const initial = usePageData();
  const [loaded, setLoaded] = useState({
    slug: initial.slug ?? null,
    product: initial.product ?? null,
    state: initial.slug ? (initial.product ? 'ready' : 'missing') : 'loading'
  });
  const [imageIndex, setImageIndex] = useState(0);
  useEffect(() => {
    let ignore = false;
    getProductBySlug(slug).then(found => {
      if (ignore) return;
      setImageIndex(0);
      setLoaded({
        slug,
        product: found,
        state: found ? 'ready' : 'missing'
      });
    }).catch(() => {
      if (!ignore) setLoaded({
        slug,
        product: null,
        state: 'error'
      });
    });
    return () => {
      ignore = true;
    };
  }, [slug]);

  // Until this slug's fetch lands, treat the route as loading rather than
  // showing the product we were looking at a moment ago.
  const isCurrent = loaded.slug === slug;
  const product = isCurrent ? loaded.product : null;
  const state = isCurrent ? loaded.state : 'loading';
  const images = useMemo(() => product?.images?.length ? product.images : [], [product]);
  const description = useMemo(() => {
    const raw = (product?.description ?? '').trim();
    if (raw) return raw.slice(0, 300);
    return product ? `${product.name} — available at IT Land, Erbil. ${product.brand || ''}`.trim() : '';
  }, [product]);
  const wholesalePrice = wholesalePriceOf(product);
  const hasWholesalePrice = wholesalePrice > 0;
  const hasRetailPrice = product?.price != null && !isNaN(product.price) && Number(product.price) > 0;
  const isWholesaleMissingPrice = wholesaleClient && !hasWholesalePrice;
  const isContactForPrice = isWholesaleMissingPrice || !wholesaleClient && !hasRetailPrice;
  const activePrice = wholesaleClient && hasWholesalePrice ? wholesalePrice : Number(product?.price ?? 0);
  const jsonLd = useMemo(() => {
    if (!product) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': `${SITE_URL}/product/${toProductSlug(product)}#product`,
      url: `${SITE_URL}/product/${toProductSlug(product)}`,
      name: product.name,
      description,
      image: images.map(absoluteUrl),
      brand: product.brand ? {
        '@type': 'Brand',
        name: product.brand
      } : undefined,
      category: product.category,
      sku: product.id,
      offers: isFreshRate(snapshot) && hasRetailPrice ? {
        '@type': 'Offer',
        url: `${SITE_URL}/product/${toProductSlug(product)}`,
        priceCurrency: 'IQD',
        price: String(Math.round(Number(product.price ?? 0) * snapshot.rate)),
        ...(product.in_stock != null ? { availability: product.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } : {})
      } : undefined
    };
  }, [product, description, images, snapshot, hasRetailPrice]);
  usePageMeta({
    title: product ? product.name : 'Product',
    description,
    image: images[0],
    path: product ? `/product/${toProductSlug(product)}` : undefined,
    jsonLd: product ? [jsonLd, {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_URL}/products` },
        { '@type': 'ListItem', position: 3, name: product.name, item: `${SITE_URL}/product/${toProductSlug(product)}` }
      ]
    }] : null,
    noindex: state === 'missing' || state === 'error'
  });
  if (state === 'loading') {
    return <div className="product-details-state">{t("Loading product\u2026")}</div>;
  }
  if (state === 'missing') {
    return <div className="product-details-state">
                <h1>{t("Product not found")}</h1>
                <p>This product may have sold out or been renamed.</p>
                <Link to="/products" className="btn btn-primary">{t("Browse all products")}</Link>
            </div>;
  }
  if (state === 'error') {
    return <div className="product-details-state">
                <h1>{t("Something went wrong")}</h1>
                <p>We could not load this product. Please try again.</p>
                <Link to="/products" className="btn btn-primary">{t("Browse all products")}</Link>
            </div>;
  }
  const whatsappMessage = encodeURIComponent(isContactForPrice ? `*Hello! I'm inquiring about ${wholesaleClient ? 'wholesale pricing' : 'pricing'} for:*\n\n- ${product.name}\n${SITE_URL}/product/${toProductSlug(product)}\n\nPlease let me know the price!` : `*Hello! I'm interested in buying this product:*\n\n- ${product.name} - ${formatIqd(activePrice, snapshot) ?? 'Please confirm IQD price'}\n${SITE_URL}/product/${toProductSlug(product)}\n\nPlease let me know if it's available!`);
  const unavailable = isOutOfStock(product);
  const handlePageAddToCart = () => {
    if (unavailable) return;
    if (isContactForPrice) {
      window.open(whatsappLink(decodeURIComponent(whatsappMessage)), '_blank');
      return;
    }
    handleAddToCart({
      ...product,
      price: activePrice
    });
  };
  return <div className="product-details-page">
            <div className="section-container">
                <nav className="product-breadcrumb" aria-label="Breadcrumb">
                    <Link to="/">{t("Home")}</Link>
                    <span aria-hidden="true">/</span>
                    <Link to="/products">{t("Products")}</Link>
                    <span aria-hidden="true">/</span>
                    <span className="breadcrumb-current">{product.name}</span>
                </nav>

                <div className="product-details-grid">
                    <div className="product-details-gallery">
                        <div className="details-main-image">
                            {images.length > 1 && <button type="button" className="details-nav prev" onClick={() => setImageIndex(i => i === 0 ? images.length - 1 : i - 1)} aria-label={t("Previous image")}>

                                    <ChevronLeft size={28} />
                                </button>}

                            <img src={images[imageIndex]} alt={product.name} />

                            {images.length > 1 && <button type="button" className="details-nav next" onClick={() => setImageIndex(i => i === images.length - 1 ? 0 : i + 1)} aria-label={t("Next image")}>

                                    <ChevronRight size={28} />
                                </button>}
                        </div>

                        {images.length > 1 && <div className="details-thumbs">
                                {images.map((image, index) => <button type="button" key={image} className={`details-thumb ${index === imageIndex ? 'active' : ''}`} onClick={() => setImageIndex(index)} aria-label={`View image ${index + 1}`}>

                                        <img src={image} alt="" />
                                    </button>)}
                            </div>}
                    </div>

                    <div className="product-details-info">
                        <p className="details-category">{t(product.category)}</p>
                        <h1 className="details-name">{product.name}</h1>
                        {product.brand && <p className="details-brand">by {product.brand}</p>}

                        {wholesaleClient ? hasWholesalePrice ? <div className="details-price-block">
                                    <div className="details-price details-price-wholesale">
                                        <Price usd={wholesalePrice} />
                                        <span className="details-wholesale-badge">{t("Wholesale")}</span>
                                    </div>
                                    {hasRetailPrice && <p className="details-price-retail">{t("Retail:")}<Price usd={product.price} /></p>}
                                </div> : <p className="details-price details-price-contact">{t("Contact for price")}</p> : hasRetailPrice ? <p className="details-price"><Price usd={product.price} /></p> : <p className="details-price details-price-contact">{t("Contact for price")}</p>}

                        {!unavailable && product.in_stock === true && <p className="details-stock in">{t("In stock")}</p>}
                        {unavailable && <p className="details-stock out">{t("Currently out of stock")}</p>}

                        {product.description && <div className="details-description">
                                {product.description.split('\n').filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}
                            </div>}

                        <p className="order-note">{t("Delivery across all Iraq and Kurdistan. Delivery fee, timing, payment method and final total confirmed on WhatsApp. Your order is confirmed after our team replies.")}</p>
                        <Link className="help-inline-link" to="/help/delivery">{t("How WhatsApp orders work")}</Link>
                        <div className="details-actions">
                            {unavailable ? <a className="btn btn-secondary" href={whatsappLink(`Hello! When will ${product.name} be available again?`)} target="_blank" rel="noreferrer">{t("Ask about restocking")}</a> : isContactForPrice ? <a className="btn btn-primary details-cart-btn details-contact-btn" href={whatsappLink(decodeURIComponent(whatsappMessage))} target="_blank" rel="noreferrer">

                                    <MessageCircle size={18} />{t("Contact for Price")}
              </a> : <>
                                    <button type="button" className="btn btn-primary details-cart-btn" onClick={handlePageAddToCart}>

                                        <ShoppingCart size={18} />{t("Add to Cart")}
                </button>

                                    <a className="btn details-whatsapp-btn" href={whatsappLink(decodeURIComponent(whatsappMessage))} target="_blank" rel="noreferrer">

                                        <MessageCircle size={18} />{t("Buy on WhatsApp")}
                </a>
                                </>}
                        </div>
                    </div>
                </div>
            </div>
        </div>;
}
