import React, { useState } from 'react';
import {
    AlertTriangle, Ban, Check, Clock, Mail, MapPin, MessageCircle, Phone, RefreshCw, RotateCcw, Store, Truck, Undo2, UserX, XCircle,
} from 'lucide-react';
import { useCatalog, useToast } from './context';
import { Badge, CopyButton, Drawer, Field, Spinner, Thumb } from './ui';
import {
    CLOSED_SPECIALS, NEXT_LABEL, SPECIAL_LABEL, STATUS_LABEL, customerEmail, customerName, customerPhone, flowFor, formatDateTime,
    formatDay, formatIqd, isDeletedAccount, newHandoverCode, newPickupCode, nextStep, orderGroup, slotText, titleCase, waLink,
} from './lib';

const GROUP_TONE = { new: 'info', active: 'warn', completed: 'ok', cancelled: 'danger' };

const PREORDER_KEYS = new Set(['preorder', 'restock']);

// How the customer pays (app_orders.pay). fib and card are paid up front in the app; cod and store
// are paid on handover. 20261110120000_app_online_payments.sql.
const PAY_LABEL = { cod: 'Cash on delivery', store: 'Pay at store', fib: 'FIB', card: 'Card (Visa / Mastercard)' };
const isOnlinePay = (order) => order.pay === 'fib' || order.pay === 'card';

