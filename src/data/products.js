import productImagesMap from './productImages.json';
import fallbackCatalog from './productCatalog.json';

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=600&auto=format&fit=crop';

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

function getCleanTitle(p) {
  const name = (p.name || '').trim();
  const desc = (p.description || '').trim();
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

const normalizeProduct = (product, index = 0) => {
  const id = String(product.id ?? product.zoho_item_id ?? index);
  const zohoId = product.zoho_item_id ? String(product.zoho_item_id) : null;
  const fullText = `${product.name || ''} ${product.description || ''}`.trim();
  
  // Real image lookup
  const lookupImage = productImagesMap[id] || (zohoId ? productImagesMap[zohoId] : null) || (product.name ? productImagesMap[product.name] : null);
  const existingImages = Array.isArray(product.images) && product.images.length > 0 && product.images[0] !== PLACEHOLDER_IMAGE
    ? product.images
    : lookupImage ? [lookupImage] : (product.image && product.image !== PLACEHOLDER_IMAGE ? [product.image] : [lookupImage || PLACEHOLDER_IMAGE]);

  const brand = product.brand && product.brand !== '' ? product.brand : detectBrand(fullText);
  const rawCat = product.category || '';
  const category = rawCat && rawCat.toLowerCase() !== 'goods' ? rawCat : detectCategory(fullText);
  const cleanName = getCleanTitle(product);

  return {
    id: id,
    zoho_item_id: zohoId,
    name: cleanName,
    original_name: product.name ?? '',
    category: category,
    brand: brand,
    price: Number(product.price ?? 0),
    wholesale_price: product.wholesale_price != null ? Number(product.wholesale_price) : null,
    description: product.description ?? '',
    images: existingImages,
    featured: Boolean(product.featured),
    order_index: product.order_index ?? index,
  };
};

export const getAllProducts = async () => {
  try {
    const res = await fetch('/api/products');
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
  return (fallbackCatalog ?? []).map((p, i) => normalizeProduct(p, i));
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

