import LocaleProvider from './LocaleProvider';
import CurrencyProvider from './CurrencyProvider';
import { isOutOfStock, stockLimit } from '../utils/storefront';
import { getCartSnapshot, getServerCartSnapshot, subscribeToCart, updateCart } from '../data/cart';
import React, { useCallback, useState, useSyncExternalStore } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import CartDrawer from './CartDrawer';
import Footer from './Footer';
export default function StoreLayout() {
  const cartItems = useSyncExternalStore(subscribeToCart, getCartSnapshot, getServerCartSnapshot);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const handleAddToCart = product => {
    if (isOutOfStock(product) || !Number.isFinite(product.price) || product.price <= 0) return;
    updateCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? {
          ...item,
          quantity: Math.min(item.quantity + 1, stockLimit(product))
        } : item);
      }
      // Only what the cart and the WhatsApp message need is saved.
      return [...prev, {
        id: String(product.id),
        name: product.name,
        price: product.price,
        images: product.images?.length ? product.images.slice(0, 1) : product.image ? [product.image] : [],
        in_stock: product.in_stock ?? null,
        stock_on_hand: product.stock_on_hand ?? null,
        quantity: 1
      }];
    });
    setIsCartOpen(true);
  };
  const handleUpdateQuantity = (id, newQuantity) => {
    updateCart(prev => prev.map(item => item.id === id ? {
      ...item,
      quantity: Math.max(1, Math.min(Number(newQuantity) || 1, stockLimit(item)))
    } : item));
  };
  const handleRemoveItem = id => {
    updateCart(prev => prev.filter(item => item.id !== id));
  };
  // Stable, so the open drawer doesn't re-run its focus handling (and move
  // keyboard focus) every time a quantity changes.
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const handleSearchClick = () => {
    if (location.pathname !== '/products') {
      navigate('/products', {
        state: {
          focusSearch: true
        }
      });
      return;
    }
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.focus();
      searchInput.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  };
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  return <LocaleProvider><CurrencyProvider><div className="app-container">
            <Navbar cartCount={cartItemCount} onCartClick={() => setIsCartOpen(true)} onSearchClick={handleSearchClick} />

            <main className="main-content">
                <Outlet context={{
            handleAddToCart
          }} />
            </main>

            <Footer />

            <CartDrawer isOpen={isCartOpen} onClose={closeCart} cartItems={cartItems} onUpdateQuantity={handleUpdateQuantity} onRemoveItem={handleRemoveItem} />
        </div></CurrencyProvider></LocaleProvider>;
}
