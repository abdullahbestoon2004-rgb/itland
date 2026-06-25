import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'wholesale_session';

const WholesaleContext = createContext(null);

export function WholesaleProvider({ children }) {
    const [wholesaleClient, setWholesaleClient] = useState(() => {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    const login = useCallback(async (email, password) => {
        const res = await fetch('/api/wholesale-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Login failed');
        }

        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data.client));
        setWholesaleClient(data.client);
    }, []);

    const logout = useCallback(() => {
        sessionStorage.removeItem(STORAGE_KEY);
        setWholesaleClient(null);
    }, []);

    return (
        <WholesaleContext.Provider value={{ wholesaleClient, isLoading: false, login, logout }}>
            {children}
        </WholesaleContext.Provider>
    );
}

export function useWholesale() {
    const ctx = useContext(WholesaleContext);
    if (!ctx) throw new Error('useWholesale must be used inside WholesaleProvider');
    return ctx;
}
