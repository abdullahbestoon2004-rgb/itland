import React from 'react';
import { MessageCircle, Minus, Plus, Trash2, X } from 'lucide-react';
import './CartDrawer.css';

export default function CartDrawer({ isOpen, onClose, cartItems, onUpdateQuantity, onRemoveItem }) {
    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const handleWhatsAppCheckout = () => {
        const phoneNumber = '+9647502045634';

        let message = `*Hello! I would like to place an order from your store:*\n\n`;
        cartItems.forEach((item) => {
            message += `- ${item.name} (x${item.quantity}) - $${(item.price * item.quantity).toFixed(2)}\n`;
        });
        message += `\n*Total: $${total.toFixed(2)}*\n\nPlease let me know how to proceed with the payment.`;

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${phoneNumber.replace('+', '')}?text=${encodedMessage}`;

        window.open(whatsappUrl, '_blank');
    };

    return (
        <>
            {isOpen && <div className="cart-overlay" onClick={onClose} />}
            <div className={`cart-drawer ${isOpen ? 'open' : ''}`}>
                <div className="cart-header">
                    <h2>Your Cart</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="cart-content">
                    {cartItems.length === 0 ? (
                        <div className="empty-cart">
                            <p>Your cart is empty.</p>
                            <button className="btn btn-primary" onClick={onClose}>Continue Shopping</button>
                        </div>
                    ) : (
                        <div className="cart-items">
                            {cartItems.map((item) => (
                                <div key={item.id} className="cart-item">
                                    <div className="cart-item-image">
                                        <img src={item.images && item.images.length > 0 ? item.images[0] : item.image} alt={item.name} />
                                    </div>
                                    <div className="cart-item-details">
                                        <h4>{item.name}</h4>
                                        <p className="cart-item-price">${item.price.toFixed(2)}</p>
                                        <div className="cart-item-actions">
                                            <div className="quantity-controls">
                                                <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}>
                                                    <Minus size={16} />
                                                </button>
                                                <span>{item.quantity}</span>
                                                <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}>
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                            <button className="remove-btn" onClick={() => onRemoveItem(item.id)}>
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {cartItems.length > 0 && (
                    <div className="cart-footer">
                        <div className="cart-summary">
                            <span>Subtotal</span>
                            <span className="cart-total">${total.toFixed(2)}</span>
                        </div>
                        <button className="btn btn-primary checkout-btn" onClick={handleWhatsAppCheckout}>
                            <MessageCircle size={20} />
                            Checkout via WhatsApp
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
