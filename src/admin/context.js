import { createContext, useContext } from 'react';

export const OrdersContext = createContext(null);
export const CatalogContext = createContext(null);
export const ToastContext = createContext(null);

const need = (ctx, name) => {
    if (!ctx) throw new Error(`${name} must be used inside the admin providers`);
    return ctx;
};

export const useOrders = () => need(useContext(OrdersContext), 'useOrders');
export const useCatalog = () => need(useContext(CatalogContext), 'useCatalog');
export const useToast = () => need(useContext(ToastContext), 'useToast');
