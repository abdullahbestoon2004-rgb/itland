import { absoluteUrl, brandPath, CATEGORIES, shortProductTitle } from '../utils/seo';
import { usePageData } from '../context/PageDataContext';
import { useLocale } from '../context/LocaleContext';
import { useCurrency } from '../context/CurrencyContext';
import { formatIqd, isFreshRate, toIqd } from '../utils/currency';
import Price from '../components/Price';
import { isOutOfStock, relatedProducts, whatsappLink } from '../utils/storefront';
import { fill } from '../utils/locale';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, MessageCircle, ShoppingCart, Truck } from 'lucide-react';
import { getAllProducts, getProductBySlug, toProductSlug } from '../data/products';
import { useWholesale } from '../context/WholesaleContext';
import usePageMeta, { SITE_URL } from '../hooks/usePageMeta';
import ProductImage from '../components/ProductImage';
import ProductCard from '../components/ProductCard';
import CityLinks from '../components/CityLinks';
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
  const navigate = useNavigate();
  const initial = usePageData();
  const [loaded, setLoaded] = useState({
    slug: initial.slug ?? null,
    product: initial.product ?? null,
    related: initial.related ?? [],
    state: initial.slug ? (initial.product ? 'ready' : 'missing') : 'loading'
  });
  useEffect(() => {
    let ignore = false;
    // Both read the same cached catalog, so this is one request.
    Promise.all([getProductBySlug(slug), getAllProducts()]).then(([found, catalog]) => {
      if (ignore) return;
      setLoaded({
        slug,
        product: found,
        related: relatedProducts(found, catalog),
        state: found ? 'ready' : 'missing'
      });
    }).catch(() => {
      if (!ignore) setLoaded({
        slug,
        product: null,
        related: [],
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
  const related = isCurrent ? loaded.related : [];
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
  const categoryPath = product && CATEGORIES.includes(product.category) ? `/products?category=${encodeURIComponent(product.category)}` : null;
  const jsonLd = useMemo(() => {
    if (!product) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': `${SITE_URL}/product/${toProductSlug(product)}#product`,
      url: `${SITE_URL}/product/${toProductSlug(product)}`,
      name: product.name,
      description,
      image: images.length ? images.map(absoluteUrl) : undefined,
      brand: product.brand ? {
        '@type': 'Brand',
        name: product.brand
      } : undefined,
      category: product.category,
      // Everything is sold new unless the listing itself says otherwise.
      ...(/open box|used|refurb/i.test(product.name) ? {} : { itemCondition: 'https://schema.org/NewCondition' }),
      sku: product.id,
      // Logitech part numbers (910-001935) identify the exact model and colour.
      mpn: product.brand === 'Logitech' ? `${product.name} ${product.description ?? ''}`.match(/\b9\d{2}-\d{6}\b/)?.[0] : undefined,
      offers: isFreshRate(snapshot) && hasRetailPrice ? {
        '@type': 'Offer',
        url: `${SITE_URL}/product/${toProductSlug(product)}`,
        seller: { '@type': 'ComputerStore', '@id': `${SITE_URL}/#store`, name: 'IT Land' },
        priceCurrency: 'IQD',
        price: String(toIqd(product.price ?? 0, snapshot)),
        ...(product.in_stock != null ? { availability: product.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } : {})
      } : undefined
    };
  }, [product, description, images, snapshot, hasRetailPrice]);
  const shortName = product ? shortProductTitle(product.name) : '';
  const titleName = product ? shortProductTitle(product.name, 42) : '';
  const iqdPrice = hasRetailPrice ? formatIqd(product.price, snapshot) : null;
  const stockText = !product ? '' : isOutOfStock(product) ? t('Currently out of stock, ask us about restocking.') : product.in_stock === true ? t('In stock.') : '';
  usePageMeta({
    // The name is kept short enough for "Price in Iraq" to stay visible in a search result.
    title: product ? fill(t('{name} Price in Iraq'), { name: titleName }) : 'Product',
    description: product ? `${fill(iqdPrice ? t('{name} price in Iraq: {price} at IT Land, Erbil.') : t('{name} price in Iraq at IT Land, Erbil.'), { name: titleName, price: iqdPrice })} ${stockText} ${t('Delivery across Iraq and Kurdistan. Order on WhatsApp.')}` : description,
    image: images[0],
    type: product ? 'product' : undefined,
    path: product ? `/product/${toProductSlug(product)}` : undefined,
    jsonLd: product ? [jsonLd, {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_URL}/products` },
        ...(categoryPath ? [{ '@type': 'ListItem', position: 3, name: product.category, item: `${SITE_URL}${categoryPath}` }] : []),
        { '@type': 'ListItem', position: categoryPath ? 4 : 3, name: product.name, item: `${SITE_URL}/product/${toProductSlug(product)}` }
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
  const variants = product.variants ?? [];
  const currentColour = variants.find(variant => String(variant.id) === String(product.id))?.colour;
  // Photos on the left as a grid of tiles; name, price and the one main action on the right.
  return <div className="product-details-page">
            <div className="section-container">
                <nav className="product-breadcrumb" aria-label="Breadcrumb">
                    <Link to="/">{t("Home")}</Link>
                    <span aria-hidden="true">›</span>
                    <Link to="/products">{t("Products")}</Link>
                    <span aria-hidden="true">›</span>
                    {categoryPath && <>
                            <Link to={categoryPath}>{t(product.category)}</Link>
                            <span aria-hidden="true">›</span>
                        </>}
                    <span className="breadcrumb-current">{product.name}</span>
                </nav>

                <div className="product-details-grid">
                    <div className={`product-details-gallery ${images.length > 1 ? 'product-details-gallery--grid' : ''}`}>
                        {(images.length ? images.slice(0, 4) : [null]).map((image, index) => <div key={image ?? 'none'} className="details-main-image">
                                {unavailable && index === 0 && <span className="stock-badge out">{t("Out of stock")}</span>}
                                <ProductImage src={image} alt={index === 0 ? product.name : ''} category={product.category} loading={index === 0 ? undefined : 'lazy'} />
                            </div>)}
                    </div>

                    <div className="product-details-info">
                        {product.brand && <p className="details-brand"><Link to={brandPath(product.brand)}>{product.brand}</Link></p>}
                        <h1 className="details-name">{shortName}</h1>
                        {product.tagline && <p className="details-tagline">{product.tagline}</p>}

                        {wholesaleClient ? hasWholesalePrice ? <div className="details-price-block">
                                    <div className="details-price details-price-wholesale">
                                        <Price usd={wholesalePrice} />
                                        <span className="details-wholesale-badge">{t("Wholesale")}</span>
                                    </div>
                                    {hasRetailPrice && <p className="details-price-retail">{t("Retail:")}<Price usd={product.price} /></p>}
                                </div> : <p className="details-price details-price-contact">{t("Contact for price")}</p> : hasRetailPrice ? <p className="details-price"><Price usd={product.price} /></p> : <p className="details-price details-price-contact">{t("Contact for price")}</p>}

                        {variants.length > 1 && <div className="details-colours">
                                <p><strong>{t("Colour")}</strong> {currentColour}</p>
                                <div className="details-swatches">
                                    {variants.map(variant => <Link key={variant.id} to={`/product/${toProductSlug(variant)}`} className={`details-swatch ${String(variant.id) === String(product.id) ? 'active' : ''}`} style={{
                backgroundColor: variant.hex
              }} title={variant.colour} aria-label={variant.colour} aria-current={String(variant.id) === String(product.id) ? 'true' : undefined} />)}
                                </div>
                            </div>}

                        {!unavailable && product.in_stock === true && <p className="details-stock in">{t("In stock")}</p>}
                        {unavailable && <p className="details-stock out">{t("Currently out of stock")}</p>}

                        <div className="details-actions">
                            {unavailable ? <a className="btn btn-secondary" href={whatsappLink(`Hello! When will ${product.name} be available again?`)} target="_blank" rel="noreferrer">{t("Ask about restocking")}</a> : isContactForPrice ? <a className="btn btn-primary details-cart-btn details-contact-btn" href={whatsappLink(decodeURIComponent(whatsappMessage))} target="_blank" rel="noreferrer">
                                    <MessageCircle size={18} />{t("Contact for Price")}
              </a> : <>
                                    <button type="button" className="btn btn-primary details-cart-btn" onClick={handlePageAddToCart}>
                                        <ShoppingCart size={18} />{t("Add to Cart")}
                </button>
                                    <a className="btn btn-secondary details-whatsapp-btn" href={whatsappLink(decodeURIComponent(whatsappMessage))} target="_blank" rel="noreferrer">
                                        <MessageCircle size={18} />{t("Buy on WhatsApp")}
                </a>
                                </>}
                        </div>

                        <p className="order-note details-note"><Truck size={20} aria-hidden="true" /><span>{t("Delivery across all Iraq and Kurdistan. Delivery fee, timing, payment method and final total confirmed on WhatsApp. Your order is confirmed after our team replies.")}</span></p>
                        <CityLinks className="details-cities" />

                        <div className="details-rows">
                            {product.description && <details className="details-row" open>
                                    <summary>{t("Description")}<ChevronDown size={20} aria-hidden="true" /></summary>
                                    <div className="details-description">
                                        {product.description.split('\n').filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}
                                    </div>
                                </details>}
                            <Link className="details-row details-row-link" to="/help/delivery">{t("How WhatsApp orders work")}<ChevronRight size={20} aria-hidden="true" /></Link>
                            <Link className="details-row details-row-link" to="/help/warranty">{t("Warranty")}<ChevronRight size={20} aria-hidden="true" /></Link>
                            <Link className="details-row details-row-link" to="/help/returns">{t("Returns")}<ChevronRight size={20} aria-hidden="true" /></Link>
                        </div>
                    </div>
                </div>

                {related.length > 0 && <section className="related-products" aria-labelledby="related-products-title">
                        <div className="section-header section-header-row">
                            <h2 id="related-products-title" className="section-title">{t("Related products")}</h2>
                            {CATEGORIES.includes(product.category) && <Link to={`/products?category=${encodeURIComponent(product.category)}`} className="view-all-link">{t("More in this category")}</Link>}
                        </div>
                        <div className="products-grid">
                            {related.map(item => <ProductCard key={item.id} product={item} onAddToCart={handleAddToCart} onImageClick={card => navigate(`/product/${toProductSlug(card)}`)} />)}
                        </div>
                    </section>}
            </div>
        </div>;
}
