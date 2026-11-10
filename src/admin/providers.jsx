import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CatalogContext, InboxContext, OrdersContext, ToastContext, useToast } from './context';
import { getContactMessages, setMessageHandled } from '../data/messages';
import { deleteReview, getAllReviews, setReviewApproval } from '../data/reviews';
import {
    ORDER_SELECT, PLAIN_SORT_BASE, buildCatalog, completedAt, describeError, fetchAll, loadZohoCatalog, orderGroup, plainId,
    playChime, pricingFrom, readPref, sleep, startOfToday, unlockSound, writePref,
} from './lib';

const notConfigured = { missing: false, message: 'Supabase is not configured for this site (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).' };

// ── Toasts ─────────────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const seq = useRef(0);

    const push = useCallback((message, tone = 'ok') => {
        seq.current += 1;
        const id = seq.current;
        setToasts((list) => [...list.slice(-3), { id, message, tone }]);
        setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 6500 : 3500);
    }, []);

    return (
        <ToastContext.Provider value={push}>
            {children}
            <div className="adm-toasts" role="status" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`adm-toast adm-toast--${t.tone}`}>{t.message}</div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

// ── Orders (with realtime) ─────────────────────────────────────────────────────
const PAGE_SIZE = 150;

const mergeOrders = (prev, rows) => {
    const map = new Map(prev.map((o) => [o.id, o]));
    rows.forEach((row) => map.set(row.id, row));
    return [...map.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
};

async function fetchOrderById(id) {
    const { data, error } = await supabase.from('app_orders').select(ORDER_SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
}

const isNewPlaced = (row) => row?.status === 'placed' && !row.special;

const oldestCreated = (rows) => rows.reduce((min, r) => (min === null || String(r.created_at) < min ? String(r.created_at) : min), null);

const channelTopic = () => {
    const rand = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    return `adm-app-orders-${rand}`;
};

export function OrdersProvider({ children }) {
    const toast = useToast();
    const [orders, setOrders] = useState([]);
    const [status, setStatus] = useState(supabase ? 'loading' : 'error');
    const [error, setError] = useState(supabase ? null : notConfigured);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [live, setLive] = useState('connecting');
    const [unseen, setUnseen] = useState(() => new Set());
    const [soundOn, setSoundOnState] = useState(() => readPref('sound', true));
    const soundRef = useRef(soundOn);
    const [now, setNow] = useState(() => Date.now());

    // Pagination cursor: the oldest created_at among pages fetched by reload/loadOlder only.
    // Rows merged in from search, realtime or updates never move it.
    const cursorRef = useRef(null);
    const olderLoadedRef = useRef(false);
    const loadingOlderRef = useRef(false);
    // Every order id this dashboard has seen, and the ones it already announced.
    const knownRef = useRef(new Set());
    const announcedRef = useRef(new Set());
    const loadedOnceRef = useRef(false);

    const absorb = useCallback((rows) => {
        if (!rows.length) return;
        rows.forEach((r) => knownRef.current.add(r.id));
        setOrders((prev) => mergeOrders(prev, rows));
    }, []);

    /** Unseen dot + chime + toast for a new order (realtime INSERT or found by polling). */
    const announce = useCallback((row) => {
        if (!row?.id || announcedRef.current.has(row.id)) return;
        announcedRef.current.add(row.id);
        setUnseen((set) => new Set(set).add(row.id));
        if (soundRef.current) playChime();
        toast(`New order ${row.id} · ${row.app_customers?.name ?? row.receiver_name ?? ''}`, 'info');
    }, [toast]);

    const reload = useCallback(async () => {
        if (!supabase) return;
        const { data, error: err } = await supabase
            .from('app_orders')
            .select(ORDER_SELECT)
            .order('created_at', { ascending: false })
            .limit(PAGE_SIZE);
        if (err) {
            setError(describeError(err));
            setStatus('error');
            return;
        }
        const rows = data ?? [];
        // After the first load, any placed order we have never seen is new (covers polling
        // while realtime is down, and manual refreshes).
        if (loadedOnceRef.current) {
            rows.filter((r) => !knownRef.current.has(r.id) && isNewPlaced(r)).forEach(announce);
        }
        absorb(rows);
        const oldest = oldestCreated(rows);
        if (oldest && (cursorRef.current === null || oldest < cursorRef.current)) cursorRef.current = oldest;
        // Once older pages were loaded, hasMore belongs to loadOlder.
        if (!olderLoadedRef.current) setHasMore(rows.length === PAGE_SIZE);
        loadedOnceRef.current = true;
        setError(null);
        setStatus('ready');
    }, [absorb, announce]);

    const loadOlder = useCallback(async () => {
        const cursor = cursorRef.current;
        if (!supabase || !cursor || loadingOlderRef.current) return;
        loadingOlderRef.current = true;
        setLoadingMore(true);
        const { data, error: err } = await supabase
            .from('app_orders')
            .select(ORDER_SELECT)
            .lt('created_at', cursor)
            .order('created_at', { ascending: false })
            .limit(PAGE_SIZE);
        loadingOlderRef.current = false;
        setLoadingMore(false);
        if (err) {
            toast(describeError(err).message, 'error');
            return;
        }
        const rows = data ?? [];
        absorb(rows);
        const oldest = oldestCreated(rows);
        if (oldest && oldest < cursorRef.current) cursorRef.current = oldest;
        olderLoadedRef.current = true;
        setHasMore(rows.length === PAGE_SIZE);
    }, [absorb, toast]);

    /**
     * Searches the whole table (not just loaded rows) by order id, phone, receiver name or the
     * account's email. Returns how many orders it found, or null when the search failed.
     */
    const searchRemote = useCallback(async (query) => {
        const raw = String(query ?? '').trim();
        const q = raw.replace(/[^\p{L}\p{N}+\- ]/gu, '').trim();
        const emailTerm = raw.replace(/[^A-Za-z0-9@._+-]/g, '');
        // Order ids and phone numbers are not looked up as emails.
        const byEmail = emailTerm.length >= 3 && /[a-z]/i.test(emailTerm) && !/^itl-?\d*$/i.test(emailTerm);
        if (!supabase || (q.length < 3 && !byEmail)) return 0;
        const failed = (err) => {
            toast(`Order search failed: ${describeError(err).message}`, 'error');
            return null;
        };
        const filters = [];
        if (q.length >= 3) {
            const digits = q.replace(/\D/g, '');
            const idTerm = q.replace(/[^A-Za-z0-9-]/g, '');
            filters.push(`receiver_name.ilike."*${q}*"`);
            if (idTerm) filters.push(`id.ilike.*${idTerm}*`);
            if (digits.length >= 3) filters.push(`receiver_phone.ilike.*${digits}*`);
        }
        // The email is on the customer's profile, not on the order: find those customers first.
        if (byEmail) {
            const { data: people, error: peopleErr } = await supabase
                .from('app_customers')
                .select('id')
                .ilike('email', `%${emailTerm}%`)
                .limit(50);
            if (peopleErr) return failed(peopleErr);
            const ids = (people ?? []).map((c) => c.id).filter(Boolean);
            if (ids.length) filters.push(`customer_id.in.(${ids.join(',')})`);
        }
        if (!filters.length) return 0;
        const { data, error: err } = await supabase
            .from('app_orders')
            .select(ORDER_SELECT)
            .or(filters.join(','))
            .order('created_at', { ascending: false })
            .limit(50);
        if (err) return failed(err);
        absorb(data ?? []);
        return (data ?? []).length;
    }, [absorb, toast]);

    const updateOrder = useCallback(async (id, patch) => {
        const { data, error: err } = await supabase
            .from('app_orders')
            .update(patch)
            .eq('id', id)
            .select(ORDER_SELECT)
            .single();
        if (err) throw new Error(describeError(err).message);
        absorb([data]);
        return data;
    }, [absorb]);

    const markSeen = useCallback((id) => {
        setUnseen((set) => {
            if (!set.has(id)) return set;
            const next = new Set(set);
            next.delete(id);
            return next;
        });
    }, []);
    const clearUnseen = useCallback(() => setUnseen(new Set()), []);

    const setSoundOn = useCallback((on) => {
        soundRef.current = on;
        setSoundOnState(on);
        writePref('sound', on);
        if (on) {
            unlockSound();
            playChime();
        }
    }, []);

    useEffect(() => {
        let ignore = false;
        if (supabase) {
            Promise.resolve().then(() => {
                if (!ignore) reload();
            });
        }
        const tick = setInterval(() => setNow(Date.now()), 30_000);
        return () => {
            ignore = true;
            clearInterval(tick);
        };
    }, [reload]);

    // Realtime: every insert/update of app_orders refetches that order with its items.
    // Each mount gets its own topic, and callbacks from a removed channel are ignored, so a
    // StrictMode double mount never leaves two subscriptions or flips the status to offline.
    useEffect(() => {
        if (!supabase) return undefined;
        let active = true;
        const channel = supabase
            .channel(channelTopic())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_orders' }, (payload) => {
                const id = payload.new?.id ?? payload.old?.id;
                if (!id || !active) return;
                fetchOrderById(id).then((row) => {
                    if (!row || !active) return;
                    const unknown = !knownRef.current.has(id);
                    absorb([row]);
                    if (payload.eventType === 'INSERT' || (unknown && loadedOnceRef.current && isNewPlaced(row))) announce(row);
                }).catch(() => {});
            })
            .subscribe((state) => {
                if (!active) return;
                if (state === 'SUBSCRIBED') setLive('live');
                else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') setLive('offline');
            });
        return () => {
            active = false;
            supabase.removeChannel(channel).catch(() => {});
        };
    }, [absorb, announce]);

    // When realtime is down, poll so new orders still show up (reload announces new ones).
    useEffect(() => {
        if (live === 'live' || !supabase) return undefined;
        const id = setInterval(() => { reload(); }, 45_000);
        return () => clearInterval(id);
    }, [live, reload]);

    const stats = useMemo(() => {
        const today = startOfToday(now);
        let newToday = 0;
        let active = 0;
        let fresh = 0;
        let completedToday = 0;
        let revenueToday = 0;
        for (const o of orders) {
            const group = orderGroup(o);
            if (group === 'new') fresh += 1;
            if (group === 'new' || group === 'active') active += 1;
            if (Date.parse(o.created_at) >= today) newToday += 1;
            // Completed today = delivered or picked up today (whenever it was placed).
            // Cancelled, failed and refunded orders are in the 'cancelled' group, so they are excluded.
            const done = Date.parse(completedAt(o));
            if (group === 'completed' && Number.isFinite(done) && done >= today) {
                completedToday += 1;
                revenueToday += Number(o.total) || 0;
            }
        }
        return { newToday, active, fresh, completedToday, revenueToday };
    }, [orders, now]);

    const value = useMemo(() => ({
        orders, status, error, hasMore, loadingMore, live, unseen, soundOn, now, stats,
        reload, loadOlder, searchRemote, updateOrder, markSeen, clearUnseen, setSoundOn,
    }), [orders, status, error, hasMore, loadingMore, live, unseen, soundOn, now, stats,
        reload, loadOlder, searchRemote, updateOrder, markSeen, clearUnseen, setSoundOn]);

    return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

// ── Catalog: Zoho items, overlay rows, app settings, catalog sync ──────────────
const ZOHO_COLUMNS = 'zoho_id, raw_name, name, brand, brand_id, category, sub, usd_price, stock, image_url, zoho_featured, zoho_order, kind, active, changed_at';

const loadingState = supabase ? { status: 'loading', error: null } : { status: 'error', error: notConfigured };

/** Keeps the rows on a failed reload (they are still the last good copy) and reports the error. */
const failedState = (prev, error) => (prev.status === 'ready' ? { status: 'ready', error } : { status: 'error', error });

export function CatalogProvider({ children }) {
    const toast = useToast();
    const [products, setProducts] = useState([]);
    const [productsState, setProductsState] = useState(loadingState);
    const [zohoItems, setZohoItems] = useState([]);
    const [zohoState, setZohoState] = useState(loadingState);
    const [settings, setSettings] = useState(supabase ? { row: null, status: 'loading', error: null } : { row: null, status: 'error', error: notConfigured });
    const [website, setWebsite] = useState({ items: [], status: 'idle', error: null, stale: false });
    const [sync, setSync] = useState({ running: false, step: '', last: null });
    const syncingRef = useRef(false);
    const [now, setNow] = useState(() => Date.now());

    const reloadProducts = useCallback(async () => {
        if (!supabase) return;
        try {
            const rows = await fetchAll(() => supabase.from('app_products').select('*', { count: 'exact' }).order('id'));
            setProducts(rows);
            setProductsState({ status: 'ready', error: null });
        } catch (error) {
            setProductsState((prev) => failedState(prev, describeError(error)));
        }
    }, []);

    const reloadZoho = useCallback(async () => {
        if (!supabase) return;
        try {
            const rows = await fetchAll(() => supabase.from('app_zoho_items').select(ZOHO_COLUMNS, { count: 'exact' }).order('zoho_id'));
            setZohoItems(rows);
            setZohoState({ status: 'ready', error: null });
        } catch (error) {
            setZohoState((prev) => failedState(prev, describeError(error)));
        }
    }, []);

    const reloadSettings = useCallback(async () => {
        if (!supabase) return;
        const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
        if (error) {
            setSettings((prev) => (prev.status === 'ready' ? { ...prev, error: describeError(error) } : { row: null, status: 'error', error: describeError(error) }));
            return;
        }
        setSettings({ row: data, status: 'ready', error: null });
    }, []);

    /** The website's Zoho view (wholesale prices). Loaded only when someone opens it. */
    const loadWebsite = useCallback(async ({ refresh = false } = {}) => {
        if (!supabase) {
            setWebsite({ items: [], status: 'error', error: notConfigured.message, stale: false });
            return null;
        }
        setWebsite((prev) => ({ ...prev, status: prev.items.length ? 'ready' : 'loading', error: null }));
        try {
            const result = await loadZohoCatalog({ refresh });
            setWebsite({ items: result.products, status: 'ready', error: null, stale: result.stale });
            return result;
        } catch (err) {
            setWebsite((prev) => ({ ...prev, status: prev.items.length ? 'ready' : 'error', error: err.message }));
            return null;
        }
    }, []);

    useEffect(() => {
        let ignore = false;
        Promise.resolve().then(() => {
            if (ignore) return;
            reloadProducts();
            reloadZoho();
            reloadSettings();
        });
        const tick = setInterval(() => setNow(Date.now()), 60_000);
        return () => {
            ignore = true;
            clearInterval(tick);
        };
    }, [reloadProducts, reloadZoho, reloadSettings]);

    const keepProduct = useCallback((row) => {
        setProducts((list) => [...list.filter((p) => p.id !== row.id), row]);
    }, []);

    const saveProduct = useCallback(async (existingId, values) => {
        const query = existingId
            ? supabase.from('app_products').update(values).eq('id', existingId)
            : supabase.from('app_products').insert(values);
        const { data, error } = await query.select('*').single();
        if (error) {
            const failure = new Error(error.code === '23505' && !existingId
                ? 'Someone else just changed this product. The list was reloaded: open it again and repeat your change.'
                : describeError(error).message);
            if (error.code === '23505') reloadProducts();
            throw failure;
        }
        keepProduct(data);
        return data;
    }, [keepProduct, reloadProducts]);

    const deleteProduct = useCallback(async (id) => {
        const { error } = await supabase.from('app_products').delete().eq('id', id);
        if (error) throw new Error(describeError(error).message);
        setProducts((list) => list.filter((p) => p.id !== id));
    }, []);

    /**
     * app_banners.product_id references app_products(id): a plain Zoho item first gets its light
     * overlay row ('z-' + zoho_id, nothing else set, so with 20261108210000 applied the app shows it
     * exactly as before). Returns the id.
     */
    const ensureOverlay = useCallback(async (row) => {
        if (!row) return null;
        if (row.p) return row.p.id;
        if (!row.z) return null;
        const zid = String(row.z.zoho_id);
        const values = { id: plainId(zid), zoho_id: zid, sort: PLAIN_SORT_BASE + (Number(row.z.zoho_order) || 0) };
        const { data, error } = await supabase.from('app_products').insert(values).select('*').single();
        if (!error) {
            keepProduct(data);
            return data.id;
        }
        if (error.code === '23505') {
            // Created meanwhile (another tab or admin): use whichever row now holds this Zoho item.
            const { data: existing } = await supabase.from('app_products').select('*').eq('zoho_id', zid).maybeSingle();
            if (existing) {
                keepProduct(existing);
                return existing.id;
            }
        }
        throw new Error(describeError(error).message);
    }, [keepProduct]);

    const saveSettings = useCallback(async (patch) => {
        const { data, error } = await supabase
            .from('app_settings')
            .upsert({ id: 1, ...patch }, { onConflict: 'id' })
            .select('*')
            .single();
        if (error) throw new Error(describeError(error).message);
        setSettings({ row: data, status: 'ready', error: null });
        return data;
    }, []);

    /**
     * "Sync now": app_sync_now() sends fresh requests to Zoho (via the website) and the rate feeds;
     * their answers arrive asynchronously, so app_sync_status() is asked after about 5 s and 20 s
     * (each call applies whatever has arrived), then the list is reloaded.
     */
    const syncNow = useCallback(async () => {
        if (!supabase || syncingRef.current) return;
        syncingRef.current = true;
        setSync({ running: true, step: 'Sending the sync…', last: null });
        const done = [];
        const errors = [];
        let last = null;
        try {
            // app_sync_now first applies the answers to the previous run (the 10-minute job or an
            // earlier Sync now), then sends new requests.
            const { data: first, error } = await supabase.rpc('app_sync_now');
            if (error) throw error;
            if (Array.isArray(first?.done)) done.push(...first.done);
            if (Array.isArray(first?.errors)) errors.push(...first.errors);
            let waited = 0;
            for (const at of [5_000, 20_000]) {
                setSync((s) => ({ ...s, step: at === 5_000 ? 'Waiting for Zoho and the rate…' : 'Still waiting for answers…' }));
                await sleep(at - waited);
                waited = at;
                const { data, error: statusError } = await supabase.rpc('app_sync_status');
                if (statusError) throw statusError;
                last = data ?? null;
                if (Array.isArray(data?.done)) done.push(...data.done);
                if (Array.isArray(data?.errors)) errors.push(...data.errors);
                setSync((s) => ({ ...s, step: 'Refreshing the list…', last }));
                await Promise.all([reloadSettings(), reloadZoho(), reloadProducts()]);
            }
            if (errors.length) toast(`Sync problem: ${[...new Set(errors)].join('; ')}`, 'error');
            else if (done.length) toast(`Sync done (${[...new Set(done)].join(', ')}).`);
            else if (Number(last?.pending) > 0) toast('Zoho has not answered yet. The next automatic sync (every 10 minutes) picks it up.', 'info');
            else toast('Sync done. Nothing new arrived.', 'info');
        } catch (err) {
            toast(describeError(err).message, 'error');
        } finally {
            syncingRef.current = false;
            setSync({ running: false, step: '', last });
        }
    }, [reloadProducts, reloadSettings, reloadZoho, toast]);

    const pricing = useMemo(() => pricingFrom(settings.row, now), [settings.row, now]);
    const catalog = useMemo(
        () => buildCatalog({ products, zohoItems, settings: settings.row, pricing, now }),
        [products, zohoItems, settings.row, pricing, now],
    );

    const value = useMemo(() => ({
        products, productsState, zohoItems, zohoState, settings, pricing, now, website, sync,
        rows: catalog.rows, rowById: catalog.rowById, zohoById: catalog.zohoById, linked: catalog.linked,
        reloadProducts, reloadZoho, reloadSettings, loadWebsite, saveProduct, deleteProduct, ensureOverlay, saveSettings, syncNow,
    }), [products, productsState, zohoItems, zohoState, settings, pricing, now, website, sync, catalog,
        reloadProducts, reloadZoho, reloadSettings, loadWebsite, saveProduct, deleteProduct, ensureOverlay, saveSettings, syncNow]);

    return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

// ── Website inbox: contact messages and reviews (same data as the old dashboard) ──
export function InboxProvider({ children }) {
    const [messages, setMessages] = useState([]);
    const [messagesState, setMessagesState] = useState({ status: 'loading', error: '' });
    const [reviews, setReviews] = useState([]);
    const [reviewsState, setReviewsState] = useState({ status: 'loading', error: '' });

    const loadMessages = useCallback(async () => {
        try {
            setMessages(await getContactMessages());
            setMessagesState({ status: 'ready', error: '' });
        } catch {
            setMessagesState({ status: 'error', error: 'Unable to load messages.' });
        }
    }, []);

    const loadReviews = useCallback(async () => {
        try {
            setReviews(await getAllReviews());
            setReviewsState({ status: 'ready', error: '' });
        } catch {
            setReviewsState({ status: 'error', error: 'Unable to load reviews.' });
        }
    }, []);

    useEffect(() => {
        let ignore = false;
        Promise.resolve().then(() => {
            if (ignore) return;
            loadMessages();
            loadReviews();
        });
        return () => { ignore = true; };
    }, [loadMessages, loadReviews]);

    const toggleHandled = useCallback(async (message) => {
        const next = !message.handled;
        setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, handled: next } : m)));
        try {
            await setMessageHandled(message.id, next);
        } catch {
            setMessagesState((s) => ({ ...s, error: 'Could not update that message.' }));
            setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, handled: !next } : m)));
        }
    }, []);

    const toggleApproval = useCallback(async (review) => {
        const next = !review.approved;
        setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, approved: next } : r)));
        try {
            await setReviewApproval(review.id, next);
        } catch {
            setReviewsState((s) => ({ ...s, error: 'Could not update that review.' }));
            setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, approved: !next } : r)));
        }
    }, []);

    const removeReview = useCallback(async (review) => {
        let previous = null;
        setReviews((prev) => {
            previous = prev;
            return prev.filter((r) => r.id !== review.id);
        });
        try {
            await deleteReview(review.id);
        } catch {
            setReviewsState((s) => ({ ...s, error: 'Could not delete that review.' }));
            if (previous) setReviews(previous);
        }
    }, []);

    const value = useMemo(() => ({
        messages, messagesState, reviews, reviewsState,
        unhandled: messages.filter((m) => !m.handled).length,
        pendingReviews: reviews.filter((r) => !r.approved).length,
        loadMessages, loadReviews, toggleHandled, toggleApproval, removeReview,
    }), [messages, messagesState, reviews, reviewsState, loadMessages, loadReviews, toggleHandled, toggleApproval, removeReview]);

    return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}
