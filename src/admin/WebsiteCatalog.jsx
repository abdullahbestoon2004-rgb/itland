import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Store } from 'lucide-react';
import { useCatalog } from './context';
import { Badge, EmptyState, Notice, Segmented, Spinner, Thumb } from './ui';
import { formatUsd } from './lib';

const PAGE = 200;

/** Zoho stock with the shared rule: no figure counts as 0 (out of stock). */
const zohoStock = (item) => (item.stock_on_hand === null || item.stock_on_hand === undefined
    ? { qty: 0, unknown: true }
    : { qty: Number(item.stock_on_hand), unknown: false });

/**
 * Read-only view of the website catalog exactly as /api/products?view=admin returns it
 * (Zoho Books), including the wholesale prices the old dashboard showed. The app does not use
 * it (its catalog is app_zoho_items), so it loads only when this view is opened.
 */
export default function WebsiteCatalog() {
    const { website: zoho, loadWebsite } = useCatalog();
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [limit, setLimit] = useState(PAGE);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        let ignore = false;
        Promise.resolve().then(() => {
            if (!ignore && zoho.status === 'idle') loadWebsite();
        });
        return () => { ignore = true; };
    }, [zoho.status, loadWebsite]);

    const refresh = async () => {
        setRefreshing(true);
        await loadWebsite({ refresh: true });
        setRefreshing(false);
    };

    const rows = useMemo(() => zoho.items.map((item) => ({ item, stock: zohoStock(item) })), [zoho.items]);

    const counts = useMemo(() => {
        const c = { all: rows.length, featured: 0, out: 0, nowholesale: 0 };
        rows.forEach(({ item, stock }) => {
            if (item.featured) c.featured += 1;
            if (stock.unknown || stock.qty <= 0) c.out += 1;
            if (item.wholesale_price === null || item.wholesale_price === undefined) c.nowholesale += 1;
        });
        return c;
    }, [rows]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows.filter(({ item, stock }) => {
            if (filter === 'featured' && !item.featured) return false;
            if (filter === 'out' && !(stock.unknown || stock.qty <= 0)) return false;
            if (filter === 'nowholesale' && !(item.wholesale_price === null || item.wholesale_price === undefined)) return false;
            if (!q) return true;
            return `${item.name} ${item.original_name ?? ''} ${item.brand ?? ''} ${item.category ?? ''} ${item.zoho_item_id ?? item.id}`
                .toLowerCase().includes(q);
        });
    }, [rows, query, filter]);

    const shown = visible.slice(0, limit);

    return (
        <>
            <div className="adm-toolbar">
                <Segmented
                    label="Catalog filter"
                    value={filter}
                    onChange={(v) => { setFilter(v); setLimit(PAGE); }}
                    options={[
                        { value: 'all', label: 'All', count: counts.all },
                        { value: 'featured', label: 'Featured', count: counts.featured },
                        { value: 'out', label: 'Out of stock', count: counts.out },
                        { value: 'nowholesale', label: 'No wholesale price', count: counts.nowholesale },
                    ]}
                />
                <div className="adm-toolbar__right">
                    <label className="adm-search">
                        <Search size={16} aria-hidden="true" />
                        <input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder="Name, brand, Zoho item id" aria-label="Search the website catalog" />
                    </label>
                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={refresh} disabled={refreshing || zoho.status === 'loading'} title="Reload this list from Zoho Books">
                        <RefreshCw size={14} className={refreshing ? 'adm-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>
            <p className="adm-muted adm-small">
                Read-only, as the website shows it, with wholesale prices. Edit names, prices, stock and the Featured flag in Zoho Books.
                The app uses the App catalog view, which syncs from the same list every 10 minutes.
            </p>
            {zoho.error && rows.length > 0 && <Notice tone="error" title="Website catalog">{zoho.error}</Notice>}
            {zoho.stale && !zoho.error && <Notice tone="warn">Zoho Books is not responding. This is the last list the website loaded.</Notice>}

            {(zoho.status === 'loading' || zoho.status === 'idle') && <div className="adm-loading"><Spinner label="Loading the website catalog…" /></div>}
            {(zoho.status === 'ready' || zoho.status === 'error') && visible.length === 0 && (
                <EmptyState icon={Store} title={rows.length === 0 ? 'No catalog items loaded' : 'Nothing matches'}>
                    {rows.length === 0 ? (zoho.error || 'Use Refresh to load the catalog.') : 'Try another filter or search.'}
                </EmptyState>
            )}

            {shown.length > 0 && (
                <div className="adm-table adm-table--catalog" role="table" aria-label="Website catalog">
                    <div className="adm-table__head" role="row">
                        <span role="columnheader">Item</span>
                        <span role="columnheader">Brand</span>
                        <span role="columnheader">Retail</span>
                        <span role="columnheader">Wholesale</span>
                        <span role="columnheader">Stock</span>
                        <span role="columnheader">Featured</span>
                    </div>
                    {shown.map(({ item, stock }) => {
                        const zid = String(item.zoho_item_id ?? item.id);
                        const out = stock.unknown || stock.qty <= 0;
                        return (
                            <div key={zid} role="row" className="adm-table__row adm-cat">
                                <span className="adm-prod__main" role="cell">
                                    <Thumb src={item.images?.[0]} size={40} />
                                    <span className="adm-prod__text">
                                        <span className="adm-strong adm-ellipsis" title={item.original_name || item.name}>{item.name}</span>
                                        <span className="adm-muted adm-mono adm-ellipsis">Zoho item {zid}{item.category ? ` · ${item.category}` : ''}</span>
                                    </span>
                                </span>
                                <span role="cell" className="adm-cat__brand">{item.brand || <span className="adm-muted">—</span>}</span>
                                <span role="cell" className="adm-cat__retail">{formatUsd(item.price)}</span>
                                <span role="cell" className="adm-cat__wholesale">
                                    {item.wholesale_price !== null && item.wholesale_price !== undefined
                                        ? formatUsd(item.wholesale_price)
                                        : <span className="adm-muted">—</span>}
                                </span>
                                <span role="cell" className={`adm-cat__stock ${out ? 'adm-danger-text' : ''}`}>
                                    {stock.unknown ? '0 · no Zoho stock' : stock.qty}
                                </span>
                                <span role="cell" className="adm-cat__featured">
                                    {item.featured ? <Badge tone="info">Featured</Badge> : <span className="adm-muted">—</span>}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
            {visible.length > shown.length && (
                <div className="adm-center">
                    <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setLimit((n) => n + PAGE)}>
                        Show more ({visible.length - shown.length} left)
                    </button>
                </div>
            )}
        </>
    );
}
