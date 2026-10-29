import { cleanDescription, cleanProductName, stockLimit } from '../utils/storefront';
// The stand-in photo (a games controller) once sent for products without one.
// Cached API responses and saved carts may still contain it; it is dropped so
// the category icon shows instead.
export const LEGACY_PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=600&auto=format&fit=crop';
export const realImages = (images) => (Array.isArray(images) ? images : []).filter((src) => src && src !== LEGACY_PLACEHOLDER_IMAGE);

const KNOWN_BRANDS = [
  'Logitech', 'Razer', 'Onten', 'Lention', 'Anker', 'Elgato', 'JBL', 'Poly', 'Plantronics',
  'Jabra', 'Apple', 'Dell', 'Sony', 'Samsung', 'HyperX', 'SteelSeries', 'Corsair', 'Redragon',
  'Baseus', 'UGREEN', 'AULA', 'Fifine', 'Maono', 'Bose', 'Sennheiser', 'Audio-Technica',
  'Sandisk', 'Kingston', 'Western Digital', 'WD', 'Seagate', 'TP-Link', 'D-Link', 'Mercusys',
  'Lenovo', 'HP', 'Asus', 'Acer', 'MSI', 'Xiaomi', 'Hikvision', 'Dahua', 'EZVIZ', 'Crucial',
  'Belkin', 'Promate', 'Porodo', 'Green Lion', 'Hoco', 'Borofone', 'Meetion', 'Fantech', 'A4Tech', 'Bloody'
];

function detectBrand(text) {
  const t = (text || '').toLowerCase();
  for (const b of KNOWN_BRANDS) {
    if (t.includes(b.toLowerCase())) {
      if (b === 'Plantronics') return 'Poly';
      return b;
    }
  }
  return '';
}

function detectCategory(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('mouse') || t.includes('mice') || t.includes('trackball')) return 'Mice';
  if (t.includes('keyboard') || t.includes('keypad') || t.includes('numaric') || t.includes('numeric')) return 'Keyboards';
  if (t.includes('headset') || t.includes('headphone') || t.includes('earphone') || t.includes('earbuds') || t.includes('airpods')) return 'Headsets';
  if (t.includes('webcam') || t.includes('camera') || t.includes('brio') || t.includes('c920') || t.includes('c270') || t.includes('c310') || t.includes('c922')) return 'Webcams';
  if (t.includes('gaming') || t.includes('lightspeed') || t.includes('pro x') || t.includes('g502') || t.includes('g305') || t.includes('g915') || t.includes('gamepad') || t.includes('controller')) return 'Gaming';
  if (t.includes('mic') || t.includes('microphone') || t.includes('yeti') || t.includes('stream') || t.includes('elgato') || t.includes('capture')) return 'Streaming';
  if (t.includes('speaker') || t.includes('soundbar') || t.includes('audio') || t.includes('bluetooth speaker') || t.includes('hands free') || t.includes('speak 510') || t.includes('sync 20')) return 'Audio';
  return 'Accessories';
}

// These two JSON files are ~1MB together, and only needed if the API is down —
// the API already applies the image map. Loading them on demand keeps them out
// of the initial bundle.
let imagesMapPromise = null;
const loadProductImages = () => {
  imagesMapPromise ??= import('./productImages.json').then((module) => module.default);
  return imagesMapPromise;
};

let fallbackCatalogPromise = null;
const loadFallbackCatalog = () => {
  fallbackCatalogPromise ??= import('./productCatalog.json').then((module) => module.default);
  return fallbackCatalogPromise;
};

export const normalizeProduct = (product, index = 0, productImagesMap = {}) => {
  const id = String(product.id ?? product.zoho_item_id ?? index);
  const zohoId = product.zoho_item_id ? String(product.zoho_item_id) : null;
  const fullText = `${product.name || ''} ${product.description || ''}`.trim();
  
  // Real image lookup
  const lookupImage = productImagesMap[id] || (zohoId ? productImagesMap[zohoId] : null) || (product.name ? productImagesMap[product.name] : null);
  const ownImages = realImages(product.images);
  const images = ownImages.length > 0 ? ownImages : lookupImage ? [lookupImage] : realImages([product.image]);

  const brand = product.brand && product.brand !== '' ? product.brand : detectBrand(fullText);
  const rawCat = product.category || '';
  const category = rawCat && rawCat.toLowerCase() !== 'goods' ? rawCat : detectCategory(fullText);
  const cleanName = cleanProductName(product);

  return {
    id: id,
    zoho_item_id: zohoId,
    name: cleanName,
    original_name: product.name ?? '',
    category: category,
    brand: brand,
    price: Number(product.price ?? 0),
    wholesale_price: product.wholesale_price != null ? Number(product.wholesale_price) : null,
    description: cleanDescription(product.description),
    images,
    featured: Boolean(product.featured),
    stock_on_hand: product.stock_on_hand != null ? Number(product.stock_on_hand) : null,
    in_stock: stockLimit(product) === 0 ? false : (product.in_stock === true || Number(product.stock_on_hand) > 0 ? true : null),
    order_index: product.order_index ?? index,
  };
};

/** Turns a product into a stable, readable URL slug: "logitech-b100-mouse-12345". */
export { toProductSlug } from '../utils/seo.js';

/** The id is the trailing segment of the slug, so renamed products keep working. */
export const productIdFromSlug = (slug) => {
  const parts = String(slug ?? '').split('-');
  return parts[parts.length - 1] || '';
};

const fetchProducts = async () => {
  try {
    const res = await fetch('/api/products', { signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const { products } = await res.json();
      if (Array.isArray(products) && products.length > 0) {
        return products.map((p, i) => normalizeProduct(p, i));
      }
    }
  } catch (err) {
    console.warn('API unavailable, serving from built-in product catalog:', err);
  }

  // Fallback to built-in product catalog
  const [fallbackCatalog, imagesMap] = await Promise.all([loadFallbackCatalog(), loadProductImages()]);
  return (fallbackCatalog ?? []).map((p, i) => normalizeProduct(p, i, imagesMap));
};

let productCache = null;
let productCacheAt = 0;
let pendingProducts = null;
export const getAllProducts = async () => {
  if (productCache && Date.now() - productCacheAt < 60_000) return productCache;
  if (pendingProducts) return pendingProducts;
  pendingProducts = fetchProducts().then((products) => {
    productCache = products;
    productCacheAt = Date.now();
    return products;
  }).finally(() => { pendingProducts = null; });
  return pendingProducts;
};

/**
 * The admin view: includes wholesale prices and, unlike getAllProducts, never
 * falls back to the built-in catalog — the dashboard must show Zoho's real state.
 * `refresh` asks the server to bypass its one-hour cache (throttled to every 30s).
 */
export const getAdminProducts = async ({ accessToken, refresh = false }) => {
  const res = await fetch(`/api/products?view=admin${refresh ? '&refresh=1' : ''}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data.products)) {
    throw new Error(data.error || `Product request failed (HTTP ${res.status}).`);
  }
  return {
    products: data.products.map((p, i) => normalizeProduct(p, i)),
    stale: Boolean(data.stale),
    refreshed: Boolean(data.refreshed),
  };
};

export const getProductBySlug = async (slug) => {
  const id = productIdFromSlug(slug);
  if (!id) return null;

  const products = await getAllProducts();
  return products.find((product) => String(product.id) === id) ?? null;
};

export const saveProduct = async () => {
  throw new Error('Products are managed in Zoho Books.');
};

export const deleteProduct = async () => {
  throw new Error('Products are managed in Zoho Books.');
};

export const saveProductOrder = async () => {
  // No-op: order comes from Zoho item list order.
};

