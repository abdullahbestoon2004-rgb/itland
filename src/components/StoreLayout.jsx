import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import CartDrawer from './CartDrawer';
import Footer from './Footer';

export default function StoreLayout() {
    const [cartItems, setCartItems] = useState([]);
    const [isCartOpen, setIsCartOpen] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    const handleAddToCart = (product) => {
        setCartItems((prev) => {
            const existing = prev.find((item) => item.id === product.id);
            if (existing) {
                return prev.map((item) =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
        setIsCartOpen(true);
    };

    const handleUpdateQuantity = (id, newQuantity) => {
        setCartItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, quantity: newQuantity } : item))
        );
    };

    const handleRemoveItem = (id) => {
        setCartItems((prev) => prev.filter((item) => item.id !== id));
    };

    const handleSearchClick = () => {
        if (location.pathname !== '/products') {
            navigate('/products', { state: { focusSearch: true } });
            return;
        }

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.focus();
            searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div className="app-container">
            <Navbar
                cartCount={cartItemCount}
                onCartClick={() => setIsCartOpen(true)}
                onSearchClick={handleSearchClick}
            />

            <main className="main-content">
                <Outlet context={{ handleAddToCart }} />
            </main>

            <Footer />

            <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                cartItems={cartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
            />
        </div>
    );
}
