import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Images, Package, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCatalog, useToast } from './context';
import ProductPicker from './ProductPicker';
import { Badge, DbNotice, Drawer, EmptyState, Field, ImageInput, LangFields, Segmented, Spinner, Thumb, Toggle } from './ui';
import {
    CATEGORIES, LANGS, brandName, describeError, formatDateTime, formatIqd, fromLocalInput, isBundledImage,
    isWebImage, toLocalInput,
} from './lib';

const LINK_TYPES = [
    { value: 'product', label: 'Open the product' },
    { value: 'category', label: 'Open a category' },
    { value: 'brand', label: 'Open a brand' },
    { value: 'deals', label: 'Open deals' },
    { value: 'none', label: 'No link' },
];

function scheduleState(b, now) {
    if (!b.active) return { tone: 'neutral', label: 'Off' };
    if (b.starts_at && Date.parse(b.starts_at) > now) return { tone: 'info', label: `Starts ${formatDateTime(b.starts_at)}` };
    if (b.ends_at && Date.parse(b.ends_at) <= now) return { tone: 'warn', label: 'Ended' };
    return { tone: 'ok', label: b.ends_at ? `Live until ${formatDateTime(b.ends_at)}` : 'Live' };
}

const text = (field, lang = 'en') => (field && typeof field === 'object' ? field[lang] ?? '' : '');

