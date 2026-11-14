import { formatIqd, formatIqdAmount, iqdTotal, isFreshRate } from './currency.js';
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

// The stand-in photo (a PS4 controller) the site once used for products without
// one. Old API responses, saved carts or a pasted Zoho "Image URL" may still
// carry it, at any size; it counts as no photo, so the category icon shows.
const PLACEHOLDER_PHOTO_ID = 'photo-1552820728-8b83bb6b773f';
export const isPlaceholderImage = (src) => String(src ?? '').includes(PLACEHOLDER_PHOTO_ID);

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

const hasPhoto = (product) => Boolean(product.images?.[0] || product.image);

// The shop's calendar day in Erbil (UTC+3) as a whole number that goes up by
// one at local midnight. The home page uses it to change its picks daily.
export const shopDay = (now = Date.now()) => Math.floor((Number(now) + 3 * 3600_000) / 86_400_000);

const HOME_COUNT = 8;

export function homeProducts(products, day = shopDay()) {
    const inStock = products.filter((product) => !isOutOfStock(product) && Number(product.price) > 0);
    const featured = inStock.filter((product) => product.featured);
    // A short list marked Featured in Zoho is shown as it is, in Zoho's order.
    if (featured.length && featured.length <= HOME_COUNT) return { products: featured, featured: true };
    // Otherwise the row changes every day. A card without a photo is a blank
    // tile, so those only fill the row when there are not enough with one.
    const pool = featured.length ? featured : inStock;
    const picked = dailyMix(pool.filter(hasPhoto), HOME_COUNT, day);
    if (picked.length < HOME_COUNT) picked.push(...dailyMix(pool.filter((product) => !hasPhoto(product)), HOME_COUNT - picked.length, day));
    return { products: picked, featured: featured.length > 0 };
}

function stableHash(value) {
    let hash = 2166136261;
    for (const char of String(value)) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
    return hash >>> 0;
}

// One product per category in turn, so the row isn't eight variants of one
// headset. Each category keeps a fixed shuffled order and starts further along
// it each day, so today's picks are not yesterday's and every product gets a turn.
function dailyMix(products, count, day) {
    const byCategory = new Map();
    for (const product of products) {
        const key = product.category ?? '';
        if (!byCategory.has(key)) byCategory.set(key, []);
        byCategory.get(key).push(product);
    }
    const perCategory = Math.ceil(count / Math.max(1, byCategory.size));
    const queues = [...byCategory.values()].map((list) => {
        if (list.length <= perCategory) return [...list];
        const shuffled = list.map((product, index) => ({ product, index, order: stableHash(product.id ?? index) }))
            .sort((first, second) => first.order - second.order || first.index - second.index)
            .map((entry) => entry.product);
        const start = ((day * perCategory) % shuffled.length + shuffled.length) % shuffled.length;
        return [...shuffled.slice(start), ...shuffled.slice(0, start)];
    });
    const picked = [];
    while (picked.length < count && queues.some((queue) => queue.length)) {
        for (const queue of queues) {
            if (queue.length && picked.length < count) picked.push(queue.shift());
        }
    }
    return picked;
}

const COMMON_NAME_WORDS = new Set(['the', 'and', 'for', 'with', 'wireless', 'wired', 'usb', 'bluetooth', 'black', 'white', 'grey', 'gray', 'graphite', 'new', 'logitech', 'logi']);
const nameWords = (product) => new Set(cleanProductName(product).toLowerCase().split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !/^\d+$/.test(word) && !COMMON_NAME_WORDS.has(word)));

// Products to suggest under a product page, from the same category or brand.
// Each scores for sharing the category (most), the brand, and model words
// (G502, Blackwire, Signature), and loses points the further its price is from
// this product's, so a $38 speaker suggests other desktop speakers before a
// $400 conference dock. Sold-out items are left out, and listings that share a
// name (one model under several barcodes) appear once.
export function relatedProducts(product, catalog, count = 8) {
    if (!product) return [];
    const category = getCleanProductCategory(product);
    const brand = (product.brand ?? '').toLowerCase();
    const price = Number(product.price) || 0;
    const words = nameWords(product);
    const candidates = [];
    catalog.forEach((item, index) => {
        if (String(item.id) === String(product.id) || isOutOfStock(item)) return;
        const sameCategory = getCleanProductCategory(item) === category;
        const sameBrand = Boolean(brand) && (item.brand ?? '').toLowerCase() === brand;
        if (!sameCategory && !sameBrand) return;
        let shared = 0;
        for (const word of nameWords(item)) if (words.has(word)) shared += 1;
        const priceGap = Math.abs(Math.log((Number(item.price) || 0) + 1) - Math.log(price + 1));
        candidates.push({
            item,
            index,
            score: (sameCategory ? 3 : 0) + (sameBrand ? 1 : 0) + Math.min(shared, 3) - priceGap,
            hasImage: item.images?.length > 0 ? 1 : 0,
        });
    });
    candidates.sort((a, b) => b.score - a.score || b.hasImage - a.hasImage || a.index - b.index);
    const seen = new Set([cleanProductName(product).toLowerCase()]);
    const picked = [];
    for (const { item } of candidates) {
        const name = cleanProductName(item).toLowerCase();
        if (seen.has(name)) continue;
        seen.add(name);
        picked.push(item);
        if (picked.length === count) break;
    }
    return picked;
}

export function orderMessage(items, details = {}, snapshot = null) {
    return [
        '*Hello IT Land! I would like to request this order:*',
        '',
        ...items.map((item) => `- ${item.name} [${item.id}] (x${item.quantity}) — ${formatIqd(item.price, snapshot, item.quantity) ?? 'please confirm IQD price'}`),
        '',
        `*Product subtotal: ${formatIqdAmount(iqdTotal(items, snapshot)) ?? 'please confirm IQD total'}*`,
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
