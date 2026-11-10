import React, { useDeferredValue, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Package, Plus, Search } from 'lucide-react';
import { useCatalog } from './context';
import ProductDrawer from './ProductDrawer';
import ZohoPicker from './ZohoPicker';
import WebsiteCatalog from './WebsiteCatalog';
import SyncPanel from './SyncPanel';
import { Badge, DbNotice, EmptyState, Notice, Segmented, Spinner, Thumb } from './ui';
import { CATEGORIES, formatIqd, formatUsd, stockText } from './lib';

const PAGE_SIZE = 50;

const FILTERS = {
    all: () => true,
    instock: (r) => r.anyStock,
    out: (r) => !r.anyStock,
    sale: (r) => r.price.onSale,
    featured: (r) => r.featured,
    hidden: (r) => r.hidden,
    curated: (r) => r.kind === 'curated',
    notinapp: (r) => !r.inApp,
};

const SORTS = {
    // Like the app: in-stock first, then the server's order (curated first, then Zoho's order).
    app: (a, b) => Number(b.inApp) - Number(a.inApp) || Number(b.anyStock) - Number(a.anyStock) || a.sortKey - b.sortKey || a.key.localeCompare(b.key),
    name: (a, b) => a.name.localeCompare(b.name),
    price: (a, b) => (b.price.price ?? 0) - (a.price.price ?? 0) || a.name.localeCompare(b.name),
    stock: (a, b) => a.stock.qty - b.stock.qty || a.name.localeCompare(b.name),
};

const REASON_HINT = {
    'Not in Zoho': 'Its Zoho item is not in the synced list, so the app does not show it.',
    'Gone from Zoho': 'This item is no longer in Zoho Books.',
    'Zoho service': 'Zoho lists it as a service, not goods, so the app does not show it.',
    'No price': 'No Zoho price (or no USD→IQD rate) and no base price, so the app does not show it.',
    'Sold out': 'Out of stock, and Settings hides sold-out products in the app.',
};