export default function CarouselPage() {
    const toast = useToast();
    const { rows, rowById, ensureOverlay } = useCatalog();
    const [banners, setBanners] = useState([]);
    const [state, setState] = useState(supabase ? { status: 'loading', error: null } : { status: 'error', error: { message: 'Supabase is not configured.' } });
    const [editing, setEditing] = useState(null); // banner row, or {} for new
    const [dragId, setDragId] = useState(null);
    const [now] = useState(() => Date.now());

    const load = useCallback(async () => {
        if (!supabase) return;
        const { data, error } = await supabase.from('app_banners').select('*').order('position', { ascending: true });
        if (error) {
            setState({ status: 'error', error: describeError(error) });
            return;
        }
        setBanners(data ?? []);
        setState({ status: 'ready', error: null });
    }, []);

    useEffect(() => {
        let ignore = false;
        Promise.resolve().then(() => { if (!ignore) load(); });
        return () => { ignore = true; };
    }, [load]);

    // Brands as the app has them (Zoho's brand ids), for "Open a brand" slides.
    const brands = useMemo(() => {
        const map = new Map();
        rows.forEach((r) => { if (r.brandId && r.brandId !== 'other' && !map.has(r.brandId)) map.set(r.brandId, r.brandLabel || brandName(r.brandId)); });
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [rows]);
    const brandLabel = (id) => brands.find(([b]) => b === id)?.[1] ?? brandName(id);

    const persistOrder = async (ordered) => {
        const previous = banners;
        const next = ordered.map((b, i) => ({ ...b, position: i }));
        setBanners(next);
        const changed = next.filter((b) => previous.find((p) => p.id === b.id)?.position !== b.position);
        const results = await Promise.all(changed.map((b) => supabase.from('app_banners').update({ position: b.position }).eq('id', b.id)));
        const failed = results.find((r) => r.error);
        if (failed) {
            toast(describeError(failed.error).message, 'error');
            load();
        } else if (changed.length) {
            toast('Slide order saved');
        }
    };

    const move = (index, delta) => {
        const target = index + delta;
        if (target < 0 || target >= banners.length) return;
        const ordered = [...banners];
        const [item] = ordered.splice(index, 1);
        ordered.splice(target, 0, item);
        persistOrder(ordered);
    };

    const dropOn = (targetId) => {
        if (!dragId || dragId === targetId) return;
        const ordered = [...banners];
        const from = ordered.findIndex((b) => b.id === dragId);
        const to = ordered.findIndex((b) => b.id === targetId);
        const [item] = ordered.splice(from, 1);
        ordered.splice(to, 0, item);
        setDragId(null);
        persistOrder(ordered);
    };

    const toggleActive = async (banner, active) => {
        setBanners((list) => list.map((b) => (b.id === banner.id ? { ...b, active } : b)));
        const { error } = await supabase.from('app_banners').update({ active }).eq('id', banner.id);
        if (error) {
            toast(describeError(error).message, 'error');
            setBanners((list) => list.map((b) => (b.id === banner.id ? { ...b, active: !active } : b)));
        } else {
            toast(active ? 'Slide turned on' : 'Slide turned off');
        }
    };

    const onSaved = (row, isNew) => {
        setBanners((list) => (isNew ? [...list, row] : list.map((b) => (b.id === row.id ? row : b))).sort((a, b) => a.position - b.position));
        setEditing(null);
    };
    const onDeleted = (id) => {
        setBanners((list) => list.filter((b) => b.id !== id));
        setEditing(null);
    };

    const liveCount = banners.filter((b) => scheduleState(b, now).tone === 'ok').length;

    return (
        <div className="adm-page">
            <div className="adm-page__head">
                <div>
                    <h1 className="adm-h1">Carousel</h1>
                    <p className="adm-muted">Home screen slides in the app · {liveCount} live now. Drag or use the arrows to reorder.</p>
                </div>
                <button type="button" className="adm-btn adm-btn--primary" onClick={() => setEditing({})} disabled={state.status !== 'ready'}>
                    <Plus size={16} /> New slide
                </button>
            </div>

            {state.status === 'loading' && <div className="adm-loading"><Spinner label="Loading slides…" /></div>}
            {state.status === 'error' && <DbNotice error={state.error} onRetry={load} />}
            {state.status === 'ready' && banners.length === 0 && (
                <EmptyState icon={Images} title="No slides yet">Add a slide to feature a product, a category or your deals.</EmptyState>
            )}

            <ol className="adm-banners">
                {banners.map((b, i) => {
                    const product = b.product_id ? rowById.get(b.product_id) : null;
                    const opens = b.link_type === 'product' && b.link_value ? rowById.get(b.link_value) : null;
                    const sched = scheduleState(b, now);
                    return (
                        <li
                            key={b.id}
                            className={`adm-banner ${dragId === b.id ? 'is-dragging' : ''}`}
                            draggable
                            onDragStart={(e) => { setDragId(b.id); e.dataTransfer.effectAllowed = 'move'; }}
                            onDragEnd={() => setDragId(null)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); dropOn(b.id); }}
                        >
                            <span className="adm-banner__grip" aria-hidden="true"><GripVertical size={18} /></span>
                            <Thumb src={b.image_url || product?.image} size={64} />
                            <button type="button" className="adm-banner__main" onClick={() => setEditing(b)}>
                                <span className="adm-muted adm-small">{text(b.eyebrow) || '—'}</span>
                                <span className="adm-strong">{text(b.title) || 'Untitled slide'}</span>
                                <span className="adm-muted adm-small adm-ellipsis">
                                    {LINK_TYPES.find((l) => l.value === b.link_type)?.label}
                                    {b.link_type === 'product' && (product || b.link_value) ? `: ${opens?.name || b.link_value || product?.name}` : ''}
                                    {(b.link_type === 'category' || b.link_type === 'brand') && b.link_value ? `: ${b.link_type === 'brand' ? brandLabel(b.link_value) : b.link_value}` : ''}
                                </span>
                            </button>
                            <Badge tone={sched.tone}>{sched.label}</Badge>
                            <div className="adm-banner__ctrl">
                                <Toggle checked={b.active} onChange={(v) => toggleActive(b, v)} label={<span className="adm-sr">Active</span>} />
                                <button type="button" className="adm-icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={16} /></button>
                                <button type="button" className="adm-icon-btn" onClick={() => move(i, 1)} disabled={i === banners.length - 1} aria-label="Move down"><ArrowDown size={16} /></button>
                            </div>
                        </li>
                    );
                })}
            </ol>

            {editing && (
                <BannerEditor
                    key={editing.id ?? 'new'}
                    banner={editing.id ? editing : null}
                    nextPosition={banners.length ? Math.max(...banners.map((b) => b.position)) + 1 : 0}
                    rows={rows}
                    rowById={rowById}
                    brands={brands}
                    ensureOverlay={ensureOverlay}
                    onClose={() => setEditing(null)}
                    onSaved={onSaved}
                    onDeleted={onDeleted}
                />
            )}
        </div>
    );
}

