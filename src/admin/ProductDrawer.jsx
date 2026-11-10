import React, { useMemo, useState } from 'react';
import { Link2, Link2Off, RotateCcw, Save, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCatalog, useToast } from './context';
import ZohoPicker from './ZohoPicker';
import { Badge, CopyButton, Drawer, Field, ImageInput, Spinner, Toggle } from './ui';
import {
    BRANDS, CATEGORIES, PLAIN_SORT_BASE, PRODUCT_ID_RE, describeError, formatIqd, formatUsd, fromLocalInput, isOutOfStock, plainId, priceInfo,
    rateSourceText, stockInfo, stockText, titleCase, toLocalInput, uniqueSlug,
} from './lib';

const JSON_FIELDS = [
    { key: 'colors', hint: '[{"key":"graphite","hex":"#3A3C40","img":"asset:file.webp","zohoId":"…"}]', nullable: false },
    { key: 'key_features', hint: 'Feature list shown on the product page', nullable: false },
    { key: 'spec_table', hint: '[{"g":"Group","rows":[["Label","Value"]]}]', nullable: false },
    { key: 'box', hint: 'In the box', nullable: false },
    { key: 'connection', hint: '["bluetooth","receiver","usb-c"]', nullable: false },
    { key: 'works', hint: '["windows","macos",…]', nullable: false },
    { key: 'setups', hint: '["wfh","creators",…]', nullable: false },
    { key: 'also_in', hint: 'Other category ids this product also appears in', nullable: false },
    { key: 'layouts', hint: 'Keyboard layouts, or empty', nullable: true },
    { key: 'editions', hint: 'Editions, or empty', nullable: true },
];

const toText = (v) => (v === null || v === undefined ? '' : String(v));
const jsonText = (v, nullable) => (v === null || v === undefined ? (nullable ? '' : '[]') : JSON.stringify(v));

function initialForm(p, prefill) {
    const src = { ...(prefill ?? {}), ...(p ?? {}) };
    const form = {
        id: toText(src.id),
        name: toText(src.name),
        brand: toText(src.brand),
        model: toText(src.model),
        category: toText(src.category),
        sub: src.category ? toText(src.sub) : '',
        specs: toText(src.specs),
        image_url: src.image_url || null,
        zoho_id: toText(src.zoho_id),
        base_price_iqd: toText(src.base_price_iqd),
        stock_override: toText(src.stock_override),
        restock_date: toText(src.restock_date),
        sale_price_iqd: toText(src.sale_price_iqd),
        sale_ends_at: toLocalInput(src.sale_ends_at),
        warranty: toText(src.warranty ?? 12),
        watt: toText(src.watt),
        ports: toText(src.ports),
        hidden: Boolean(src.hidden),
        featured: Boolean(src.featured),
        is_new: Boolean(src.is_new),
        flash: Boolean(src.flash),
        sort: toText(src.sort ?? 0),
    };
    JSON_FIELDS.forEach(({ key, nullable }) => { form[key] = jsonText(src[key], nullable); });
    return form;
}

const intOrNull = (s) => {
    const t = String(s ?? '').replace(/[,\s]/g, '');
    if (t === '') return { value: null };
    if (!/^-?\d+$/.test(t)) return { error: 'Whole number only' };
    return { value: Number(t) };
};

const LIGHT_NUMBERS = [
    ['stock_override', (v) => v >= 0, 'Cannot be negative'],
    ['sale_price_iqd', (v) => v > 0, 'Must be more than 0'],
];
const CURATED_NUMBERS = [
    ...LIGHT_NUMBERS,
    ['base_price_iqd', (v) => v > 0, 'Must be more than 0'],
    ['warranty', (v) => v >= 0, 'Cannot be negative'],
    ['watt', (v) => v > 0, 'Must be more than 0'],
    ['ports', (v) => v > 0, 'Must be more than 0'],
    ['sort', () => true, ''],
];

/**
 * Edits one catalog row. Plain Zoho items (and their light 'z-' overlays) get the quick fields:
 * the first save creates the overlay row, and "Remove changes" deletes it again. Curated rows
 * (and new ones, `create = {zohoItem}`) also get the product page content.
 */
