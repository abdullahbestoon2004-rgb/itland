// Shared, non-React helpers for the admin dashboard.
// The database contract is the migrations in MIGRATION_FILES, in order (summary:
// itland-mobile-app/BACKEND.md).
import { supabase } from '../lib/supabase';
import { getAdminProducts } from '../data/products';

export const MIGRATION_FILES = [
    'supabase/migrations/20261108120000_mobile_app_backend.sql',
    'supabase/migrations/20261108190000_app_zoho_catalog_and_accounts.sql',
    'supabase/migrations/20261108200000_app_catalog_stable_version.sql',
    'supabase/migrations/20261108210000_app_catalog_brand_and_admin_delete.sql',
];
/** Adds admin_delete_app_account() (the customer-account delete in Settings). */
export const ACCOUNT_DELETE_MIGRATION = MIGRATION_FILES[3];
export const MIGRATION_FILE = MIGRATION_FILES.join(' and then ');
export const SEED_FILE = 'supabase/seed/app_seed.sql';
export const MEDIA_BUCKET = 'app-media';

// The app's category ids (BACKEND.md "Categories"). The sync puts every Zoho item in one of them.
export const CATEGORIES = {
    mice: ['wireless', 'wired', 'ergonomic'],
    keyboards: ['wireless', 'wired', 'mechanical'],
    combos: ['wireless', 'wired'],
    headsets: ['office', 'wireless', 'wired'],
    webcams: ['webcams', 'mics'],
    speakers: ['desktop', 'conference'],
    gaming: ['mice', 'keyboards', 'headsets', 'wheels'],
    hubs: ['hubs', 'docks'],
    adapters: ['video', 'network', 'otg'],
    cables: ['hdmi', 'usb-c', 'display'],
    chargers: ['car'],
    powerbanks: [],
    stands: [],
    presenters: [],
    storage: [],
    components: [],
    other: [],
};

export const BRANDS = {
    logitech: 'Logitech',
    'logitech-g': 'Logitech G',
    anker: 'Anker',
    onten: 'Onten',
    lention: 'Lention',
    poly: 'Poly',
    jabra: 'Jabra',
    ugreen: 'UGREEN',
    dell: 'Dell',
    samsung: 'Samsung',
    amalink: 'Amalink',
    maono: 'Maono',
    other: 'Other',
};

export const brandName = (id) => BRANDS[id] ?? (id ? titleCase(id) : '');
export const titleCase = (s) => String(s ?? '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const LANGS = [
    { code: 'en', label: 'English', dir: 'ltr' },
    { code: 'ar', label: 'Arabic', dir: 'rtl' },
    { code: 'ku', label: 'Kurdish', dir: 'rtl' },
];