function optionText(options) {
    if (!options || typeof options !== 'object') return [];
    return Object.entries(options)
        .filter(([k, v]) => v !== null && v !== undefined && v !== '' && !(options.preorder === true && PREORDER_KEYS.has(k)))
        .map(([k, v]) => `${titleCase(k)}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
}

function Timeline({ order }) {
    const flow = flowFor(order);
    const times = order.times && typeof order.times === 'object' ? order.times : {};
    const current = flow.indexOf(order.status);
    const closed = CLOSED_SPECIALS.has(order.special);
    return (
        <ol className="adm-timeline">
            {flow.map((step, i) => {
                const done = i <= current;
                return (
                    <li key={step} className={`adm-timeline__step ${done ? 'is-done' : ''} ${i === current ? 'is-current' : ''}`}>
                        <span className="adm-timeline__dot" aria-hidden="true">{done ? <Check size={12} /> : null}</span>
                        <span className="adm-timeline__label">{STATUS_LABEL[step]}</span>
                        <span className="adm-timeline__time">{times[step] ? formatDateTime(times[step]) : ''}</span>
                    </li>
                );
            })}
            {order.special && (
                <li className={`adm-timeline__step is-special ${closed ? 'is-closed' : ''}`}>
                    <span className="adm-timeline__dot" aria-hidden="true"><AlertTriangle size={12} /></span>
                    <span className="adm-timeline__label">
                        {SPECIAL_LABEL[order.special]}
                        {order.special === 'cancelled' && order.cancelled_by
                            ? (order.cancelled_by === 'unpaid' ? ': not paid in time' : ` by ${order.cancelled_by === 'you' ? 'customer' : 'store'}`)
                            : ''}
                    </span>
                    <span className="adm-timeline__time">{order.special === 'delayed' && order.new_eta ? `New ETA: ${order.new_eta}` : formatDateTime(order.updated_at)}</span>
                </li>
            )}
        </ol>
    );
}

export default function OrderDrawer({ order, onClose, updateOrder }) {
    const toast = useToast();
    const { rowById } = useCatalog();
    const [busy, setBusy] = useState('');
    const [details, setDetails] = useState(() => ({
        courier_name: order.courier_name ?? '',
        courier_phone: order.courier_phone ?? '',
        handover_code: order.handover_code ?? '',
        pickup_code: order.pickup_code ?? '',
        admin_note: order.admin_note ?? '',
    }));
    const [eta, setEta] = useState(order.new_eta ?? '');
    const [showDelay, setShowDelay] = useState(false);

    const next = nextStep(order);
    const group = orderGroup(order);
    const closed = CLOSED_SPECIALS.has(order.special);
    const isPickup = order.type === 'pickup';
    const online = isOnlinePay(order);
    const paid = order.payment_status === 'paid';
    // The database refuses to move an unpaid FIB / card order past "placed" (not_paid).
    const waitingForPayment = online && !paid && !order.special;

    const run = async (key, patch, message) => {
        setBusy(key);
        try {
            await updateOrder(order.id, patch);
            toast(message);
            return true;
        } catch (err) {
            toast(err.message, 'error');
            return false;
        } finally {
            setBusy('');
        }
    };

    const advance = () => {
        if (!next) return;
        const patch = { status: next };
        const final = next === 'delivered' || next === 'picked';
        let generated = null;
        if (next === 'out') {
            // Unsaved local code wins; generate only when neither the field nor the order has one.
            const local = details.handover_code.trim();
            if (local && !/^\d{4}$/.test(local)) {
                toast('The handover code must be 4 digits.', 'error');
                return;
            }
            if (local) {
                if (local !== (order.handover_code ?? '')) patch.handover_code = local;
            } else if (!order.handover_code) {
                patch.handover_code = newHandoverCode();
                generated = { handover_code: patch.handover_code };
            }
        }
        if (next === 'ready') {
            const local = details.pickup_code.trim();
            if (local) {
                if (local !== (order.pickup_code ?? '')) patch.pickup_code = local;
            } else if (!order.pickup_code) {
                patch.pickup_code = newPickupCode();
                generated = { pickup_code: patch.pickup_code };
            }
        }
        if (final && order.special === 'delayed') {
            patch.special = null;
            patch.new_eta = null;
        }
        run('advance', patch, `${order.id}: ${STATUS_LABEL[next]}`).then((ok) => {
            if (ok && generated) setDetails((d) => ({ ...d, ...generated }));
        });
    };

    const setDelayed = () => {
        const text = eta.trim();
        if (!text) {
            toast('Write the new delivery time first (e.g. "Tomorrow 2–5 PM").', 'error');
            return;
        }
        run('delayed', { special: 'delayed', new_eta: text }, `${order.id} marked delayed`).then((ok) => { if (ok) setShowDelay(false); });
    };

    const special = (value, message, confirmText) => {
        if (confirmText && !window.confirm(confirmText)) return;
        const patch = { special: value };
        if (value === 'cancelled') patch.cancelled_by = 'store';
        // A refund of money paid online is recorded on the order too (the only payment change an
        // admin may make; the money itself goes back from FIB's merchant portal).
        if (value === 'refunded' && online && paid) patch.payment_status = 'refunded';
        run(value, patch, message);
    };

    const clearSpecial = () => {
        if (!window.confirm(`Clear "${SPECIAL_LABEL[order.special]}" and reopen ${order.id}?`)) return;
        run('clear', { special: null, cancelled_by: null, new_eta: null }, `${order.id} reopened`);
    };

    const dirty = ['courier_name', 'courier_phone', 'handover_code', 'pickup_code', 'admin_note']
        .some((k) => (details[k] ?? '') !== (order[k] ?? ''));

    const saveDetails = () => {
        const code = details.handover_code.trim();
        if (code && !/^\d{4}$/.test(code)) {
            toast('The handover code must be 4 digits.', 'error');
            return;
        }
        const patch = {};
        ['courier_name', 'courier_phone', 'handover_code', 'pickup_code', 'admin_note'].forEach((k) => {
            const v = details[k].trim();
            if (v !== (order[k] ?? '')) patch[k] = v || null;
        });
        run('details', patch, 'Order details saved');
    };

    const phone = customerPhone(order);
    const email = customerEmail(order);
    const deleted = isDeletedAccount(order);
    const receiverDiffers = !deleted && order.receiver_name && (order.receiver_name !== order.app_customers?.name || order.receiver_phone !== order.app_customers?.phone);
    const address = order.address && typeof order.address === 'object' ? order.address : null;
    const items = order.app_order_items ?? [];
    // The app sends lat/lng only when the customer dropped a pin; otherwise show nothing.
    const coord = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
    const lat = address ? coord(address.lat) : null;
    const lng = address ? coord(address.lng) : null;
    const hasMap = lat !== null && lng !== null;

    return (
        <Drawer
            open
            wide
            onClose={onClose}
            title={order.id}
            subtitle={`${formatDateTime(order.created_at)} · ${isPickup ? 'Store pickup' : 'Delivery'} · ${formatIqd(order.total)}`}
            footer={
                <div className="adm-order-actions">
                    {next && waitingForPayment ? (
                        <span className="adm-muted">Waiting for the {order.pay === 'fib' ? 'FIB' : 'card'} payment. The order can be confirmed once it is paid.</span>
                    ) : next ? (
                        <button type="button" className="adm-btn adm-btn--primary" onClick={advance} disabled={Boolean(busy)}>
                            {busy === 'advance' ? <Spinner size={14} /> : isPickup ? <Store size={16} /> : <Truck size={16} />}
                            {NEXT_LABEL[next]}
                        </button>
                    ) : (
                        <span className="adm-muted">{closed ? 'This order is closed.' : 'This order is complete.'}</span>
                    )}
                    {!closed && order.special !== 'delayed' && group !== 'completed' && (
                        <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setShowDelay((v) => !v)}>
                            <Clock size={16} /> Delay
                        </button>
                    )}
                </div>
            }
        >
            <div className="adm-order-head">
                <Badge tone={GROUP_TONE[group]}>{STATUS_LABEL[order.status] ?? order.status}</Badge>
                {order.special && <Badge tone={order.special === 'delayed' ? 'warn' : 'danger'}>{SPECIAL_LABEL[order.special]}</Badge>}
                <Badge tone="neutral">{PAY_LABEL[order.pay] ?? titleCase(order.pay)}</Badge>
                {online && (
                    <Badge tone={paid ? 'ok' : order.payment_status === 'refunded' ? 'neutral' : 'warn'}
                        title={order.paid_at ? `Paid ${formatDateTime(order.paid_at)}` : order.pay_by ? `Time to pay ends ${formatDateTime(order.pay_by)}` : undefined}>
                        {paid ? 'Paid' : order.payment_status === 'refunded' ? 'Refunded' : 'Not paid yet'}
                    </Badge>
                )}
            </div>

            {showDelay && (
                <div className="adm-card adm-card--warn">
                    <Field label="New delivery time shown to the customer" hint='Free text, e.g. "Tomorrow 2–5 PM" or "Thursday".'>
                        <input className="adm-input" value={eta} onChange={(e) => setEta(e.target.value)} maxLength={80} autoFocus />
                    </Field>
                    <div className="adm-row">
                        <button type="button" className="adm-btn adm-btn--warn" onClick={setDelayed} disabled={Boolean(busy)}>
                            {busy === 'delayed' ? <Spinner size={14} /> : <Clock size={16} />} Mark delayed
                        </button>
                        <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setShowDelay(false)}>Cancel</button>
                    </div>
                </div>
            )}

            <section className="adm-section">
                <h3 className="adm-h3">Progress</h3>
                <Timeline order={order} />
            </section>

            <section className="adm-section adm-grid-2">
                <div className="adm-card">
                    <h3 className="adm-h3">Customer</h3>
                    {deleted ? (
                        <>
                            <p className="adm-strong"><UserX size={14} className="adm-inline-icon" /> Deleted account</p>
                            <p className="adm-muted adm-small">The customer deleted their account. The order is kept for the store's records without their name, phone or address.</p>
                        </>
                    ) : (
                        <p className="adm-strong">{customerName(order)}</p>
                    )}
                    {phone && (
                        <div className="adm-row adm-row--wrap">
                            <a className="adm-link" href={`tel:${phone}`}><Phone size={14} /> {phone}</a>
                            {waLink(phone) && <a className="adm-link" href={waLink(phone)} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>}
                        </div>
                    )}
                    {email && <a className="adm-link" href={`mailto:${email}`}><Mail size={14} /> {email}</a>}
                    {receiverDiffers && (
                        <div className="adm-sub-block">
                            <span className="adm-label-sm">Receiver</span>
                            <p>{order.receiver_name}</p>
                            {order.receiver_phone && <a className="adm-link" href={`tel:${order.receiver_phone}`}><Phone size={14} /> {order.receiver_phone}</a>}
                        </div>
                    )}
                    {order.note && (
                        <div className="adm-sub-block">
                            <span className="adm-label-sm">Customer note</span>
                            <p className="adm-quote">{order.note}</p>
                        </div>
                    )}
                </div>

                <div className="adm-card">
                    <h3 className="adm-h3">{isPickup ? 'Pickup' : 'Delivery'}</h3>
                    {isPickup ? (
                        <p><Store size={14} className="adm-inline-icon" /> Branch: <strong>{titleCase(order.branch || 'main store')}</strong></p>
                    ) : (
                        <>
                            <p><MapPin size={14} className="adm-inline-icon" /> <strong>{titleCase(order.city)}</strong>{address?.label ? ` · ${address.label}` : ''}</p>
                            {address && ['area', 'street', 'building', 'landmark'].some((k) => address[k]) && (
                                <dl className="adm-dl">
                                    {['area', 'street', 'building', 'landmark'].map((k) => (address[k] ? (
                                        <React.Fragment key={k}><dt>{titleCase(k)}</dt><dd>{address[k]}</dd></React.Fragment>
                                    ) : null))}
                                </dl>
                            )}
                            {hasMap && (
                                <a className="adm-link" href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer">
                                    <MapPin size={14} /> Open pin in Google Maps
                                </a>
                            )}
                        </>
                    )}
                    {slotText(order.slot) && (
                        <div className="adm-sub-block">
                            <span className="adm-label-sm">Time slot</span>
                            <p>{slotText(order.slot)}</p>
                        </div>
                    )}
                </div>
            </section>

            <section className="adm-section">
                <h3 className="adm-h3">Items</h3>
                <ul className="adm-items">
                    {items.map((item) => {
                        const product = rowById.get(item.product_id);
                        const opts = optionText(item.options);
                        const preorder = item.options?.preorder === true;
                        return (
                            <li key={item.id} className="adm-item">
                                <Thumb src={product?.image} size={44} />
                                <div className="adm-item__main">
                                    <span className="adm-strong">{item.name}</span>
                                    <span className="adm-muted adm-mono">{item.product_id}</span>
                                    {item.zoho_id && (
                                        <span className="adm-muted adm-small">
                                            Zoho item <span className="adm-mono">{item.zoho_id}</span> <CopyButton value={item.zoho_id} />
                                        </span>
                                    )}
                                    {(preorder || opts.length > 0) && (
                                        <span className="adm-chips">
                                            {preorder && (
                                                <Badge tone="warn" title="Ordered while out of stock, via the Pre-order button">
                                                    Pre-order{item.options.restock ? ` · restock ${formatDay(item.options.restock)}` : ''}
                                                </Badge>
                                            )}
                                            {opts.map((o) => <span key={o} className="adm-chip">{o}</span>)}
                                        </span>
                                    )}
                                </div>
                                <div className="adm-item__price">
                                    <span className="adm-muted">{item.qty} × {formatIqd(item.unit_price)}</span>
                                    <strong>{formatIqd(item.qty * item.unit_price)}</strong>
                                </div>
                            </li>
                        );
                    })}
                    {items.length === 0 && <li className="adm-muted">No items found for this order.</li>}
                </ul>
                <dl className="adm-totals">
                    <dt>Subtotal</dt><dd>{formatIqd(order.subtotal)}</dd>
                    {Number(order.discount) > 0 && (<><dt>Discount</dt><dd>−{formatIqd(order.discount)}</dd></>)}
                    <dt>{isPickup ? 'Store pickup' : 'Delivery fee'}</dt><dd>{formatIqd(order.delivery_fee)}</dd>
                    <dt className="adm-totals__total">Total</dt><dd className="adm-totals__total">{formatIqd(order.total)}</dd>
                </dl>
                <p className="adm-field__hint">Totals are the server's: it priced every item from the catalog when the order was placed.</p>
            </section>

            <section className="adm-section adm-card">
                <h3 className="adm-h3">Fulfilment details</h3>
                <div className="adm-form-grid">
                    {!isPickup && (
                        <>
                            <Field label="Courier name">
                                <input className="adm-input" value={details.courier_name} onChange={(e) => setDetails((d) => ({ ...d, courier_name: e.target.value }))} maxLength={80} />
                            </Field>
                            <Field label="Courier phone">
                                <input className="adm-input" inputMode="tel" value={details.courier_phone} onChange={(e) => setDetails((d) => ({ ...d, courier_phone: e.target.value }))} maxLength={20} placeholder="+9647…" />
                            </Field>
                            <Field label="Handover code" hint="4 digits. The customer gives it to the courier.">
                                <div className="adm-input-group">
                                    <input className="adm-input adm-mono" inputMode="numeric" value={details.handover_code} onChange={(e) => setDetails((d) => ({ ...d, handover_code: e.target.value.replace(/\D/g, '').slice(0, 4) }))} placeholder="0000" />
                                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setDetails((d) => ({ ...d, handover_code: newHandoverCode() }))}>
                                        <RefreshCw size={14} /> Generate
                                    </button>
                                </div>
                            </Field>
                        </>
                    )}
                    {isPickup && (
                        <Field label="Pickup code" hint="Shown in the app; the customer shows it at the counter.">
                            <div className="adm-input-group">
                                <input className="adm-input adm-mono" value={details.pickup_code} onChange={(e) => setDetails((d) => ({ ...d, pickup_code: e.target.value.slice(0, 12) }))} placeholder="P-0000" />
                                <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setDetails((d) => ({ ...d, pickup_code: newPickupCode() }))}>
                                    <RefreshCw size={14} /> Generate
                                </button>
                            </div>
                        </Field>
                    )}
                    <Field label="Admin note" hint="Internal. Customers never see it." className="adm-span-2">
                        <textarea className="adm-input" rows={2} value={details.admin_note} onChange={(e) => setDetails((d) => ({ ...d, admin_note: e.target.value }))} />
                    </Field>
                </div>
                <div className="adm-row">
                    <button type="button" className="adm-btn adm-btn--primary adm-btn--sm" disabled={!dirty || Boolean(busy)} onClick={saveDetails}>
                        {busy === 'details' ? <Spinner size={14} /> : <Check size={14} />} Save details
                    </button>
                    {dirty && <span className="adm-muted">Unsaved changes</span>}
                </div>
            </section>

            <section className="adm-section">
                <h3 className="adm-h3">Problems</h3>
                <div className="adm-row adm-row--wrap">
                    {order.special && (
                        <button type="button" className="adm-btn adm-btn--ghost" disabled={Boolean(busy)} onClick={clearSpecial}>
                            <Undo2 size={16} /> {order.special === 'delayed' ? 'Clear delay' : 'Reopen order'}
                        </button>
                    )}
                    {!closed && !isPickup && group !== 'completed' && (
                        <button type="button" className="adm-btn adm-btn--ghost" disabled={Boolean(busy)}
                            onClick={() => special('failed', `${order.id} marked failed`, `Mark ${order.id} as a failed delivery?`)}>
                            <XCircle size={16} /> Delivery failed
                        </button>
                    )}
                    {!closed && group !== 'completed' && (
                        <button type="button" className="adm-btn adm-btn--danger" disabled={Boolean(busy)}
                            onClick={() => special('cancelled', `${order.id} cancelled`, online && paid
                                ? `Cancel ${order.id}? The customer already paid ${formatIqd(order.total)} by ${PAY_LABEL[order.pay]}: refund it from FIB's merchant portal, then press Mark refunded.`
                                : `Cancel ${order.id}? The customer sees "Cancelled by store".`)}>
                            <Ban size={16} /> Cancel order
                        </button>
                    )}
                    {order.special !== 'refunded' && (group === 'cancelled' || group === 'completed') && (!online || paid) && (
                        <button type="button" className="adm-btn adm-btn--ghost" disabled={Boolean(busy)}
                            onClick={() => special('refunded', `${order.id} marked refunded`, online
                                ? `Mark ${order.id} as refunded? Do this only after the ${formatIqd(order.total)} has been sent back from FIB's merchant portal.`
                                : `Mark ${order.id} as refunded?`)}>
                            <RotateCcw size={16} /> Mark refunded
                        </button>
                    )}
                </div>
            </section>
        </Drawer>
    );
}