/** The chosen product (or none) with Choose / Clear buttons. */
function ProductChoice({ row, id, empty, onChoose, onClear }) {
    return (
        <div className="adm-picked">
            {id && <Thumb src={row?.image} size={40} />}
            <span className="adm-picked__main">
                {id ? (
                    <>
                        <span className="adm-strong adm-ellipsis">{row?.name ?? id}</span>
                        <span className="adm-muted adm-small adm-ellipsis">
                            {row ? `${row.price.price ? formatIqd(row.price.price) : 'No price'}${row.reason ? ` · ${row.reason}` : ''} · ` : 'Not in the catalog · '}
                            <span className="adm-mono">{id}</span>
                        </span>
                    </>
                ) : <span className="adm-muted">{empty}</span>}
            </span>
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={onChoose}>{id ? 'Change' : 'Choose…'}</button>
            {id && <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={onClear}>Clear</button>}
        </div>
    );
}

function BannerEditor({ banner, nextPosition, rows, rowById, brands, ensureOverlay, onClose, onSaved, onDeleted }) {
    const toast = useToast();
    const isNew = !banner;
    const [form, setForm] = useState(() => ({
        eyebrow: banner?.eyebrow ?? {},
        title: banner?.title ?? {},
        subtitle: banner?.subtitle ?? {},
        image_url: banner?.image_url ?? null,
        product_id: banner?.product_id ?? '',
        link_type: banner?.link_type ?? 'product',
        link_value: banner?.link_value ?? '',
        starts_at: toLocalInput(banner?.starts_at),
        ends_at: toLocalInput(banner?.ends_at),
        active: banner?.active ?? true,
    }));
    const [lang, setLang] = useState('en');
    const [busy, setBusy] = useState('');
    const [picker, setPicker] = useState(null); // 'product' | 'link'
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const product = form.product_id ? rowById.get(form.product_id) ?? null : null;
    const price = product?.price ?? null;
    const priceText = price?.price ? formatIqd(price.price) : '';

    const errors = [];
    if (!LANGS.some((l) => String(form.title[l.code] ?? '').trim())) errors.push('Write a title.');
    if (form.link_type === 'product' && !form.product_id && !form.link_value) errors.push('Choose the product this slide opens.');
    if ((form.link_type === 'category' || form.link_type === 'brand') && !form.link_value) errors.push(`Choose the ${form.link_type} this slide opens.`);
    const startsIso = fromLocalInput(form.starts_at);
    const endsIso = fromLocalInput(form.ends_at);
    if (startsIso && endsIso && Date.parse(endsIso) <= Date.parse(startsIso)) errors.push('The end must be after the start.');
    const usesPrice = ['eyebrow', 'title', 'subtitle'].some((k) => LANGS.some((l) => String(form[k][l.code] ?? '').includes('{price}')));
    const warnings = [];
    if (usesPrice && !product) warnings.push('{price} needs a linked product, otherwise it stays empty.');
    if (product && !product.inApp) warnings.push(`The slide's product is not shown in the app right now (${product.reason}).`);
    LANGS.forEach((l) => {
        if (String(form.title.en ?? '').trim() && !String(form.title[l.code] ?? '').trim()) warnings.push(`Title has no ${l.label} text.`);
    });

    const clean = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, String(v ?? '').trim()]).filter(([, v]) => v));

    const save = async () => {
        if (errors.length) {
            toast(errors[0], 'error');
            return;
        }
        setBusy('save');
        // app_banners.product_id references app_products(id): a plain Zoho item first gets its
        // light overlay row ('z-' + zoho_id), then the slide links to it.
        let productId = form.product_id || null;
        if (product && !product.p) {
            try {
                productId = await ensureOverlay(product);
            } catch (err) {
                setBusy('');
                toast(err.message, 'error');
                return;
            }
        }
        const row = {
            eyebrow: clean(form.eyebrow),
            title: clean(form.title),
            subtitle: clean(form.subtitle),
            image_url: form.image_url || null,
            product_id: productId,
            link_type: form.link_type,
            link_value: form.link_type === 'product' ? (form.link_value || productId || null)
                : form.link_type === 'category' || form.link_type === 'brand' ? form.link_value : null,
            starts_at: startsIso,
            ends_at: endsIso,
            active: form.active,
        };
        if (isNew) row.position = nextPosition;
        const query = isNew ? supabase.from('app_banners').insert(row) : supabase.from('app_banners').update(row).eq('id', banner.id);
        const { data, error } = await query.select('*').single();
        setBusy('');
        if (error) {
            toast(describeError(error).message, 'error');
            return;
        }
        toast(isNew ? 'Slide added' : 'Slide saved');
        onSaved(data, isNew);
    };

    const remove = async () => {
        if (!window.confirm('Delete this slide?')) return;
        setBusy('delete');
        const { error } = await supabase.from('app_banners').delete().eq('id', banner.id);
        setBusy('');
        if (error) {
            toast(describeError(error).message, 'error');
            return;
        }
        toast('Slide deleted');
        onDeleted(banner.id);
    };

    const image = form.image_url || product?.image || null;
    const dir = LANGS.find((l) => l.code === lang)?.dir ?? 'ltr';
    const fill = (s) => String(s ?? '').replaceAll('{price}', priceText);
    const pick = (field) => form[field][lang] || form[field].en || '';

    return (
        <>
            <Drawer
                open
                wide
                onClose={onClose}
                title={isNew ? 'New slide' : text(banner.title) || 'Slide'}
                footer={
                    <div className="adm-row adm-row--between">
                        {!isNew ? (
                            <button type="button" className="adm-btn adm-btn--ghost adm-btn--danger-text" onClick={remove} disabled={Boolean(busy)}>
                                {busy === 'delete' ? <Spinner size={14} /> : <Trash2 size={16} />} Delete
                            </button>
                        ) : <span />}
                        <div className="adm-row">
                            <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>Cancel</button>
                            <button type="button" className="adm-btn adm-btn--primary" onClick={save} disabled={Boolean(busy)}>
                                {busy === 'save' ? <Spinner size={14} /> : <Save size={16} />} {isNew ? 'Add slide' : 'Save'}
                            </button>
                        </div>
                    </div>
                }
            >
                <div className="adm-banner-editor">
                    <div className="adm-form">
                        <Toggle checked={form.active} onChange={(v) => set('active', v)} label="Active" hint="Off slides never show, whatever the schedule" />
                        <LangFields label="Eyebrow" value={form.eyebrow} onChange={(v) => set('eyebrow', v)} placeholder="This week" />
                        <LangFields label="Title" value={form.title} onChange={(v) => set('title', v)} placeholder="MX Master 3S" />
                        <LangFields label="Subtitle" value={form.subtitle} onChange={(v) => set('subtitle', v)} multiline placeholder="Quiet clicks, 8K DPI. Now {price}"
                            hint="{price} is replaced with the linked product's current price in the app." />

                        <Field label="Product" hint="Any product in the catalog. Its image is used when the slide has no image, and its price fills {price}.">
                            <ProductChoice row={product} id={form.product_id} empty="No product" onChoose={() => setPicker('product')} onClear={() => set('product_id', '')} />
                        </Field>

                        <ImageInput label="Slide image" value={form.image_url} onChange={(v) => set('image_url', v)} folder="banners"
                            onError={(m) => toast(m, 'error')} hint="Optional. Empty = the product's image." />

                        <div className="adm-form-grid">
                            <Field label="When tapped">
                                <select className="adm-input" value={form.link_type} onChange={(e) => setForm((f) => ({ ...f, link_type: e.target.value, link_value: '' }))}>
                                    {LINK_TYPES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                                </select>
                            </Field>
                            {form.link_type === 'product' && (
                                <Field label="Product to open" hint="Empty = the slide's product" className="adm-span-2">
                                    <ProductChoice row={form.link_value ? rowById.get(form.link_value) : null} id={form.link_value} empty="Same as the slide's product"
                                        onChoose={() => setPicker('link')} onClear={() => set('link_value', '')} />
                                </Field>
                            )}
                            {form.link_type === 'category' && (
                                <Field label="Category">
                                    <select className="adm-input" value={form.link_value} onChange={(e) => set('link_value', e.target.value)}>
                                        <option value="">Choose…</option>
                                        {Object.keys(CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </Field>
                            )}
                            {form.link_type === 'brand' && (
                                <Field label="Brand">
                                    <select className="adm-input" value={form.link_value} onChange={(e) => set('link_value', e.target.value)}>
                                        <option value="">Choose…</option>
                                        {[...brands, ...(form.link_value && !brands.some(([b]) => b === form.link_value) ? [[form.link_value, brandName(form.link_value)]] : [])]
                                            .map(([b, label]) => <option key={b} value={b}>{label}</option>)}
                                    </select>
                                </Field>
                            )}
                            <Field label="Starts" hint="Empty = now">
                                <input className="adm-input" type="datetime-local" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
                            </Field>
                            <Field label="Ends" hint="Empty = no end">
                                <input className="adm-input" type="datetime-local" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} />
                            </Field>
                        </div>
                        {errors.map((e) => <p key={e} className="adm-field__error">{e}</p>)}
                        {warnings.map((w) => <p key={w} className="adm-warn-text adm-small">{w}</p>)}
                    </div>

                    <aside className="adm-preview">
                        <Segmented label="Preview language" value={lang} onChange={setLang} options={LANGS.map((l) => ({ value: l.code, label: l.code.toUpperCase() }))} />
                        <div className="adm-phone" aria-label="Phone preview">
                            <div className="adm-phone__notch" />
                            <div className="adm-phone__screen">
                                <div className="adm-phone__bar"><span>ITland</span></div>
                                <div className="adm-slide" dir={dir}>
                                    <div className="adm-slide__text">
                                        {pick('eyebrow') && <span className="adm-slide__eyebrow">{fill(pick('eyebrow'))}</span>}
                                        <span className="adm-slide__title">{fill(pick('title')) || 'Slide title'}</span>
                                        {pick('subtitle') && <span className="adm-slide__sub">{fill(pick('subtitle'))}</span>}
                                    </div>
                                    <div className="adm-slide__img">
                                        {isWebImage(image) ? <img src={image} alt="" />
                                            : isBundledImage(image) ? <span className="adm-slide__bundled"><Package size={22} />Bundled in app</span>
                                                : <span className="adm-slide__bundled"><Images size={22} />No image</span>}
                                    </div>
                                </div>
                                <div className="adm-phone__dots"><span className="is-on" /><span /><span /></div>
                                <div className="adm-phone__rows"><span /><span /><span /></div>
                            </div>
                        </div>
                        {price?.onSale && <p className="adm-muted adm-small">Product on sale: {formatIqd(price.price)} (was {formatIqd(price.regular)}).</p>}
                    </aside>
                </div>
            </Drawer>
            {picker && (
                <ProductPicker
                    title={picker === 'product' ? "Slide's product" : 'Product to open'}
                    rows={rows}
                    onClose={() => setPicker(null)}
                    onPick={(r) => {
                        set(picker === 'product' ? 'product_id' : 'link_value', r.key);
                        setPicker(null);
                    }}
                />
            )}
        </>
    );
}
