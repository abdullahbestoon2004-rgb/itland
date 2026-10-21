// The cart is kept in localStorage so it survives reloads and stays in sync
// across tabs. Read through useSyncExternalStore: the server (and hydration)
// render an empty cart, then the saved one appears.

const CART_KEY = 'itland-cart';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const EMPTY_CART = [];

let snapshot = null;
const listeners = new Set();

const isValidItem = (item) => typeof item?.id === 'string' && typeof item.name === 'string' &&
    Number.isFinite(item.price) && item.price > 0 && Number.isInteger(item.quantity) && item.quantity > 0;

function readSavedCart() {
    try {
        const saved = JSON.parse(localStorage.getItem(CART_KEY));
        if (!Array.isArray(saved?.items) || !(Date.now() - saved.savedAt < MAX_AGE_MS)) return EMPTY_CART;
        return saved.items.filter(isValidItem);
    } catch {
        return EMPTY_CART;
    }
}

export function getCartSnapshot() {
    snapshot ??= readSavedCart();
    return snapshot;
}

export const getServerCartSnapshot = () => EMPTY_CART;

export function subscribeToCart(listener) {
    listeners.add(listener);
    const handleStorage = (event) => {
        if (event.key !== CART_KEY) return;
        snapshot = readSavedCart();
        listener();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', handleStorage);
    };
}

export function updateCart(update) {
    snapshot = update(getCartSnapshot());
    try {
        localStorage.setItem(CART_KEY, JSON.stringify({ items: snapshot, savedAt: Date.now() }));
    } catch { /* The cart still works for this page view. */ }
    listeners.forEach((listener) => listener());
}
