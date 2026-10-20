import { createContext, useContext } from 'react';
export const CurrencyContext = createContext({ snapshot: null, loading: true });
export const useCurrency = () => useContext(CurrencyContext);