export default function ProductDrawer({ row, create, onClose }) {
    const toast = useToast();
    const { products, zohoItems, zohoState, zohoById, linked, pricing, saveProduct, deleteProduct } = useCatalog();
    const p = row?.p ?? null;
    const curated = Boolean(create) || row?.kind === 'curated';
    const isNew = !p;
    const takenIds = useMemo(() => new Set(products.map((x) => x.id)), [products]);
    const [initial] = useState(() => initialForm(p, create ? {
        id: uniqueSlug(create.zohoItem.name, takenIds),
        zoho_id: String(create.zohoItem.zoho_id),
    } : null));
    const [form, setForm] = useState(initial);
    const [busy, setBusy] = useState('');
    const [picking, setPicking] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const [now] = useState(() => Date.now());

    const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
    const zid = curated ? form.zoho_id.trim() : String(row?.z?.zoho_id ?? '');
    const z = curated ? (zid ? zohoById.get(zid) ?? null : null) : row?.z ?? null;

    // Validate and build the row; shown live so the admin sees problems before saving.
    const { values, errors, warnings, info } = useMemo(() => {
        const e = {};
        const w = {};
        const r = {};
        const hasZoho = Boolean(zid);

        if (curated && isNew) {
            const id = form.id.trim();
            if (!PRODUCT_ID_RE.test(id)) e.id = 'Use 2–81 lowercase letters, digits and dashes, starting with a letter or digit.';
            else if (/^z-\d+$/.test(id)) e.id = 'Ids like z-123 are kept for plain Zoho items. Choose a name-like id.';
            else if (takenIds.has(id)) e.id = 'Another product already uses this id.';
            r.id = id;
        }

        // Shown in the app. Empty = the Zoho item's value.
        r.name = form.name.trim() || null;
        if (r.name && r.name.length > 160) e.name = 'Keep the name under 160 characters.';
        if (!r.name && !hasZoho) e.name = 'A product without a Zoho item needs a name.';
        r.category = form.category || null;
        r.sub = r.category ? form.sub : '';
        if (!r.category && !hasZoho) e.category = 'Choose a category.';
        r.image_url = form.image_url || null;

        (curated ? CURATED_NUMBERS : LIGHT_NUMBERS).forEach(([key, ok, msg]) => {
            const parsed = intOrNull(form[key]);
            if (parsed.error) e[key] = parsed.error;
            else if (parsed.value !== null && !ok(parsed.value)) e[key] = msg;
            r[key] = parsed.value;
        });
        r.restock_date = form.restock_date || null;
        r.sale_ends_at = fromLocalInput(form.sale_ends_at);

        if (curated) {
            r.brand = form.brand.trim() || null;
            if (!r.brand && !hasZoho) e.brand = 'Choose a brand.';
            r.model = form.model.trim() || null;
            r.specs = form.specs.trim();
            r.zoho_id = zid || null;
            const used = zid ? linked.get(zid) : null;
            if (used && used.id !== p?.id) {
                e.zoho_id = used.role === 'colour' ? `That Zoho item is a colour of ${used.id}.` : `That Zoho item is already used by ${used.id}.`;
            }
            if (!zid && !r.base_price_iqd) e.base_price_iqd = 'Link a Zoho item or set a base price, otherwise the app has no price.';
            if (r.warranty === null) r.warranty = 12;
            if (r.sort === null) r.sort = 0;
            JSON_FIELDS.forEach(({ key, nullable }) => {
                const text = form[key].trim();
                if (!text) {
                    r[key] = nullable ? null : [];
                    return;
                }
                try {
                    const value = JSON.parse(text);
                    if (!nullable && !Array.isArray(value)) e[key] = 'Must be a JSON list: [ … ]';
                    r[key] = value;
                } catch {
                    e[key] = 'Not valid JSON.';
                }
            });
            // A colour's Zoho item belongs to one product only.
            if (!e.colors && Array.isArray(r.colors)) {
                const clash = r.colors.map((c) => String(c?.zohoId ?? '')).find((cid) => {
                    if (!cid || cid === zid) return false;
                    const owner = linked.get(cid);
                    return owner && owner.id !== p?.id;
                });
                if (clash) e.colors = `Zoho item ${clash} is already used by ${linked.get(clash).id}.`;
            }
        } else if (isNew) {
            // A plain Zoho item's first save creates its overlay row; name/brand/category stay Zoho's.
            r.id = plainId(zid);
            r.zoho_id = zid;
            r.sort = PLAIN_SORT_BASE + (Number(row?.z?.zoho_order) || 0);
        }

        // Sale checks. A sale nobody touched (it expired, or Zoho's price moved) must not block
        // saving other fields: those become warnings with a one-click fix.
        const priced = priceInfo({ ...(p ?? {}), ...r }, z, pricing, now);
        const saleChanged = form.sale_price_iqd !== initial.sale_price_iqd || form.sale_ends_at !== initial.sale_ends_at;
        const expired = Boolean(r.sale_ends_at) && Date.parse(r.sale_ends_at) <= now;
        if (r.sale_price_iqd !== null) {
            if (expired) {
                if (form.sale_ends_at !== initial.sale_ends_at) e.sale_ends_at = 'This end date has already passed.';
                else w.expired = 'This discount has ended, so the app shows no discount.';
            }
            if (priced.regular === null) {
                w.sale_price_iqd = 'There is no regular price right now (no Zoho price or no USD→IQD rate), so this discount cannot be checked and does not show until there is one.';
            } else if (r.sale_price_iqd >= priced.regular && (saleChanged || !expired)) {
                e.sale_price_iqd = `The sale price must be lower than the regular price (${formatIqd(priced.regular)}).`;
            }
        } else if (form.sale_ends_at) {
            e.sale_ends_at = 'Set a sale price, or clear the end date.';
        }

        r.hidden = form.hidden;
        r.featured = form.featured;
        r.is_new = form.is_new;
        r.flash = form.flash;
        if (r.flash && r.sale_price_iqd === null) e.flash = 'Flash deals need a sale price.';
        return { values: r, errors: e, warnings: w, info: priced };
    }, [form, initial, curated, isNew, takenIds, linked, p, row, z, zid, pricing, now]);

    const removeDiscount = () => setForm((f) => ({ ...f, sale_price_iqd: '', sale_ends_at: '', flash: false }));
    const stock = stockInfo(values, z);
    const errorCount = Object.keys(errors).length;
    const err = (key) => (showErrors || key === 'sale_price_iqd' || key === 'id' ? errors[key] : undefined);
    const dirty = JSON.stringify(form) !== JSON.stringify(initial);
    const title = create ? 'New curated product' : row.name;
    const displayName = values.name ?? z?.name ?? row?.name ?? values.id;

    const handleSave = async (e) => {
        e.preventDefault();
        setShowErrors(true);
        if (errorCount > 0) {
            toast(`Fix ${errorCount} field${errorCount === 1 ? '' : 's'} first.`, 'error');
            return;
        }
        if (!dirty && !create) {
            onClose();
            return;
        }
        setBusy('save');
        try {
            await saveProduct(isNew ? null : p.id, values);
            toast(create ? `Added ${displayName}` : `Saved ${displayName}`);
            onClose();
        } catch (error) {
            toast(error.message, 'error');
        } finally {
            setBusy('');
        }
    };

    /** Curated: delete the row. Plain item: delete its overlay, so it is back to Zoho as it is. */
    const handleRemove = async () => {
        setBusy('delete');
        let slides = 0;
        let slidesUnknown = false;
        if (supabase) {
            const { count, error } = await supabase.from('app_banners').select('id', { count: 'exact', head: true }).eq('product_id', p.id);
            if (error) {
                slidesUnknown = true;
                toast(`Could not check the carousel slides: ${describeError(error).message}`, 'error');
            } else {
                slides = count ?? 0;
            }
        }
        let slideNote = '';
        if (slidesUnknown) slideNote = ' Could not check the carousel: a slide that uses this product would lose its product link.';
        else if (slides > 0) slideNote = ` ${slides} carousel slide${slides === 1 ? ' uses' : 's use'} this product and will lose ${slides === 1 ? 'its' : 'their'} product link.`;
        const message = curated
            ? `Delete the curated product "${displayName}"?${p.zoho_id ? ' Its Zoho item stays in the app as a plain product.' : ''} Past orders keep their item names. Hiding it is usually safer.${slideNote}`
            : `Remove every change made here for "${displayName}"? It goes back to how Zoho Books has it.${slideNote}`;
        if (!window.confirm(message)) {
            setBusy('');
            return;
        }
        try {
            await deleteProduct(p.id);
            toast(curated ? `Deleted ${displayName}` : `${displayName} is back to Zoho as it is`);
            onClose();
        } catch (error) {
            toast(error.message, 'error');
            setBusy('');
        }
    };

    const categoryIds = useMemo(() => [...new Set([...Object.keys(CATEGORIES), form.category].filter(Boolean))], [form.category]);
    const subs = [...new Set([...(CATEGORIES[form.category] ?? []), form.sub].filter(Boolean))];
    const brandOptions = useMemo(() => {
        const map = new Map(Object.entries(BRANDS));
        zohoItems.forEach((item) => { if (item.brand_id && item.brand && !map.has(item.brand_id)) map.set(item.brand_id, item.brand); });
        if (form.brand && !map.has(form.brand)) map.set(form.brand, titleCase(form.brand));
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [zohoItems, form.brand]);

    const kindText = create ? 'Product page content for a Zoho item'
        : row.kind === 'curated' ? 'Curated product'
            : row.kind === 'edited' ? 'Zoho item with changes made here'
                : 'Zoho item, as Zoho has it';
    const zohoCat = z ? `${z.category}${z.sub ? ` / ${z.sub}` : ''}` : '';

    return (
        <>
            <Drawer
                open
                wide
                onClose={onClose}
                title={title}
                subtitle={<span><span className="adm-mono">{create ? values.id || '—' : row.key}</span> · {kindText}</span>}
                footer={
                    <div className="adm-row adm-row--between">
                        {!isNew ? (
                            <button type="button" className="adm-btn adm-btn--ghost adm-btn--danger-text" onClick={handleRemove} disabled={Boolean(busy)}
                                title={curated ? undefined : 'Delete this item’s changes, so the app shows it as Zoho has it'}>
                                {busy === 'delete' ? <Spinner size={14} /> : curated ? <Trash2 size={16} /> : <RotateCcw size={16} />}
                                {curated ? 'Delete' : 'Remove changes'}
                            </button>
                        ) : <span />}
                        <div className="adm-row">
                            {showErrors && errorCount > 0 && <span className="adm-danger-text">{errorCount} to fix</span>}
                            <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>Cancel</button>
                            <button type="submit" form="adm-product-form" className="adm-btn adm-btn--primary" disabled={Boolean(busy) || (!dirty && !create)}>
                                {busy === 'save' ? <Spinner size={14} /> : <Save size={16} />} {create ? 'Add product' : 'Save'}
                            </button>
                        </div>
                    </div>
                }
            >
                <form id="adm-product-form" onSubmit={handleSave} className="adm-form" noValidate>
                    <section className="adm-price-preview" aria-live="polite">
                        <div>
                            <span className="adm-label-sm">Shoppers see</span>
                            <div className="adm-price-preview__now">
                                {info.price ? formatIqd(info.price) : 'No price'}
                                {info.onSale && <Badge tone="sale">−{info.percent}%</Badge>}
                            </div>
                            {info.onSale && <div className="adm-price-preview__was">was <s>{formatIqd(info.regular)}</s>, now {formatIqd(info.sale)}</div>}
                            {!info.onSale && info.saleProblem && <div className="adm-warn-text">{info.saleProblem}: no discount shown.</div>}
                            {row?.reason && <div className="adm-warn-text">Not shown in the app now: {row.reason}.</div>}
                        </div>
                        <div className="adm-price-preview__meta">
                            <span>
                                {info.source === 'zoho' && `Zoho ${formatUsd(info.usd)} × ${Math.round(pricing.rate).toLocaleString('en-US')} (${rateSourceText(pricing.source)}), rounded to ${pricing.roundTo.toLocaleString('en-US')}`}
                                {info.source === 'base' && 'Base price (no Zoho price or no rate)'}
                                {info.source === 'none' && (pricing.rate ? 'Zoho has no price for this item' : 'No USD→IQD rate right now')}
                            </span>
                            <span className={isOutOfStock(stock) ? 'adm-danger-text' : ''}>
                                Stock: {stockText(stock)} {stock.source === 'override' ? '(override)' : stock.source === 'zoho' ? '(Zoho)' : '(counts as out of stock)'}
                            </span>
                        </div>
                    </section>

                    <div className="adm-card adm-zoho-link">
                        {z ? (
                            <div className="adm-row adm-row--between adm-row--wrap">
                                <div className="adm-zoho-link__info">
                                    <span className="adm-label-sm">Zoho item</span>
                                    <p className="adm-strong">{z.name}</p>
                                    {z.raw_name && z.raw_name !== z.name && <p className="adm-muted adm-small">Name in Zoho: {z.raw_name}</p>}
                                    <p className="adm-muted">
                                        <span className="adm-mono">{z.zoho_id}</span> <CopyButton value={z.zoho_id} />
                                        {' '}· {formatUsd(z.usd_price)} · {z.stock === null || z.stock === undefined ? 'no Zoho stock' : `${z.stock} in Zoho stock`}
                                        {' '}· {z.brand || 'no brand'} · {zohoCat}
                                    </p>
                                    <span className="adm-chips">
                                        {!z.active && <Badge tone="warn">Gone from Zoho</Badge>}
                                        {z.kind !== 'goods' && <Badge tone="warn">Zoho service</Badge>}
                                        {z.zoho_featured && <Badge tone="info">Featured in Zoho</Badge>}
                                    </span>
                                </div>
                                {curated && (
                                    <div className="adm-row">
                                        <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setPicking(true)}><Link2 size={14} /> Change</button>
                                        <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => set('zoho_id', '')}><Link2Off size={14} /> Unlink</button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="adm-row adm-row--between adm-row--wrap">
                                <p className="adm-muted">
                                    {zid ? `Zoho item ${zid} is not in the synced list${zohoState.status === 'loading' ? ' (loading…)' : ''}.` : 'Not linked to Zoho. Price and stock come from Zoho once linked.'}
                                </p>
                                {curated && (
                                    <div className="adm-row">
                                        <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setPicking(true)}><Link2 size={14} /> {zid ? 'Change' : 'Link Zoho item'}</button>
                                        {zid && <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => set('zoho_id', '')}><Link2Off size={14} /> Unlink</button>}
                                    </div>
                                )}
                            </div>
                        )}
                        {errors.zoho_id && <p className="adm-field__error">{errors.zoho_id}</p>}
                        {curated && row?.colors?.length > 0 && (
                            <ul className="adm-variants" aria-label="Colours">
                                {row.colors.map((c, i) => (
                                    <li key={`${c.key}-${i}`}>
                                        <span className="adm-strong">{c.key || 'colour'}</span>
                                        <span className="adm-muted adm-ellipsis">
                                            {c.own ? (c.z ? c.z.name : 'Not in the synced list') : 'Uses the product’s own price and stock'}
                                        </span>
                                        <span className="adm-mono adm-muted">{c.zohoId ?? '—'}</span>
                                        <span>{c.regular ? formatIqd(c.regular) : '—'}</span>
                                        <span className={c.stock > 0 ? 'adm-ok-text' : 'adm-danger-text'}>{c.stock} in stock</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <h3 className="adm-h3">Shown in the app</h3>
                    <div className="adm-form-grid">
                        <Field label="Name" error={err('name')} className="adm-span-2" hint={z ? 'Empty = the Zoho name above.' : undefined}>
                            <input className="adm-input" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={160} placeholder={z?.name ?? ''} />
                        </Field>
                        {curated && create && (
                            <Field label="Product id" error={err('id')} hint="Used in the app, carts and orders. It cannot change after saving.">
                                <input className="adm-input adm-mono" value={form.id} onChange={(e) => set('id', e.target.value.toLowerCase())} />
                            </Field>
                        )}
                        {curated && (
                            <Field label="Model" hint="Manufacturer part number">
                                <input className="adm-input" value={form.model} onChange={(e) => set('model', e.target.value)} />
                            </Field>
                        )}
                        {curated && (
                            <Field label="Brand" error={err('brand')}>
                                <select className="adm-input" value={form.brand} onChange={(e) => set('brand', e.target.value)}>
                                    <option value="">{z ? `Zoho's: ${z.brand || 'no brand'}` : 'Choose…'}</option>
                                    {brandOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                                </select>
                            </Field>
                        )}
                        <Field label="Category" error={err('category')}>
                            <select className="adm-input" value={form.category} onChange={(e) => {
                                const cat = e.target.value;
                                setForm((f) => ({ ...f, category: cat, sub: cat && (CATEGORIES[cat] ?? []).includes(f.sub) ? f.sub : '' }));
                            }}>
                                <option value="">{z ? `Zoho's: ${zohoCat}` : 'Choose…'}</option>
                                {categoryIds.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </Field>
                        <Field label="Subcategory" hint={form.category ? undefined : 'Choose a category to change it.'}>
                            <select className="adm-input" value={form.sub} onChange={(e) => set('sub', e.target.value)} disabled={!form.category}>
                                <option value="">None</option>
                                {subs.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </Field>
                        {curated && (
                            <Field label="Specs line" hint='Short line under the name, e.g. "8K DPI, Quiet clicks, USB-C"' className="adm-span-2">
                                <input className="adm-input" value={form.specs} onChange={(e) => set('specs', e.target.value)} />
                            </Field>
                        )}
                    </div>

                    <ImageInput
                        label="Photo"
                        value={form.image_url}
                        fallback={z?.image_url}
                        placeholder={z?.image_url ? 'Empty = the Zoho photo' : 'https://… or asset:file.webp'}
                        onChange={(v) => set('image_url', v)}
                        folder="products"
                        onError={(m) => toast(m, 'error')}
                        hint={z?.image_url ? 'Empty = the Zoho photo (shown). Upload an image to replace it.' : '"asset:" images are bundled inside the app. Upload an image to replace one.'}
                    />

                    <h3 className="adm-h3">Stock</h3>
                    <div className="adm-form-grid">
                        <Field label="Stock override" error={err('stock_override')} hint="Empty = Zoho stock (no Zoho figure counts as 0). 0 = out of stock.">
                            <input className="adm-input" inputMode="numeric" value={form.stock_override} onChange={(e) => set('stock_override', e.target.value)}
                                placeholder={z?.stock !== null && z?.stock !== undefined ? `Zoho: ${z.stock}` : 'Zoho: none'} />
                        </Field>
                        <Field label="Restock date" hint="Optional, shown when out of stock">
                            <input className="adm-input" type="date" value={form.restock_date} onChange={(e) => set('restock_date', e.target.value)} />
                        </Field>
                        {curated && (
                            <Field label="Base price (IQD)" error={err('base_price_iqd')} hint="Used only when there is no Zoho price.">
                                <input className="adm-input" inputMode="numeric" value={form.base_price_iqd} onChange={(e) => set('base_price_iqd', e.target.value)} placeholder="e.g. 125000" />
                            </Field>
                        )}
                        {curated && (
                            <Field label="Warranty (months)" error={err('warranty')}>
                                <input className="adm-input" inputMode="numeric" value={form.warranty} onChange={(e) => set('warranty', e.target.value)} />
                            </Field>
                        )}
                    </div>

                    <h3 className="adm-h3">Discount</h3>
                    <p className="adm-muted adm-small">A discount shows in the app only while a sale price is set, it is lower than the regular price, and the end date has not passed.</p>
                    <div className="adm-form-grid">
                        <Field
                            label="Sale price (IQD)"
                            error={err('sale_price_iqd')}
                            hint={info.regular ? `Regular price now: ${formatIqd(info.regular)}${info.onSale ? ` · ${info.percent}% off` : ''}` : 'No regular price right now.'}
                        >
                            <input className="adm-input" inputMode="numeric" value={form.sale_price_iqd} onChange={(e) => set('sale_price_iqd', e.target.value)} placeholder="Empty = no discount" />
                        </Field>
                        <Field label="Sale ends" error={err('sale_ends_at')} hint="Optional. Empty = until you remove it.">
                            <input className="adm-input" type="datetime-local" value={form.sale_ends_at} onChange={(e) => set('sale_ends_at', e.target.value)} />
                        </Field>
                    </div>
                    {warnings.sale_price_iqd && !errors.sale_price_iqd && <p className="adm-warn-text adm-small">{warnings.sale_price_iqd}</p>}
                    {warnings.expired ? (
                        <div className="adm-row adm-row--wrap">
                            <span className="adm-warn-text adm-small">{warnings.expired}</span>
                            <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={removeDiscount}>
                                Remove expired discount
                            </button>
                        </div>
                    ) : (form.sale_price_iqd || form.sale_ends_at) && (
                        <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={removeDiscount}>
                            Remove discount
                        </button>
                    )}

                    <h3 className="adm-h3">Visibility</h3>
                    <div className="adm-toggles">
                        <Toggle checked={form.hidden} onChange={(v) => set('hidden', v)} label="Hidden" hint="Not shown in the app" />
                        <Toggle checked={form.featured} onChange={(v) => set('featured', v)} label="Best seller"
                            hint={z?.zoho_featured ? 'Featured in Zoho Books, so it is a best seller either way' : 'Shown in Best sellers'} />
                        <Toggle checked={form.is_new} onChange={(v) => set('is_new', v)} label="New" hint="Shows a New tag" />
                        <Toggle checked={form.flash} onChange={(v) => set('flash', v)} label="Flash deal" hint="Needs a sale price" />
                    </div>
                    {errors.flash && (showErrors || form.flash) && <p className="adm-field__error">{errors.flash}</p>}

                    {curated && (
                        <>
                            <div className="adm-form-grid">
                                <Field label="Sort order" error={err('sort')} hint="Lower numbers show first. Plain Zoho items come after curated ones.">
                                    <input className="adm-input" inputMode="numeric" value={form.sort} onChange={(e) => set('sort', e.target.value)} />
                                </Field>
                            </div>

                            <details className="adm-details" open={Boolean(errors.colors) || undefined}>
                                <summary>Product page content (JSON)</summary>
                                <p className="adm-muted adm-small">Product page details the app reads. Leave as they are unless you know the format.</p>
                                <div className="adm-form-grid">
                                    <Field label="Watt" error={err('watt')}>
                                        <input className="adm-input" inputMode="numeric" value={form.watt} onChange={(e) => set('watt', e.target.value)} />
                                    </Field>
                                    <Field label="Ports" error={err('ports')}>
                                        <input className="adm-input" inputMode="numeric" value={form.ports} onChange={(e) => set('ports', e.target.value)} />
                                    </Field>
                                    {JSON_FIELDS.map(({ key, hint }) => (
                                        <Field key={key} label={key} error={errors[key]} hint={hint} className="adm-span-2">
                                            <textarea className="adm-input adm-mono adm-small" rows={2} spellCheck={false} value={form[key]} onChange={(e) => set(key, e.target.value)} />
                                        </Field>
                                    ))}
                                </div>
                            </details>
                        </>
                    )}
                </form>
            </Drawer>
            {picking && (
                <ZohoPicker
                    title="Link a Zoho item"
                    items={zohoItems}
                    status={zohoState.status}
                    error={zohoState.error}
                    linked={linked}
                    currentAppId={p?.id}
                    pricing={pricing}
                    onClose={() => setPicking(false)}
                    onPick={(item) => {
                        set('zoho_id', String(item.zoho_id));
                        setPicking(false);
                    }}
                />
            )}
        </>
    );
}