// ── Errors ─────────────────────────────────────────────────────────────────────
/** Turns a Supabase/PostgREST error into something the owner can act on. */
export function describeError(error, fallback = 'Something went wrong.') {
    if (!error) return null;
    const code = error.code ?? '';
    const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`;
    const missing = code === '42P01' || code === 'PGRST205' || code === 'PGRST200' || code === '42883'
        || /schema cache|does not exist|Could not find the (table|function|relation)/i.test(text);
    if (missing) {
        return {
            missing: true,
            message: `The app backend tables are not in Supabase yet. Run ${MIGRATION_FILE} in the Supabase SQL editor. Run ${SEED_FILE} only on a new, empty database: it overwrites the curated products.`,
        };
    }
    if (code === '42501' || /row-level security|permission denied/i.test(text)) {
        return { missing: false, message: 'Supabase refused this change. Make sure your Google account is listed in admin_users.' };
    }
    if (/bucket not found/i.test(text)) {
        return { missing: true, message: `The "${MEDIA_BUCKET}" storage bucket does not exist yet. Run ${MIGRATION_FILE} in Supabase.` };
    }
    if (code === 'PGRST116') {
        return { missing: false, message: 'Nothing was saved: the row was not found, or your account is not allowed to change it (admin_users).' };
    }
    if (code === '23505') return { missing: false, message: 'That value is already used by another row (it must be unique).' };
    if (code === '23514') return { missing: false, message: `A value failed a database check: ${error.message}` };
    if (/Failed to fetch|NetworkError|Load failed/i.test(text)) return { missing: false, message: 'Network error. Check your connection and try again.' };
    return { missing: false, message: error.message || fallback };
}

export function requireSupabase() {
    if (!supabase) throw new Error('Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).');
    return supabase;
}

// ── Formatting ─────────────────────────────────────────────────────────────────
export const formatIqd = (n) => (Number.isFinite(Number(n)) && n !== null && n !== '' ? `${Math.round(Number(n)).toLocaleString('en-US')} IQD` : '—');
export const formatUsd = (n) => (Number.isFinite(Number(n)) && n !== null ? `$${Number(n).toFixed(2)}` : '—');

export function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(iso, now) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '';
    const s = Math.max(0, Math.round((now - t) / 1000));
    if (s < 60) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    return `${d} d ago`;
}

export const startOfToday = (now) => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
};

/** <input type="datetime-local"> value ↔ ISO string, in the browser's timezone. */
export function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fromLocalInput(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ── Pricing (same rules as the app) ────────────────────────────────────────────
/** A positive decimal as [all its digits, number of decimal places], e.g. 19.99 → [1999n, 2]. */
function decimalParts(n) {
    const s = String(n);
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    const [whole, frac = ''] = s.split('.');
    return [BigInt(whole + frac), frac.length];
}

/**
 * USD → IQD rounded to the nearest step, like app_private.iqd(): round(usd × rate / step) × step.
 * Worked out in whole numbers (BigInt), because Postgres uses exact decimals: plain floating point
 * gives a different price at some rates with decimals (e.g. $2.32 at 1562.5 → 3,750 IQD, not 3,500).
 */
export function iqdFromUsd(usd, rate, roundTo) {
    const u = Number(usd);
    const r = Number(rate);
    const step = Number(roundTo) > 0 ? Number(roundTo) : 250;
    if (!(u > 0) || !(r > 0)) return null;
    const a = decimalParts(u);
    const b = decimalParts(r);
    if (!a || !b || !Number.isInteger(step)) return Math.round((u * r) / step) * step;
    const num = a[0] * b[0];
    const den = BigInt(step) * 10n ** BigInt(a[1] + b[1]);
    const whole = num / den;
    // Half rounds up, as Postgres round() does for positive numbers.
    return Number((num % den) * 2n >= den ? whole + 1n : whole) * step;
}

/** The synced market rate is used only while it is under 3 days old (same rule as the server). */
export const FX_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export const RATE_SOURCE = { manual: 'Manual (Settings)', tawaf: 'Tawaf', website: 'Website', none: 'None' };
export const rateSourceText = (source) => RATE_SOURCE[source] ?? titleCase(source || 'market');

/**
 * The USD→IQD rate the app uses (app_private.fx() on the server): app_settings.usd_iqd_rate when
 * set, else the synced fx_rate while fx_as_of is under 3 days old, else none (no Zoho prices:
 * only rows with a base_price_iqd keep a price).
 * `auto` is the synced rate when it is fresh, whatever the manual setting.
 */
export function pricingFrom(settings, now) {
    const roundTo = Number(settings?.price_round_to) > 0 ? Number(settings.price_round_to) : 250;
    const manual = Number(settings?.usd_iqd_rate);
    const fx = Number(settings?.fx_rate);
    const asOf = settings?.fx_as_of ?? null;
    const observed = Date.parse(asOf);
    const fresh = fx > 0 && Number.isFinite(observed) && observed > now - FX_MAX_AGE_MS;
    const auto = fresh ? { rate: fx, source: settings?.fx_source || 'market', asOf } : null;
    const lastRate = fx > 0 ? { rate: fx, source: settings?.fx_source || 'market', asOf } : null;
    if (manual > 0) return { rate: manual, roundTo, source: 'manual', asOf: null, auto, lastRate };
    if (auto) return { rate: auto.rate, roundTo, source: auto.source, asOf, auto, lastRate };
    return { rate: null, roundTo, source: 'none', asOf: null, auto: null, lastRate };
}

export function saleIsActive(product, now) {
    if (!(Number(product?.sale_price_iqd) > 0)) return false;
    if (!product.sale_ends_at) return true;
    return Date.parse(product.sale_ends_at) > now;
}

/**
 * What a shopper sees for a product (same rules as app_private.catalog_rows()).
 * regular: Zoho USD × rate (rounded) when the Zoho item has a price, else base_price_iqd.
 * A discount exists only when an admin set a sale price that is still running and
 * is lower than the regular price.
 */
export function priceInfo(product, zohoItem, pricing, now) {
    const live = zohoItem ? iqdFromUsd(zohoItem.usd_price, pricing?.rate, pricing?.roundTo) : null;
    const base = Number(product?.base_price_iqd) > 0 ? Number(product.base_price_iqd) : null;
    const regular = live ?? base;
    const source = live ? 'zoho' : base ? 'base' : 'none';
    const sale = Number(product?.sale_price_iqd) > 0 ? Number(product.sale_price_iqd) : null;
    const running = saleIsActive(product, now);
    const saleValid = sale !== null && regular !== null && sale < regular;
    const onSale = running && saleValid;
    const price = onSale ? sale : regular;
    const percent = onSale ? Math.round((1 - sale / regular) * 100) : 0;
    let saleProblem = null;
    if (sale !== null) {
        if (regular === null) saleProblem = 'No regular price to compare with';
        else if (!saleValid) saleProblem = 'Sale price is not lower than the regular price';
        else if (!running) saleProblem = 'Sale ended';
    }
    const usd = zohoItem && zohoItem.usd_price !== null && zohoItem.usd_price !== undefined ? Number(zohoItem.usd_price) : null;
    return { regular, price, sale, onSale, percent, source, saleProblem, usd };
}

/**
 * The shared stock rule (same as the app): stock = stock_override ?? Zoho stock ?? 0, never below 0.
 * With no figure at all the product counts as out of stock (`unknown: true`).
 */
export function stockInfo(product, zohoItem) {
    if (product?.stock_override !== null && product?.stock_override !== undefined && product?.stock_override !== '') {
        return { qty: Math.max(0, Number(product.stock_override)), source: 'override', unknown: false };
    }
    if (zohoItem && zohoItem.stock !== null && zohoItem.stock !== undefined) {
        return { qty: Math.max(0, Number(zohoItem.stock)), source: 'zoho', unknown: false };
    }
    return { qty: 0, source: 'unknown', unknown: true };
}

// ── The catalog: Zoho items + overlay rows, as the app shows them ──────────────
/** Plain Zoho items are 'z-<zoho id>' in the app, in carts and in orders. */
export const plainId = (zohoId) => `z-${zohoId}`;
/** Overlays on plain items sort where Zoho puts the item (the server uses 100000 + zoho_order). */
export const PLAIN_SORT_BASE = 100000;

const filled = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : v);
const colorsOf = (p) => (Array.isArray(p?.colors) ? p.colors.filter((c) => c && typeof c === 'object') : []);

/** What is wrong when the app does not show a row; null when it does. */
function hiddenReason(row, showSoldOut) {
    const { p, z } = row;
    if (p?.hidden) return 'Hidden';
    if (p?.zoho_id && !z) return 'Not in Zoho';
    if (z && !z.active) return 'Gone from Zoho';
    if (z && z.kind !== 'goods') return 'Zoho service';
    if (!(row.price.regular > 0)) return 'No price';
    if (!showSoldOut && !row.anyStock) return 'Sold out';
    return null;
}

function catalogRow(key, p, z, ctx) {
    const { zohoById, pricing, now, showSoldOut } = ctx;
    const kind = !p ? 'plain' : p.zoho_id && p.id === plainId(p.zoho_id) ? 'edited' : 'curated';
    const brandOverride = filled(p?.brand);
    const brandId = brandOverride ?? z?.brand_id ?? 'other';
    // No brand set here = Zoho's brand name, or none (a light 'z-' overlay looks like the plain item).
    const brandLabel = !brandOverride
        ? (z?.brand || '')
        : brandOverride === z?.brand_id ? (z?.brand || titleCase(brandOverride)) : titleCase(brandOverride);
    const catOverride = filled(p?.category);
    const price = priceInfo(p, z, pricing, now);
    const stock = stockInfo(p, z);
    // Every colour in the app's list. `own` = it has its own Zoho item (price and stock); the
    // others (no zohoId, or the product's own item) use the product's price and stock.
    const parentZid = String(p?.zoho_id ?? '');
    const colors = colorsOf(p).map((c) => {
        const zid = c.zohoId ? String(c.zohoId) : '';
        const own = zid !== '' && zid !== parentZid;
        const cz = own ? zohoById.get(zid) ?? null : null;
        const live = cz?.active ? cz : null;
        return {
            key: String(c.key ?? ''),
            zohoId: zid || null,
            own,
            z: cz,
            stock: own ? (live ? Math.max(0, Number(live.stock) || 0) : 0) : stock.qty,
            regular: own ? (live ? iqdFromUsd(live.usd_price, pricing?.rate, pricing?.roundTo) : null) ?? price.regular : price.regular,
        };
    });
    const variants = colors.filter((c) => c.own);
    const row = {
        key,
        p,
        z,
        kind,
        name: filled(p?.name) ?? z?.name ?? p?.id ?? key,
        brandId,
        brandLabel,
        category: catOverride ?? z?.category ?? 'other',
        sub: catOverride ? (p.sub ?? '') : (z?.sub ?? ''),
        image: filled(p?.image_url) ?? z?.image_url ?? null,
        price,
        stock,
        colors,
        variants,
        anyStock: stock.qty > 0 || variants.some((v) => v.stock > 0),
        featured: Boolean(p?.featured || z?.zoho_featured),
        isNew: Boolean(p?.is_new),
        flash: Boolean(p?.flash),
        hidden: Boolean(p?.hidden),
        sortKey: p ? Number(p.sort) || 0 : PLAIN_SORT_BASE + (Number(z?.zoho_order) || 0),
    };
    row.reason = hiddenReason(row, showSoldOut);
    row.inApp = row.reason === null;
    row.search = [
        row.name, row.brandLabel, z?.zoho_id, z?.raw_name, z?.name, p?.id, p?.model,
        ...variants.flatMap((v) => [v.zohoId, v.z?.name, v.z?.raw_name]),
    ].filter(Boolean).join(' ').toLowerCase();
    return row;
}

/**
 * One row per product the app can have, like the server's catalog: every overlay row (with its
 * Zoho item) and every Zoho item no overlay uses. A Zoho item named in an overlay's
 * colors[].zohoId is a colour of that product, not a row of its own.
 * `linked` maps a Zoho id to the overlay that uses it: {id, role: 'product' | 'colour'}.
 */
export function buildCatalog({ products, zohoItems, settings, pricing, now }) {
    const zohoById = new Map(zohoItems.map((z) => [String(z.zoho_id), z]));
    const linked = new Map();
    products.forEach((p) => { if (p.zoho_id) linked.set(String(p.zoho_id), { id: p.id, role: 'product' }); });
    products.forEach((p) => colorsOf(p).forEach((c) => {
        if (c.zohoId && !linked.has(String(c.zohoId))) linked.set(String(c.zohoId), { id: p.id, role: 'colour' });
    }));
    const ctx = { zohoById, pricing, now, showSoldOut: settings?.show_out_of_stock !== false };
    const rows = products.map((p) => catalogRow(p.id, p, p.zoho_id ? zohoById.get(String(p.zoho_id)) ?? null : null, ctx));
    zohoItems.forEach((z) => {
        if (!linked.has(String(z.zoho_id))) rows.push(catalogRow(plainId(z.zoho_id), null, z, ctx));
    });
    return { rows, rowById: new Map(rows.map((r) => [r.key, r])), zohoById, linked };
}

/** Reads every row of a query, page by page (PostgREST caps each response; 1,000 rows on Supabase). */
export async function fetchAll(makeQuery, pageSize = 1000) {
    const rows = [];
    let total = null;
    for (;;) {
        const { data, error, count } = await makeQuery().range(rows.length, rows.length + pageSize - 1);
        if (error) throw error;
        const page = data ?? [];
        if (total === null && Number.isFinite(count)) total = count;
        rows.push(...page);
        if (page.length === 0 || (total !== null ? rows.length >= total : page.length < pageSize)) break;
    }
    return rows;
}

export const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

export const isOutOfStock = (stock) => stock.unknown || !(stock.qty > 0);

/** "12", "0", or "0 · no Zoho stock" when there is no figure at all. */
export const stockText = (stock) => (stock.unknown ? '0 · no Zoho stock' : String(stock.qty));

/** Formats a "YYYY-MM-DD" date (as the app sends it) without timezone drift. */
export function formatDay(ymd) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd ?? ''));
    if (!m) return ymd ? String(ymd) : '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The ISO time an order was completed (delivered or picked up), from its status times. */
export function completedAt(order) {
    const times = order?.times && typeof order.times === 'object' ? order.times : {};
    return times.delivered ?? times.picked ?? null;
}

// ── Ids ────────────────────────────────────────────────────────────────────────
export const PRODUCT_ID_RE = /^[a-z0-9][a-z0-9-]{1,80}$/;

export function slugify(text) {
    return String(text ?? '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 72)
        .replace(/-+$/g, '');
}

export function uniqueSlug(text, taken) {
    let base = slugify(text);
    if (base.length < 2) base = base ? `${base}-item` : 'item';
    let id = base;
    for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
    return id;
}

// ── Orders ─────────────────────────────────────────────────────────────────────
export const ORDER_SELECT = '*, app_order_items(*), app_customers(name, phone, email)';

export const FLOWS = {
    delivery: ['placed', 'confirmed', 'packed', 'out', 'delivered'],
    pickup: ['placed', 'confirmed', 'ready', 'picked'],
};

export const STATUS_LABEL = {
    placed: 'Placed',
    confirmed: 'Confirmed',
    packed: 'Packed',
    out: 'Out for delivery',
    delivered: 'Delivered',
    ready: 'Ready for pickup',
    picked: 'Picked up',
};

export const NEXT_LABEL = {
    confirmed: 'Confirm order',
    packed: 'Mark packed',
    out: 'Send out for delivery',
    delivered: 'Mark delivered',
    ready: 'Mark ready for pickup',
    picked: 'Mark picked up',
};

export const SPECIAL_LABEL = {
    delayed: 'Delayed',
    failed: 'Delivery failed',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
};

export const CLOSED_SPECIALS = new Set(['cancelled', 'failed', 'refunded']);

export const flowFor = (order) => FLOWS[order?.type] ?? FLOWS.delivery;

export function nextStep(order) {
    if (!order || CLOSED_SPECIALS.has(order.special)) return null;
    const flow = flowFor(order);
    const i = flow.indexOf(order.status);
    return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
}

/** new | active | completed | cancelled */
export function orderGroup(order) {
    if (CLOSED_SPECIALS.has(order.special)) return 'cancelled';
    if (order.status === 'delivered' || order.status === 'picked') return 'completed';
    if (order.status === 'placed') return 'new';
    return 'active';
}

/** customer_id is null once the customer deleted their account (the order stays, without personal details). */
export const isDeletedAccount = (order) => Boolean(order) && (order.customer_id === null || order.customer_id === undefined);
export const customerName = (order) => (isDeletedAccount(order) ? 'Deleted account' : order?.app_customers?.name || order?.receiver_name || 'Customer');
export const customerPhone = (order) => (isDeletedAccount(order) ? '' : order?.app_customers?.phone || order?.receiver_phone || '');
export const customerEmail = (order) => (isDeletedAccount(order) ? '' : order?.app_customers?.email || '');

export function slotText(slot) {
    if (!slot || typeof slot !== 'object') return '';
    const pad = (h) => `${String(h).padStart(2, '0')}:00`;
    const day = slot.day ? titleCase(slot.day) : '';
    const range = slot.from !== undefined && slot.to !== undefined ? `${pad(slot.from)}–${pad(slot.to)}` : '';
    return [day, range].filter(Boolean).join(' · ');
}

export const waLink = (phone) => {
    const digits = String(phone ?? '').replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : null;
};

export const randomDigits = (n) => {
    const values = new Uint32Array(n);
    crypto.getRandomValues(values);
    return Array.from(values, (v) => String(v % 10)).join('');
};
export const newHandoverCode = () => randomDigits(4);
export const newPickupCode = () => `P-${randomDigits(4)}`;

// ── Images ─────────────────────────────────────────────────────────────────────
export const isBundledImage = (src) => typeof src === 'string' && src.startsWith('asset:');
export const bundledName = (src) => (isBundledImage(src) ? src.slice('asset:'.length) : '');
export const isWebImage = (src) => typeof src === 'string' && /^https?:\/\//i.test(src);

async function compressImage(file, maxSize = 1600) {
    if (!file?.type?.startsWith('image/')) throw new Error('Please choose an image file.');
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
    const bitmap = await createImageBitmap(file);
    try {
        const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
        if (scale === 1 && file.size < 400_000) return file;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
        return blob ?? file;
    } finally {
        bitmap.close();
    }
}

/** Uploads to the public app-media bucket and returns the public https URL. */
export async function uploadMedia(file, folder) {
    const client = requireSupabase();
    const body = await compressImage(file);
    const type = body.type || file.type || 'image/webp';
    const ext = type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'img').toLowerCase();
    const path = `${folder}/${Date.now().toString(36)}-${randomDigits(4)}.${ext}`;
    const { error } = await client.storage.from(MEDIA_BUCKET).upload(path, body, {
        cacheControl: '31536000',
        contentType: type,
        upsert: false,
    });
    if (error) throw new Error(describeError(error).message);
    return client.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ── Website catalog (read-only view with wholesale prices) ─────────────────────
/** The website's admin view of Zoho Books, with the current access token (it may have refreshed). */
export async function loadZohoCatalog({ refresh = false } = {}) {
    const client = requireSupabase();
    const { data } = await client.auth.getSession();
    return getAdminProducts({ accessToken: data.session?.access_token, refresh });
}

export async function copyText(value) {
    try {
        await navigator.clipboard.writeText(String(value));
        return true;
    } catch {
        return false;
    }
}

// ── Local per-browser preferences ──────────────────────────────────────────────
export function readPref(key, fallback) {
    try {
        const v = localStorage.getItem(`itland-admin:${key}`);
        return v === null ? fallback : JSON.parse(v);
    } catch {
        return fallback;
    }
}
export function writePref(key, value) {
    try {
        localStorage.setItem(`itland-admin:${key}`, JSON.stringify(value));
    } catch { /* storage unavailable */ }
}

/** A short two-tone chime for new orders (needs a prior user gesture to be audible). */
let audioCtx = null;
export function unlockSound() {
    try {
        audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch { /* no audio */ }
}
export function playChime() {
    try {
        audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
        const t = audioCtx.currentTime;
        [880, 1320].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.0001, t + i * 0.16);
            gain.gain.exponentialRampToValueAtTime(0.2, t + i * 0.16 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.3);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(t + i * 0.16);
            osc.stop(t + i * 0.16 + 0.32);
        });
    } catch { /* no audio */ }
}
