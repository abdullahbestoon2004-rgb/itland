import React, { useCallback, useMemo, useState } from 'react';
import { WholesaleContext } from '../context/WholesaleContext';

const STORAGE_KEY = 'wholesale_session';

// Wholesale prices are not in the public catalog: they are fetched once at
// sign-in with the signed session token and kept for this browser tab.
const readSession = () => {
    try {
        const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
        // Older sessions have no token; those clients simply sign in again.
        return stored?.client && stored.token && stored.prices && stored.expiresAt > Date.now() ? stored : null;
    } catch {
        return null;
    }
};

export default function WholesaleProvider({ children }) {
    const [session, setSession] = useState(readSession);

    const login = useCallback(async (email, password) => {
        const res = await fetch('/api/wholesale-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.error || 'Login failed');
        }

        const pricesRes = await fetch('/api/products?view=wholesale', {
            headers: { Authorization: `Bearer ${data.token}` },
        });
        const pricesData = await pricesRes.json().catch(() => ({}));
        if (!pricesRes.ok || !Array.isArray(pricesData.products)) {
            throw new Error('Wholesale prices are unavailable right now. Please try again shortly.');
        }

        const prices = Object.fromEntries(pricesData.products
            .filter((product) => Number(product.wholesale_price) > 0)
            .map((product) => [String(product.id), Number(product.wholesale_price)]));
        const next = { client: data.client, token: data.token, expiresAt: data.expiresAt, prices };

        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch { /* Still signed in for this page view. */ }
        setSession(next);
    }, []);

    const logout = useCallback(() => {
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch { /* Nothing stored. */ }
        setSession(null);
    }, []);

    /** The client's wholesale price for a product, or null when none is set. */
    const wholesalePriceOf = useCallback((product) => session?.prices?.[String(product?.id)] ?? null, [session]);

    const value = useMemo(
        () => ({ wholesaleClient: session?.client ?? null, isLoading: false, login, logout, wholesalePriceOf }),
        [session, login, logout, wholesalePriceOf],
    );

    return <WholesaleContext.Provider value={value}>{children}</WholesaleContext.Provider>;
}
