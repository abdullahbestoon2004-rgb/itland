import { useLocale } from '../context/LocaleContext';
import { useCurrency } from '../context/CurrencyContext';
import Price from './Price';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Minus, Plus, Trash2, X } from 'lucide-react';
import { isOutOfStock, orderMessage, stockLimit, whatsappLink } from '../utils/storefront';
import './CartDrawer.css';
export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem
}) {
  const {
    t
  } = useLocale();
  const {
    snapshot
  } = useCurrency();
  const [details, setDetails] = useState({
    name: '',
    city: '',
    notes: ''
  });
  const dialog = useRef(null);
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const invalidItems = cartItems.some(item => isOutOfStock(item) || item.quantity > stockLimit(item) || item.price <= 0);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const elements = [...dialog.current.querySelectorAll('a[href], button:not(:disabled), input, textarea')];
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  const changeDetail = event => setDetails(previous => ({
    ...previous,
    [event.target.name]: event.target.value
  }));
  return <>
        <div className="cart-overlay" onClick={onClose} />
        <div className="cart-drawer open" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="cart-title" tabIndex={-1}>
            <div className="cart-header">
                <h2 id="cart-title">{t("Your Cart")}</h2>
                <button className="close-btn" onClick={onClose} aria-label={t("Close cart")}><X size={24} /></button>
            </div>
            <div className="cart-content">
                {cartItems.length === 0 ? <div className="empty-cart">
                    <p>{t("Your cart is empty.")}</p>
                    <button className="btn btn-primary" onClick={onClose}>{t("Continue Shopping")}</button>
                </div> : <>
                    <div className="cart-items">{cartItems.map(item => <div key={item.id} className="cart-item">
                        <div className="cart-item-image"><img src={item.images?.[0] || item.image} alt={item.name} /></div>
                        <div className="cart-item-details">
                            <h4>{item.name}</h4><p className="cart-item-price"><Price usd={item.price} /></p>
                            <div className="cart-item-actions">
                                <div className="quantity-controls">
                                    <button aria-label={`Decrease quantity of ${item.name}`} onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}><Minus size={16} /></button>
                                    <span aria-live="polite">{item.quantity}</span>
                                    <button aria-label={`Increase quantity of ${item.name}`} onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= stockLimit(item)}><Plus size={16} /></button>
                                </div>
                                <button className="remove-btn" aria-label={`Remove ${item.name}`} onClick={() => onRemoveItem(item.id)}><Trash2 size={18} /></button>
                            </div>
                        </div>
                    </div>)}</div>
                    <div className="order-details">
                        <h3>{t("Delivery details")}<span>{t("(optional)")}</span></h3>
                        <p>{t("These details will be included in your WhatsApp message.")}</p>
                        <label>{t("Your name")}<input name="name" autoComplete="name" maxLength={80} value={details.name} onChange={changeDetail} /></label>
                        <label>{t("City / area")}<input name="city" autoComplete="address-level2" maxLength={120} placeholder="e.g. Erbil, Ankawa" value={details.city} onChange={changeDetail} /></label>
                        <label>{t("Notes")}<textarea name="notes" maxLength={500} rows={2} value={details.notes} onChange={changeDetail} /></label>
                    </div>
                </>}
            </div>
            {cartItems.length > 0 && <div className="cart-footer">
                <div className="cart-summary"><span>{t("Product subtotal")}</span><span className="cart-total"><Price usd={total} /></span></div>
                <p className="order-note">{t("Delivery across all Iraq and Kurdistan. Delivery fee and arrival time confirmed in the chat.")}</p>
                <p className="order-note">{t("This is an order request. Our team will confirm stock, payment method and final total on WhatsApp.")}</p>
                {invalidItems ? <p role="alert">Please remove unavailable items or reduce quantities before ordering.</p> : <a className="btn btn-primary checkout-btn" href={whatsappLink(orderMessage(cartItems, details, snapshot))} target="_blank" rel="noreferrer"><MessageCircle size={20} />{t("Send order on WhatsApp")}</a>}
                <Link className="help-inline-link" to="/help/delivery" onClick={onClose}>{t("Delivery & ordering information")}</Link>
            </div>}
        </div>
    </>;
}
