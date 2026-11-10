import React, { useDeferredValue, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge, Drawer, EmptyState, Thumb } from './ui';
import { formatIqd } from './lib';

const LIMIT = 80;

/** Searches the whole app catalog: curated products and plain Zoho items. */
export default function ProductPicker({ title, rows, onPick, onClose }) {
    const [query, setQuery] = useState('');
    const deferred = useDeferredValue(query);
    const { results, total } = useMemo(() => {
        const q = deferred.trim().toLowerCase();
        const list = (q ? rows.filter((r) => r.search.includes(q)) : rows)
            .slice()
            .sort((a, b) => Number(b.inApp) - Number(a.inApp) || Number(b.kind === 'curated') - Number(a.kind === 'curated') || a.sortKey - b.sortKey);
        return { results: list.slice(0, LIMIT), total: list.length };
    }, [rows, deferred]);

    return (
        <Drawer open onClose={onClose} title={title} subtitle={`${rows.length.toLocaleString('en-US')} products in the catalog`}>
            <label className="adm-search adm-search--block">
                <Search size={16} aria-hidden="true" />
                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, brand or Zoho item id" aria-label="Search products" />
            </label>
            {results.length === 0 && <EmptyState title="No products match" />}
            <ul className="adm-pick-list">
                {results.map((row) => (
                    <li key={row.key}>
                        <button type="button" className="adm-pick" onClick={() => onPick(row)}>
                            <Thumb src={row.image} size={40} />
                            <span className="adm-pick__main">
                                <span className="adm-strong adm-ellipsis">{row.name}</span>
                                <span className="adm-muted adm-mono adm-ellipsis">{row.brandLabel ? `${row.brandLabel} · ` : ''}{row.key}</span>
                                <span className="adm-chips">
                                    {row.kind === 'curated' && <Badge tone="info">Curated</Badge>}
                                    {row.reason && <Badge tone="warn">{row.reason}</Badge>}
                                </span>
                            </span>
                            <span className="adm-pick__side">
                                <span>{row.price.price ? formatIqd(row.price.price) : '—'}</span>
                                <span className={row.anyStock ? 'adm-ok-text' : 'adm-danger-text'}>{row.stock.qty} in stock</span>
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
            {total > results.length && (
                <p className="adm-muted adm-small">Showing {results.length} of {total.toLocaleString('en-US')}. Type more to narrow it down.</p>
            )}
        </Drawer>
    );
}