export default function ProductsPage() {
    const { rows, rowById, zohoItems, zohoState, productsState, settings, pricing, linked, website, reloadZoho, reloadProducts } = useCatalog();
    const [params, setParams] = useSearchParams();
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query);
    const [category, setCategory] = useState('all');
    const [brand, setBrand] = useState('all');
    const [filter, setFilter] = useState('all');
    const [sort, setSort] = useState('app');
    const [page, setPage] = useState(0);
    const [picking, setPicking] = useState(false);
    const [creating, setCreating] = useState(null); // Zoho item for a new curated product
    const listRef = useRef(null);
    const editId = params.get('product');
    const view = params.get('view') === 'catalog' ? 'catalog' : 'app';
    const setView = (v) => setParams((prev) => { const n = new URLSearchParams(prev); if (v === 'catalog') n.set('view', 'catalog'); else n.delete('view'); n.delete('product'); return n; });

    // Any change to what is listed starts again at page 1.
    const resetsPage = (setter) => (value) => { setter(value); setPage(0); };

    const categories = useMemo(() => {
        const count = new Map();
        rows.forEach((r) => count.set(r.category, (count.get(r.category) ?? 0) + 1));
        const ids = [...new Set([...Object.keys(CATEGORIES), ...count.keys()])];
        return ids.map((id) => ({ id, count: count.get(id) ?? 0 }));
    }, [rows]);

    const brands = useMemo(() => {
        const map = new Map();
        rows.forEach((r) => {
            const b = map.get(r.brandId) ?? { id: r.brandId, label: '', count: 0 };
            b.count += 1;
            if (!b.label && r.brandLabel) b.label = r.brandLabel;
            map.set(r.brandId, b);
        });
        return [...map.values()]
            .map((b) => ({ ...b, label: b.label || 'No brand' }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [rows]);

    const scoped = useMemo(() => {
        const terms = deferredQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
        return rows.filter((r) => (category === 'all' || r.category === category)
            && (brand === 'all' || r.brandId === brand)
            && terms.every((t) => r.search.includes(t)));
    }, [rows, category, brand, deferredQuery]);

    const counts = useMemo(() => {
        const c = Object.fromEntries(Object.keys(FILTERS).map((k) => [k, 0]));
        scoped.forEach((r) => Object.entries(FILTERS).forEach(([k, test]) => { if (test(r)) c[k] += 1; }));
        return c;
    }, [scoped]);

    const visible = useMemo(() => scoped.filter(FILTERS[filter]).sort(SORTS[sort]), [scoped, filter, sort]);
    const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const current = Math.min(page, pageCount - 1);
    const shown = visible.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
    const goTo = (n) => {
        setPage(n);
        listRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };

    const editing = editId ? rowById.get(editId) : null;
    const openEdit = (key) => setParams((prev) => { const n = new URLSearchParams(prev); n.set('product', key); return n; });
    const closeEdit = () => setParams((prev) => { const n = new URLSearchParams(prev); n.delete('product'); return n; });

    const loading = zohoState.status === 'loading' || productsState.status === 'loading';
    const failed = zohoState.status === 'error' ? zohoState : productsState.status === 'error' ? productsState : null;
    const ready = !loading && !failed;
    const inApp = useMemo(() => rows.filter((r) => r.inApp).length, [rows]);

    return (
        <div className="adm-page">
            <div className="adm-page__head">
                <div>
                    <h1 className="adm-h1">Products &amp; discounts</h1>
                    <p className="adm-muted">
                        Every Zoho Books item, as the app shows it{ready ? ` · ${inApp.toLocaleString('en-US')} of ${rows.length.toLocaleString('en-US')} shown in the app` : ''}.
                        {' '}Prices rounded to {pricing.roundTo.toLocaleString('en-US')} IQD.
                    </p>
                </div>
                <div className="adm-row adm-row--wrap">
                    <button type="button" className="adm-btn adm-btn--primary" onClick={() => setPicking(true)} disabled={!ready || view !== 'app'}
                        title="Give a Zoho item its own product page content (photos, colours, features, specs)">
                        <Plus size={16} /> New curated product
                    </button>
                </div>
            </div>

            <SyncPanel />

            {settings.status === 'ready' && !pricing.rate && (
                <Notice tone="error" title="No USD → IQD rate">
                    The synced market rate is missing or over 3 days old, so products priced from Zoho have no IQD price and the app hides them.
                    {' '}Only products with a base price set here still show. Set a manual rate in Settings, or use Sync now.
                </Notice>
            )}
            {zohoState.status === 'ready' && zohoState.error && <Notice tone="error" title="Zoho items">{zohoState.error.message}</Notice>}
            {productsState.status === 'ready' && productsState.error && <Notice tone="error" title="App products">{productsState.error.message}</Notice>}

            <div className="adm-toolbar">
                <Segmented
                    label="Products view"
                    value={view}
                    onChange={setView}
                    options={[
                        { value: 'app', label: 'App catalog', count: rows.length },
                        { value: 'catalog', label: 'Website catalog', count: website.items.length || undefined },
                    ]}
                />
            </div>

            {view === 'catalog' && <WebsiteCatalog />}

            {view === 'app' && (
                <>
                    <div className="adm-toolbar">
                        <Segmented
                            label="Product filter"
                            value={filter}
                            onChange={resetsPage(setFilter)}
                            options={[
                                { value: 'all', label: 'All', count: counts.all },
                                { value: 'instock', label: 'In stock', count: counts.instock },
                                { value: 'out', label: 'Out of stock', count: counts.out },
                                { value: 'sale', label: 'On sale', count: counts.sale },
                                { value: 'featured', label: 'Best sellers', count: counts.featured },
                                { value: 'hidden', label: 'Hidden', count: counts.hidden },
                                { value: 'curated', label: 'Curated', count: counts.curated },
                                { value: 'notinapp', label: 'Not in app', count: counts.notinapp },
                            ]}
                        />
                    </div>
                    <div className="adm-toolbar">
                        <div className="adm-toolbar__right">
                            <select className="adm-input adm-input--sm" value={category} onChange={(e) => resetsPage(setCategory)(e.target.value)} aria-label="Category">
                                <option value="all">All categories</option>
                                {categories.map((c) => <option key={c.id} value={c.id}>{c.id} ({c.count})</option>)}
                            </select>
                            <select className="adm-input adm-input--sm" value={brand} onChange={(e) => resetsPage(setBrand)(e.target.value)} aria-label="Brand">
                                <option value="all">All brands</option>
                                {brands.map((b) => <option key={b.id} value={b.id}>{b.label} ({b.count})</option>)}
                            </select>
                            <select className="adm-input adm-input--sm" value={sort} onChange={(e) => resetsPage(setSort)(e.target.value)} aria-label="Sort">
                                <option value="app">App order</option>
                                <option value="name">Name A–Z</option>
                                <option value="price">Price, high first</option>
                                <option value="stock">Stock, low first</option>
                            </select>
                            <label className="adm-search">
                                <Search size={16} aria-hidden="true" />
                                <input value={query} onChange={(e) => resetsPage(setQuery)(e.target.value)} placeholder="Name, brand, Zoho id" aria-label="Search products" />
                            </label>
                        </div>
                    </div>

                    {loading && <div className="adm-loading"><Spinner label="Loading the catalog…" /></div>}
                    {failed && <DbNotice error={failed.error} onRetry={() => { reloadZoho(); reloadProducts(); }} />}
                    {ready && visible.length === 0 && (
                        <EmptyState icon={Package} title={rows.length === 0 ? 'No Zoho items synced yet' : 'Nothing matches'}>
                            {rows.length === 0 ? 'Use Sync now above. The first sync takes up to a minute.' : 'Try another filter or search.'}
                        </EmptyState>
                    )}

                    {ready && shown.length > 0 && (
                        <div className="adm-table" role="table" aria-label="App catalog" ref={listRef}>
                            <div className="adm-table__head" role="row">
                                <span role="columnheader">Product</span>
                                <span role="columnheader">Category</span>
                                <span role="columnheader">USD</span>
                                <span role="columnheader">Price</span>
                                <span role="columnheader">Stock</span>
                                <span role="columnheader">Tags</span>
                            </div>
                            {shown.map((r) => <ProductRow key={r.key} row={r} onOpen={openEdit} />)}
                        </div>
                    )}

                    {ready && visible.length > PAGE_SIZE && (
                        <div className="adm-pager">
                            <span className="adm-muted">
                                {(current * PAGE_SIZE + 1).toLocaleString('en-US')}–{Math.min(visible.length, (current + 1) * PAGE_SIZE).toLocaleString('en-US')} of {visible.length.toLocaleString('en-US')}
                            </span>
                            <div className="adm-row">
                                <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => goTo(current - 1)} disabled={current === 0}>
                                    <ChevronLeft size={14} /> Previous
                                </button>
                                <span className="adm-small">Page {current + 1} of {pageCount}</span>
                                <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => goTo(current + 1)} disabled={current >= pageCount - 1}>
                                    Next <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {editing && <ProductDrawer key={editing.key} row={editing} onClose={closeEdit} />}
            {creating && <ProductDrawer key="new" create={{ zohoItem: creating }} onClose={() => setCreating(null)} />}
            {picking && (
                <ZohoPicker
                    title="New curated product"
                    items={zohoItems}
                    status={zohoState.status}
                    error={zohoState.error}
                    linked={linked}
                    pricing={pricing}
                    onClose={() => setPicking(false)}
                    onPick={(item) => {
                        setPicking(false);
                        setCreating(item);
                    }}
                />
            )}
        </div>
    );
}

function ProductRow({ row: r, onOpen }) {
    const { p, z, price, stock } = r;
    return (
        <button type="button" role="row" className={`adm-table__row adm-prod ${r.inApp ? '' : 'is-hidden'}`} onClick={() => onOpen(r.key)}>
            <span className="adm-prod__main" role="cell">
                <Thumb src={r.image} size={44} />
                <span className="adm-prod__text">
                    <span className="adm-strong adm-ellipsis" title={z?.raw_name && z.raw_name !== r.name ? `Zoho: ${z.raw_name}` : undefined}>{r.name}</span>
                    <span className="adm-muted adm-ellipsis">
                        {r.brandLabel || 'No brand'} · <span className="adm-mono">{z?.zoho_id ?? p?.id}</span>
                        {r.colors.length > 0 ? ` · ${r.colors.length} colour${r.colors.length === 1 ? '' : 's'}` : ''}
                    </span>
                </span>
            </span>
            <span role="cell" className="adm-prod__cat" title={p?.category && z ? `Set in the dashboard (Zoho: ${z.category}${z.sub ? ` / ${z.sub}` : ''})` : undefined}>
                {r.category}{r.sub ? <span className="adm-muted"> / {r.sub}</span> : null}
            </span>
            <span role="cell" className="adm-prod__zoho">
                {z ? formatUsd(price.usd) : p?.zoho_id ? <span className="adm-warn-text" title={p.zoho_id}>Not in Zoho</span> : <span className="adm-muted">No Zoho</span>}
            </span>
            <span role="cell" className="adm-prod__price">
                {price.onSale ? (
                    <>
                        <span className="adm-sale-price">{formatIqd(price.price)} <Badge tone="sale">−{price.percent}%</Badge></span>
                        <s className="adm-muted">{formatIqd(price.regular)}</s>
                    </>
                ) : (
                    <>
                        <span>{price.price ? formatIqd(price.price) : <span className="adm-danger-text">No price</span>}</span>
                        {price.saleProblem && <span className="adm-warn-text adm-small">{price.saleProblem}</span>}
                        {!price.saleProblem && price.source === 'base' && <span className="adm-muted adm-small">base price</span>}
                    </>
                )}
            </span>
            <span role="cell" className="adm-prod__stock">
                <span className={r.anyStock ? '' : 'adm-danger-text'} title={stock.unknown ? 'No override and no Zoho stock figure: the app treats it as out of stock' : undefined}>{stockText(stock)}</span>
                {stock.source === 'override' && <span className="adm-muted adm-small"> override</span>}
                {r.variants.length > 0 && <span className="adm-muted adm-small"> · colours {r.variants.reduce((s, v) => s + v.stock, 0)}</span>}
            </span>
            <span role="cell" className="adm-prod__tags">
                {r.hidden && <Badge tone="neutral">Hidden</Badge>}
                {r.reason && r.reason !== 'Hidden' && <Badge tone="warn" title={REASON_HINT[r.reason]}>{r.reason}</Badge>}
                {r.featured && <Badge tone="info" title={p?.featured ? '' : 'Featured in Zoho Books'}>Best seller</Badge>}
                {r.isNew && <Badge tone="ok">New</Badge>}
                {r.flash && <Badge tone={price.onSale ? 'sale' : 'warn'} title={price.onSale ? '' : 'Flash needs a running sale price'}>Flash</Badge>}
                {r.kind === 'curated' && <Badge tone="info" title="Has its own product page content">Curated</Badge>}
                {r.kind === 'edited' && <Badge tone="neutral" title="Has changes made in the dashboard">Edited</Badge>}
                <ChevronRight size={16} className="adm-order__chev" aria-hidden="true" />
            </span>
        </button>
    );
}
