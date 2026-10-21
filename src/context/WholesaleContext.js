import { createContext, useContext } from 'react';

export const WholesaleContext = createContext(null);

export function useWholesale() {
    const ctx = useContext(WholesaleContext);
    if (!ctx) throw new Error('useWholesale must be used inside WholesaleProvider');
    return ctx;
}
