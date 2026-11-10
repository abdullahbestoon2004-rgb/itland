import React, { useDeferredValue, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge, Drawer, EmptyState, Thumb } from './ui';
import { formatIqd, formatUsd, iqdFromUsd, plainId } from './lib';

const LIMIT = 120;

/**
 * Searches the synced Zoho items (app_zoho_items). `linked` maps a Zoho id to the overlay row
 * already using it ({id, role}); zoho_id is unique and a colour belongs to one product, so those
 * items cannot be picked for another product.
 */
export default function ZohoPicker({ title, items, linked, currentAppId, pricing, onPick, onClose, status, error }) {
    const [query, setQuery] = useState('');
    const deferred = useDeferredValue(query);
    const { results, total } = useMemo(() => {
        const q = deferred.trim().toLowerCase();
        const list = q
            ? items.filter((i) => `${i.name} ${i.raw_name ?? ''} ${i.brand ?? ''} ${i.category ?? ''} ${i.zoho_id}`.toLowerCase().includes(q))
            : items;
        return { results: list.slice(0, LIMIT), total: list.length };
    }, [items, deferred]);

    const usedText = (used) => {
        if (used.role === 'colour') return `A colour of ${used.id}`;
        if (used.id.startsWith('z-')) return 'Has app changes already (edit it from the list)';
        return `Used by ${used.id}`;
    };

    return (
        <Drawer open onClose={onClose} title={title} subtitle={`${items.length.toLocaleString('en-US')} items synced from Zoho Books`}>
            <label className="adm-search adm-search--block">
                <Search size={16} aria-hidden="true" />
                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, brand or Zoho item id" aria-label="Search Zoho items" />
            </label>
            {status === 'loading' && <p className="adm-muted">Loading the Zoho items…</p>}
            {error && <p className="adm-field__error">{error.message ?? error}</p>}
            {status !== 'loading' && results.length === 0 && <EmptyState title="No Zoho items match" />}
            <ul className="adm-pick-list">
                {results.map((item) => {
                    const zid = String(item.zoho_id);
                    const used = linked.get(zid);
                    const blocked = Boolean(used) && used.id !== currentAppId;
                    const iqd = iqdFromUsd(item.usd_price, pricing?.rate, pricing?.roundTo);
                    const stock = item.stock === null || item.stock === undefined ? null : Number(item.stock);
                    return (
                        <li key={zid}>
                            <button type="button" className="adm-pick" disabled={blocked} onClick={() => onPick(item)}>
                                <Thumb src={item.image_url} size={40} />
                                <span className="adm-pick__main">
                                    <span className="adm-strong adm-ellipsis" title={item.raw_name || item.name}>{item.name}</span>
                                    <span className="adm-muted adm-mono">{zid}{item.brand ? ` · ${item.brand}` : ''} · {item.category}{item.sub ? ` / ${item.sub}` : ''}</span>
                                    {used && <span className="adm-muted">{blocked ? usedText(used) : used.id === plainId(zid) ? 'This item' : 'Linked to this product'}</span>}
                                    {(!item.active || item.kind !== 'goods') && (
                                        <span><Badge tone="warn">{!item.active ? 'Gone from Zoho' : 'Zoho service'}</Badge></span>
                                    )}
                                </span>
                                <span className="adm-pick__side">
                                    <span>{formatUsd(item.usd_price)}</span>
                                    {iqd && <span className="adm-muted">{formatIqd(iqd)}</span>}
                                    <span className={stock > 0 ? 'adm-ok-text' : 'adm-danger-text'}>
                                        {stock === null ? '0 · no Zoho stock' : `${stock} in stock`}
                                    </span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            {total > results.length && (
                <p className="adm-muted adm-small">Showing {results.length} of {total.toLocaleString('en-US')}. Type more to narrow it down.</p>
            )}
        </Drawer>
    );
}
