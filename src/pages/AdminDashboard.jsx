import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, MonitorPlay, RefreshCw } from 'lucide-react';
import { getAllProducts } from '../data/products';
import { saveSettings } from '../data/settings';
import useStoreSettings from '../hooks/useStoreSettings';
import './AdminDashboard.css';

export default function AdminDashboard() {
    const [products, setProducts] = useState([]);
    const [productsError, setProductsError] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');
    const [activeTab, setActiveTab] = useState('products');
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [settingsSaveError, setSettingsSaveError] = useState('');
    const [settingsSuccessMessage, setSettingsSuccessMessage] = useState('');

    const navigate = useNavigate();
    const { settings, setSettings, settingsError: settingsLoadError, isLoadingSettings } = useStoreSettings();

    useEffect(() => {
        let ignore = false;
        getAllProducts().then((data) => {
            if (!ignore) setProducts(data);
        }).catch(() => {
            if (!ignore) setProductsError('Unable to load products from Zoho Books.');
        });
        return () => { ignore = true; };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('logi_admin_auth');
        navigate('/admin/login');
    };

    const handleRefreshFromZoho = async () => {
        setIsSyncing(true);
        setSyncMessage('');
        try {
            const data = await getAllProducts();
            setProducts(data);
            setSyncMessage(`Loaded ${data.length} products from Zoho Books.`);
            setProductsError('');
        } catch (err) {
            setSyncMessage(`Error: ${err.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handlePromoImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setSettings((prev) => ({ ...prev, promoBannerImage: reader.result }));
        };
        reader.readAsDataURL(file);
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
                        className={`dashboard-tab ${activeTab === 'wholesale' ? 'active' : ''}`}
                        onClick={() => setActiveTab('wholesale')}
                    >
                        Wholesale Clients
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

                {activeTab === 'wholesale' && (
                    <div className="wholesale-admin-section">
                        <h2 className="dashboard-subtitle">Wholesale Clients</h2>
                        <div style={{ background: 'rgba(0,184,252,0.06)', border: '1px solid rgba(0,184,252,0.2)', borderRadius: '8px', padding: '1.5rem', lineHeight: 1.7 }}>
                            <p style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', fontWeight: 600 }}>
                                How to add or remove wholesale clients:
                            </p>
                            <ol style={{ color: 'var(--text-secondary)', paddingLeft: '1.25rem', margin: 0 }}>
                                <li>Go to your <strong style={{ color: 'var(--text-primary)' }}>Vercel project → Settings → Environment Variables</strong></li>
                                <li>Find (or create) the variable named <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3 }}>WHOLESALE_CLIENTS</code></li>
                                <li>Set its value to a JSON array like this:
                                    <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '6px', marginTop: '0.5rem', fontSize: '0.8rem', overflowX: 'auto', color: '#a3e635' }}>{`[
  {"email":"client@company.com","password":"theirpassword","name":"John Smith","company":"Acme Corp"},
  {"email":"other@biz.com","password":"anotherpass","name":"Jane Doe","company":"Biz LLC"}
]`}</pre>
                                </li>
                                <li>Redeploy the project — clients can then log in at <strong style={{ color: 'var(--text-primary)' }}>/wholesale/login</strong></li>
                            </ol>
                        </div>
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
                                                            onChange={(e) => {
                                                                const file = e.target.files[0];
                                                                if (!file) return;
                                                                const reader = new FileReader();
                                                                reader.onloadend = () => handleCategoryImageChange(index, reader.result);
                                                                reader.readAsDataURL(file);
                                                            }}
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
