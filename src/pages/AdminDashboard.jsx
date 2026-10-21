import usePageMeta from '../hooks/usePageMeta';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, LogOut, MonitorPlay, RefreshCw, Trash2 } from 'lucide-react';
import { getAdminProducts } from '../data/products';
import { saveSettings } from '../data/settings';
import { supabase } from '../lib/supabase';
import { imageFileToDataUrl } from '../utils/image';
import { getContactMessages, setMessageHandled } from '../data/messages';
import { deleteReview, getAllReviews, setReviewApproval } from '../data/reviews';
import { useAuth } from '../context/AuthContext';
import useStoreSettings from '../hooks/useStoreSettings';
import './AdminDashboard.css';

// The current access token, so a refresh after an hour-long session still works.
const loadAdminProducts = async ({ refresh = false } = {}) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data } = await supabase.auth.getSession();
    return getAdminProducts({ accessToken: data.session?.access_token, refresh });
};

export default function AdminDashboard() {
    usePageMeta({ title: 'AdminDashboard', noindex: true });
    const [products, setProducts] = useState([]);
    const [productsError, setProductsError] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');
    const [activeTab, setActiveTab] = useState('products');
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [settingsSaveError, setSettingsSaveError] = useState('');
    const [settingsSuccessMessage, setSettingsSuccessMessage] = useState('');

    const [messages, setMessages] = useState([]);
    const [messagesError, setMessagesError] = useState('');
    const [reviews, setReviews] = useState([]);
    const [reviewsError, setReviewsError] = useState('');

    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const { settings, setSettings, settingsError: settingsLoadError, isLoadingSettings } = useStoreSettings();

    useEffect(() => {
        let ignore = false;
        loadAdminProducts().then(({ products: data, stale }) => {
            if (ignore) return;
            setProducts(data);
            if (stale) setProductsError('Zoho Books is not responding. Showing the last product list loaded from Zoho.');
        }).catch((err) => {
            if (!ignore) setProductsError(`Unable to load products from Zoho Books: ${err.message}`);
        });
        return () => { ignore = true; };
    }, []);

    useEffect(() => {
        let ignore = false;

        getContactMessages()
            .then((data) => { if (!ignore) setMessages(data); })
            .catch(() => { if (!ignore) setMessagesError('Unable to load messages.'); });

        getAllReviews()
            .then((data) => { if (!ignore) setReviews(data); })
            .catch(() => { if (!ignore) setReviewsError('Unable to load reviews.'); });

        return () => { ignore = true; };
    }, []);

    const handleToggleHandled = async (message) => {
        const next = !message.handled;
        setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, handled: next } : m)));

        try {
            await setMessageHandled(message.id, next);
        } catch {
            setMessagesError('Could not update that message.');
            setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, handled: !next } : m)));
        }
    };

    const handleToggleApproval = async (review) => {
        const next = !review.approved;
        setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, approved: next } : r)));

        try {
            await setReviewApproval(review.id, next);
        } catch {
            setReviewsError('Could not update that review.');
            setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, approved: !next } : r)));
        }
    };

    const handleDeleteReview = async (review) => {
        const previous = reviews;
        setReviews((prev) => prev.filter((r) => r.id !== review.id));

        try {
            await deleteReview(review.id);
        } catch {
            setReviewsError('Could not delete that review.');
            setReviews(previous);
        }
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/admin/login');
    };

    const handleRefreshFromZoho = async () => {
        setIsSyncing(true);
        setSyncMessage('');
        try {
            const { products: data, stale, refreshed } = await loadAdminProducts({ refresh: true });
            setProducts(data);
            setProductsError('');
            if (refreshed) {
                setSyncMessage(`Loaded ${data.length} products from Zoho Books.`);
            } else if (stale) {
                setSyncMessage('Error: Zoho Books is not responding. Showing the last product list loaded from Zoho.');
            } else {
                setSyncMessage('Zoho can be refreshed once every 30 seconds. Showing the latest loaded list — try again shortly.');
            }
        } catch (err) {
            setSyncMessage(`Error: ${err.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handlePromoImageUpload = async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        setSettingsSaveError('');
        try {
            const image = await imageFileToDataUrl(file, { maxWidth: 1920 });
            setSettings((prev) => ({ ...prev, promoBannerImage: image }));
        } catch (error) {
            setSettingsSaveError(error.message);
        }
    };

    const handleCategoryImageUpload = async (index, e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        setSettingsSaveError('');
        try {
            handleCategoryImageChange(index, await imageFileToDataUrl(file, { maxWidth: 900 }));
        } catch (error) {
            setSettingsSaveError(error.message);
        }
    };

    const handleCategoryImageChange = (index, image) => {
        setSettings((prev) => {
            const next = [...prev.featuredCategories];
            next[index] = { ...next[index], image };
            return { ...prev, featuredCategories: next };
        });
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setIsSavingSettings(true);
        setSettingsSaveError('');
        setSettingsSuccessMessage('');
        try {
            const saved = await saveSettings(settings);
            setSettings(saved);
            setSettingsSuccessMessage('Settings saved.');
        } catch {
            setSettingsSaveError('Unable to save settings.');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const syncIsSuccess = syncMessage && !syncMessage.startsWith('Error');

    return (
        <div className="admin-dashboard">
            <header className="dashboard-header glass">
                <div className="header-brand">
                    <MonitorPlay className="logo-icon" size={24} />
                    <span className="logo-text">ADMIN<span className="logo-accent">PANEL</span></span>
                </div>
                <div className="header-actions">
                    {user?.email && <span className="admin-identity">{user.email}</span>}
                    <Link to="/" className="view-store-link">View Storefront</Link>
                    <button className="btn btn-secondary logout-btn" onClick={handleLogout}>
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </header>

            <main className="dashboard-content">
                <div className="dashboard-topbar">
                    <h1 className="dashboard-title">Dashboard</h1>
                    <button
                        className="btn btn-secondary"
                        onClick={handleRefreshFromZoho}
                        disabled={isSyncing}
                        title="Reload products from Zoho Books"
                    >
                        <RefreshCw size={16} style={{ marginRight: '6px' }} className={isSyncing ? 'spin' : ''} />
                        {isSyncing ? 'Loading...' : 'Refresh from Zoho'}
                    </button>
                </div>

                {syncMessage && (
                    <div className="empty-state" style={{ marginBottom: '1rem', color: syncIsSuccess ? '#4ade80' : '#f87171' }}>
                        {syncMessage}
                    </div>
                )}

                <div className="dashboard-tabs">
                    <button
                        className={`dashboard-tab ${activeTab === 'products' ? 'active' : ''}`}
                        onClick={() => setActiveTab('products')}
                    >
                        Products
                    </button>
                    <button
                        className={`dashboard-tab ${activeTab === 'messages' ? 'active' : ''}`}
                        onClick={() => setActiveTab('messages')}
                    >
                        Messages{messages.some((m) => !m.handled) ? ` (${messages.filter((m) => !m.handled).length})` : ''}
                    </button>
                    <button
                        className={`dashboard-tab ${activeTab === 'reviews' ? 'active' : ''}`}
                        onClick={() => setActiveTab('reviews')}
                    >
                        Reviews{reviews.some((r) => !r.approved) ? ` (${reviews.filter((r) => !r.approved).length})` : ''}
                    </button>
                    <button
                        className={`dashboard-tab ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        Site Settings
                    </button>
                </div>

                {activeTab === 'products' && (
                    <>
                        {productsError && (
                            <div className="empty-state" style={{ marginBottom: '1rem' }}>{productsError}</div>
                        )}
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                            Products are pulled directly from Zoho Books. To edit name, price, or description — update them in Zoho Books, then click <strong>Refresh from Zoho</strong>.
                        </p>
                        <div className="products-table-container">
                            <table className="products-table">
                                <thead>
                                    <tr>
                                        <th>Image</th>
                                        <th>Name</th>
                                        <th>Category</th>
                                        <th>Price</th>
                                        <th>Wholesale Price</th>
                                        <th>Featured</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map((product) => (
                                        <tr key={product.id}>
                                            <td>
                                                <div className="table-img-container">
                                                    <img src={product.images[0]} alt={product.name} />
                                                </div>
                                            </td>
                                            <td className="font-bold">{product.name}</td>
                                            <td><span className="category-badge">{product.category}</span></td>
                                            <td className="font-mono">${product.price.toFixed(2)}</td>
                                            <td className="font-mono" style={{ color: product.wholesale_price != null ? '#4ade80' : 'var(--text-secondary)' }}>
                                                {product.wholesale_price != null ? `$${product.wholesale_price.toFixed(2)}` : '—'}
                                            </td>
                                            <td>{product.featured ? <span className="featured-badge">Yes</span> : '—'}</td>
                                        </tr>
                                    ))}
                                    {products.length === 0 && !productsError && (
                                        <tr>
                                            <td colSpan="6" className="empty-state">
                                                No products loaded. Click "Refresh from Zoho" to load your Zoho Books items.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {activeTab === 'messages' && (
                    <div className="dashboard-panel">
                        <h2 className="dashboard-subtitle">Contact Messages</h2>
                        {messagesError && <div className="empty-state" style={{ marginBottom: '1rem' }}>{messagesError}</div>}

                        {messages.length === 0 ? (
                            <div className="empty-state">No messages yet.</div>
                        ) : (
                            <div className="message-list">
                                {messages.map((message) => (
                                    <article key={message.id} className={`message-card ${message.handled ? 'handled' : ''}`}>
                                        <header className="message-head">
                                            <div>
                                                <strong className="message-name">{message.name}</strong>
                                                <a href={`mailto:${message.email}`} className="message-email">{message.email}</a>
                                            </div>
                                            <time className="message-date" dateTime={message.created_at}>
                                                {new Date(message.created_at).toLocaleString()}
                                            </time>
                                        </header>
                                        <p className="message-body">{message.message}</p>
                                        <button
                                            type="button"
                                            className="btn btn-secondary message-action"
                                            onClick={() => handleToggleHandled(message)}
                                        >
                                            <Check size={14} /> {message.handled ? 'Mark as new' : 'Mark as handled'}
                                        </button>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'reviews' && (
                    <div className="dashboard-panel">
                        <h2 className="dashboard-subtitle">Customer Reviews</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                            Reviews are hidden from the storefront until you approve them.
                        </p>
                        {reviewsError && <div className="empty-state" style={{ marginBottom: '1rem' }}>{reviewsError}</div>}

                        {reviews.length === 0 ? (
                            <div className="empty-state">No reviews submitted yet.</div>
                        ) : (
                            <div className="message-list">
                                {reviews.map((review) => (
                                    <article key={review.id} className={`message-card ${review.approved ? 'handled' : ''}`}>
                                        <header className="message-head">
                                            <div>
                                                <strong className="message-name">{review.name}</strong>
                                                <span className="message-email">{'★'.repeat(review.rating)}</span>
                                            </div>
                                            <time className="message-date" dateTime={review.created_at}>
                                                {new Date(review.created_at).toLocaleString()}
                                            </time>
                                        </header>
                                        <p className="message-body">{review.text}</p>
                                        <div className="review-actions">
                                            <button
                                                type="button"
                                                className="btn btn-secondary message-action"
                                                onClick={() => handleToggleApproval(review)}
                                            >
                                                <Check size={14} /> {review.approved ? 'Unpublish' : 'Approve'}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-secondary message-action danger"
                                                onClick={() => handleDeleteReview(review)}
                                            >
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="dashboard-settings-section">
                        <h2 className="dashboard-subtitle">Site Settings</h2>
                        <form onSubmit={handleSaveSettings} className="settings-form">
                            {isLoadingSettings && <div className="empty-state" style={{ marginBottom: '1rem' }}>Loading settings...</div>}
                            {settingsLoadError && <div className="empty-state" style={{ marginBottom: '1rem' }}>{settingsLoadError}</div>}
                            {settingsSaveError && <div className="empty-state" style={{ marginBottom: '1rem' }}>{settingsSaveError}</div>}
                            {settingsSuccessMessage && !settingsSaveError && (
                                <div className="empty-state" style={{ marginBottom: '1rem', color: 'var(--logi-cyan)' }}>{settingsSuccessMessage}</div>
                            )}

                            <div className="form-group flex-row align-center">
                                <label className="checkbox-label" style={{ marginBottom: 0 }}>
                                    <input
                                        type="checkbox"
                                        checked={settings.promoBannerVisible}
                                        onChange={(e) => setSettings((prev) => ({ ...prev, promoBannerVisible: e.target.checked }))}
                                    />
                                    Show Promo Banner
                                </label>
                            </div>

                            <div className="form-group">
                                <label>Promo Banner Title</label>
                                <input
                                    type="text"
                                    value={settings.promoBannerTitle}
                                    onChange={(e) => setSettings((prev) => ({ ...prev, promoBannerTitle: e.target.value }))}
                                    placeholder="Enter banner title..."
                                />
                            </div>

                            <div className="form-group">
                                <label>Promo Banner Subtitle</label>
                                <input
                                    type="text"
                                    value={settings.promoBannerSubtitle}
                                    onChange={(e) => setSettings((prev) => ({ ...prev, promoBannerSubtitle: e.target.value }))}
                                    placeholder="Enter banner subtitle..."
                                />
                            </div>

                            <div className="form-group">
                                <label>Promo Banner Background Image</label>
                                <input
                                    type="text"
                                    value={settings.promoBannerImage}
                                    onChange={(e) => setSettings((prev) => ({ ...prev, promoBannerImage: e.target.value }))}
                                    placeholder="Image URL..."
                                />
                                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>OR</span>
                                    <label className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '6px 12px', cursor: 'pointer', margin: 0 }}>
                                        Upload Image...
                                        <input type="file" accept="image/*" onChange={handlePromoImageUpload} style={{ display: 'none' }} />
                                    </label>
                                </div>
                            </div>

                            {settings.featuredCategories && (
                                <div className="form-group" style={{ marginTop: '1rem' }}>
                                    <label style={{ fontSize: '1.2rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--logi-border)', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'block' }}>
                                        Featured Categories
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                                        {settings.featuredCategories.map((cat, index) => (
                                            <div key={index} style={{ backgroundColor: 'var(--logi-darker)', padding: '1rem', borderRadius: '4px', border: '1px solid var(--logi-border)' }}>
                                                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--logi-cyan)' }}>{cat.name}</h4>
                                                <div style={{ width: '100%', height: '120px', backgroundColor: '#111', borderRadius: '4px', marginBottom: '1rem', overflow: 'hidden' }}>
                                                    {cat.image
                                                        ? <img src={cat.image} alt={cat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '0.9rem' }}>No Image</div>
                                                    }
                                                </div>
                                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>Image URL</label>
                                                <input
                                                    type="text"
                                                    value={cat.image}
                                                    onChange={(e) => handleCategoryImageChange(index, e.target.value)}
                                                    placeholder="Enter image URL..."
                                                    style={{ width: '100%', padding: '8px', backgroundColor: 'var(--logi-surface)', border: '1px solid var(--logi-border)', color: 'white', borderRadius: '4px' }}
                                                />
                                                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>OR</span>
                                                    <label className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 8px', cursor: 'pointer', margin: 0 }}>
                                                        Upload...
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(e) => handleCategoryImageUpload(index, e)}
                                                            style={{ display: 'none' }}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{ alignSelf: 'flex-start' }}
                                disabled={isSavingSettings}
                            >
                                {isSavingSettings ? 'Saving...' : 'Save Settings'}
                            </button>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
}
