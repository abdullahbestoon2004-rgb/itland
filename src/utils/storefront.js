import { formatIqd, isFreshRate } from './currency.js';
export const WHATSAPP_NUMBER = '9647504888570';
export const WHATSAPP_DISPLAY = '07504888570';
export const whatsappLink = (message = '') => `https://wa.me/${WHATSAPP_NUMBER}${message ? `?text=${encodeURIComponent(message)}` : ''}`;

// A zero quantity or explicit unavailable flag takes precedence over other stock fields.
export function stockLimit(product) {
    if (product?.in_stock === false) return 0;
    const raw = product?.stock_on_hand;
    if (raw === null || raw === undefined || raw === '') return Infinity;
    const quantity = Number(raw);
    return Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : Infinity;
}

export const isOutOfStock = (product) => stockLimit(product) === 0;

export function cleanDescription(value) {
    return String(value ?? '')
        .split('\n')
        .map((line) => line
            .replace(/\(?\b(?:office|wholesale|purchase|cost)\s*price\b[^\n]*/gi, '')
            .replace(/[ \t]+/g, ' ')
            .replace(/[\s(,;:-]+$/, '')
            .trim())
        .filter(Boolean)
        .join('\n');
}

export function cleanProductName(product) {
    const name = cleanDescription(product?.name);
    const description = cleanDescription(product?.description);
    const title = ((!name || /^\d+$/.test(name) || name.length <= 4) && description.length > 3
        ? description.split('\n')[0] : name) || 'Product';
    if (title.length <= 120) return title;
    const short = title.slice(0, 117);
    const end = short.lastIndexOf(' ');
    return `${short.slice(0, end > 80 ? end : 117).replace(/[\s,;:-]+$/, '')}…`;
}

export function homeProducts(products) {
    const available = products.filter((product) => !isOutOfStock(product) && Number(product.price) > 0);
    const featured = available.filter((product) => product.featured);
    // Products marked Featured in Zoho keep their order; otherwise take one per
    // category in turn so the home page isn't eight variants of one headset.
    return { products: featured.length ? featured.slice(0, 8) : mixCategories(available, 8), featured: featured.length > 0 };
}

function mixCategories(products, count) {
    const byCategory = new Map();
    for (const product of products) {
        const key = product.category ?? '';
        if (!byCategory.has(key)) byCategory.set(key, []);
        byCategory.get(key).push(product);
    }
    const queues = [...byCategory.values()];
    const picked = [];
    while (picked.length < count && queues.some((queue) => queue.length)) {
        for (const queue of queues) {
            if (queue.length && picked.length < count) picked.push(queue.shift());
        }
    }
    return picked;
}

export function orderMessage(items, details = {}, snapshot = null) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return [
        '*Hello IT Land! I would like to request this order:*',
        '',
        ...items.map((item) => `- ${item.name} [${item.id}] (x${item.quantity}) — ${formatIqd(item.price * item.quantity, snapshot) ?? 'please confirm IQD price'}`),
        '',
        `*Product subtotal: ${formatIqd(subtotal, snapshot) ?? 'please confirm IQD total'}*`,
        isFreshRate(snapshot) && `Indicative IQD conversion: 1 USD = ${snapshot.rate} IQD (IQWealth Baghdad market, ${snapshot.asOf}).`,
        'Delivery fee: please confirm.',
        details.name?.trim() ? `Name: ${details.name.trim()}` : null,
        details.city?.trim() ? `City / area: ${details.city.trim()}` : null,
        details.notes?.trim() ? `Notes: ${details.notes.trim()}` : null,
        '',
        'Please confirm availability, delivery fee, delivery time, payment method and final total in IQD.',
        'I understand this is an order request and the order is confirmed only after your reply.',
    ].filter((line) => line !== false && line !== undefined && line !== null).join('\n');
}

export function getCleanProductCategory(product) {
  const cat = product?.category;
  if (cat && cat.toLowerCase() !== 'goods') {
    return cat;
  }
  const text = `${product?.name || ''} ${product?.description || ''}`.toLowerCase();
  if (text.includes('mouse') || text.includes('mice') || text.includes('trackball')) return 'Mice';
  if (text.includes('keyboard') || text.includes('keypad') || text.includes('numaric') || text.includes('numeric')) return 'Keyboards';
  if (text.includes('headset') || text.includes('headphone') || text.includes('earphone') || text.includes('earbuds') || text.includes('airpods')) return 'Headsets';
  if (text.includes('webcam') || text.includes('camera') || text.includes('brio') || text.includes('c920') || text.includes('c270') || text.includes('c310') || text.includes('c922')) return 'Webcams';
  if (text.includes('gaming') || text.includes('lightspeed') || text.includes('pro x') || text.includes('g502') || text.includes('g305') || text.includes('g915') || text.includes('gamepad') || text.includes('controller')) return 'Gaming';
  if (text.includes('mic') || text.includes('microphone') || text.includes('yeti') || text.includes('stream') || text.includes('elgato') || text.includes('capture')) return 'Streaming';
  if (text.includes('speaker') || text.includes('soundbar') || text.includes('audio') || text.includes('bluetooth speaker') || text.includes('hands free') || text.includes('speak 510') || text.includes('sync 20')) return 'Audio';
  return 'Accessories';
}
