import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, BellOff, ChevronRight, Inbox, RefreshCw, Search, Store, Truck } from 'lucide-react';
import { useOrders } from './context';
import OrderDrawer from './OrderDrawer';
import { Badge, DbNotice, EmptyState, Segmented, Spinner } from './ui';
import {
    SPECIAL_LABEL, STATUS_LABEL, customerName, customerPhone, formatIqd, isDeletedAccount, orderGroup, relativeTime, titleCase,
} from './lib';

const GROUP_TONE = { new: 'info', active: 'warn', completed: 'ok', cancelled: 'danger' };

const matches = (order, q) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    const digits = q.replace(/\D/g, '');
    const hay = [order.id, order.receiver_name, order.app_customers?.name, order.app_customers?.email].filter(Boolean).join(' ').toLowerCase();
    if (hay.includes(needle)) return true;
    if (digits.length >= 3) {
        return [order.receiver_phone, order.app_customers?.phone, order.id].some((v) => String(v ?? '').replace(/\D/g, '').includes(digits));
    }
    return false;
};

export default function OrdersPage() {
    const {
        orders, status, error, hasMore, loadingMore, live, unseen, soundOn, now,
        reload, loadOlder, searchRemote, updateOrder, markSeen, setSoundOn,
    } = useOrders();
    const [params, setParams] = useSearchParams();
    const [group, setGroup] = useState('open');
    const [type, setType] = useState('all');
    const [query, setQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const selectedId = params.get('order');

    // Search beyond the loaded page once the admin pauses typing.
    useEffect(() => {
        const q = query.trim();
        if (q.length < 3) return undefined;
        const id = setTimeout(() => { searchRemote(q); }, 450);
        return () => clearTimeout(id);
    }, [query, searchRemote]);

    const counts = useMemo(() => {
        const c = { all: 0, open: 0, new: 0, active: 0, completed: 0, cancelled: 0 };
        orders.forEach((o) => {
            if (type !== 'all' && o.type !== type) return;
            const g = orderGroup(o);
            c.all += 1;
            c[g] += 1;
            if (g === 'new' || g === 'active') c.open += 1;
        });
        return c;
    }, [orders, type]);

    const visible = useMemo(() => orders.filter((o) => {
        if (type !== 'all' && o.type !== type) return false;
        const g = orderGroup(o);
        if (group === 'open' && !(g === 'new' || g === 'active')) return false;
        if (group !== 'open' && group !== 'all' && g !== group) return false;
        return matches(o, query.trim());
    }), [orders, type, group, query]);

    const selected = selectedId ? orders.find((o) => o.id === selectedId) : null;

    const openOrder = (id) => {
        markSeen(id);
        setParams((p) => {
            const next = new URLSearchParams(p);
            next.set('order', id);
            return next;
        });
    };
    const closeOrder = useCallback(() => {
        setParams((p) => {
            const next = new URLSearchParams(p);
            next.delete('order');
            return next;
        });
    }, [setParams]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await reload();
        setRefreshing(false);
    };

    return (
        <div className="adm-page">
            <div className="adm-page__head">
                <div>
                    <h1 className="adm-h1">Orders</h1>
                    <p className="adm-muted">Orders placed in the mobile app. Changes here show up in the customer's app instantly.</p>
                </div>
                <div className="adm-row">
                    <span className={`adm-live adm-live--${live}`} title={live === 'live' ? 'Receiving new orders in real time' : 'Realtime unavailable, checking every 45 seconds'}>
                        <span className="adm-live__dot" aria-hidden="true" />
                        {live === 'live' ? 'Live' : live === 'offline' ? 'Polling' : 'Connecting'}
                    </span>
                    <button type="button" className="adm-icon-btn" onClick={() => setSoundOn(!soundOn)} aria-pressed={soundOn} title={soundOn ? 'Sound on for new orders' : 'Sound off'}>
                        {soundOn ? <Bell size={18} /> : <BellOff size={18} />}
                    </button>
                    <button type="button" className="adm-icon-btn" onClick={handleRefresh} title="Refresh" disabled={refreshing}>
                        <RefreshCw size={18} className={refreshing ? 'adm-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="adm-toolbar">
                <Segmented
                    label="Order status"
                    value={group}
                    onChange={setGroup}
                    options={[
                        { value: 'open', label: 'Open', count: counts.open },
                        { value: 'new', label: 'New', count: counts.new },
                        { value: 'active', label: 'Active', count: counts.active },
                        { value: 'completed', label: 'Completed', count: counts.completed },
                        { value: 'cancelled', label: 'Cancelled', count: counts.cancelled },
                        { value: 'all', label: 'All', count: counts.all },
                    ]}
                />
                <div className="adm-toolbar__right">
                    <select className="adm-input adm-input--sm" value={type} onChange={(e) => setType(e.target.value)} aria-label="Order type">
                        <option value="all">Delivery &amp; pickup</option>
                        <option value="delivery">Delivery</option>
                        <option value="pickup">Pickup</option>
                    </select>
                    <label className="adm-search">
                        <Search size={16} aria-hidden="true" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Order id, phone, name or email" aria-label="Search orders" />
                    </label>
                </div>
            </div>

            {status === 'loading' && <div className="adm-loading"><Spinner label="Loading orders…" /></div>}
            {status === 'error' && <DbNotice error={error} onRetry={handleRefresh} />}

            {status === 'ready' && visible.length === 0 && (
                <EmptyState icon={Inbox} title={orders.length === 0 ? 'No orders yet' : 'No orders match'}>
                    {orders.length === 0 ? 'New app orders appear here the moment they are placed.' : 'Try another filter or search.'}
                </EmptyState>
            )}

            {visible.length > 0 && (
                <ul className="adm-orders">
                    {visible.map((o) => {
                        const g = orderGroup(o);
                        const items = o.app_order_items ?? [];
                        const qty = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
                        return (
                            <li key={o.id}>
                                <button type="button" className={`adm-order ${unseen.has(o.id) ? 'is-unseen' : ''} ${selectedId === o.id ? 'is-selected' : ''}`} onClick={() => openOrder(o.id)}>
                                    <span className="adm-order__id">
                                        {unseen.has(o.id) && <span className="adm-dot" aria-label="New" />}
                                        <strong className="adm-mono">{o.id}</strong>
                                        <span className="adm-muted">{relativeTime(o.created_at, now)}</span>
                                    </span>
                                    <span className="adm-order__who">
                                        <span className={isDeletedAccount(o) ? 'adm-muted' : 'adm-strong'}>{customerName(o)}</span>
                                        <span className="adm-muted adm-mono">{customerPhone(o)}</span>
                                    </span>
                                    <span className="adm-order__what">
                                        <span className="adm-order__type">
                                            {o.type === 'pickup' ? <Store size={14} /> : <Truck size={14} />}
                                            {o.type === 'pickup' ? `Pickup · ${titleCase(o.branch || 'store')}` : titleCase(o.city)}
                                        </span>
                                        <span className="adm-muted adm-ellipsis">
                                            {qty} item{qty === 1 ? '' : 's'}{items[0] ? ` · ${items.map((i) => i.name).join(', ')}` : ''}
                                        </span>
                                    </span>
                                    <span className="adm-order__status">
                                        <Badge tone={GROUP_TONE[g]}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
                                        {o.special && <Badge tone={o.special === 'delayed' ? 'warn' : 'danger'}>{SPECIAL_LABEL[o.special]}</Badge>}
                                        {items.some((i) => i.options?.preorder === true) && <Badge tone="warn">Pre-order</Badge>}
                                    </span>
                                    <span className="adm-order__total">{formatIqd(o.total)}</span>
                                    <ChevronRight size={16} className="adm-order__chev" aria-hidden="true" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {status === 'ready' && hasMore && (
                <div className="adm-center">
                    <button type="button" className="adm-btn adm-btn--ghost" onClick={loadOlder} disabled={loadingMore}>
                        {loadingMore ? <Spinner size={14} /> : null} Load older orders
                    </button>
                </div>
            )}

            {selected && <OrderDrawer key={selected.id} order={selected} onClose={closeOrder} updateOrder={updateOrder} />}
            {selectedId && !selected && status === 'ready' && (
                <OrderLookup id={selectedId} searchRemote={searchRemote} onClose={closeOrder} />
            )}
        </div>
    );
}

/** A deep link to an order that is not in the loaded page: look it up once. */
function OrderLookup({ id, searchRemote, onClose }) {
    const [state, setState] = useState('searching');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let ignore = false;
        searchRemote(id).then((n) => {
            if (ignore) return;
            // null = the search itself failed (searchRemote already showed why).
            if (n === null) setState('failed');
            else if (n === 0) setState('missing');
        });
        return () => { ignore = true; };
    }, [id, searchRemote, attempt]);
    if (state === 'searching') return null;
    const retry = () => {
        setState('searching');
        setAttempt((n) => n + 1);
    };
    return (
        <div className="adm-floating-note">
            {state === 'failed' ? (
                <>Could not look up order {id}. <button type="button" className="adm-link" onClick={retry}>Retry</button> · </>
            ) : `Order ${id} was not found. `}
            <button type="button" className="adm-link" onClick={onClose}>Dismiss</button>
        </div>
    );
}
