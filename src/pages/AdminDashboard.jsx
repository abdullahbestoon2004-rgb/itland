import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, LogOut, MonitorPlay, GripVertical } from 'lucide-react';
import { deleteProduct, getAllProducts, saveProduct, saveProductOrder } from '../data/products';
import { getSettings, saveSettings } from '../data/settings';
import './AdminDashboard.css';

const createEmptyProduct = () => ({
    name: '',
    category: 'Mice',
    brand: 'Logitech',
    price: 0,
    description: '',
    images: [],
    featured: false,
});

export default function AdminDashboard() {
    const [products, setProducts] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [currentProduct, setCurrentProduct] = useState(createEmptyProduct);
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const [settings, setSettings] = useState(() => getSettings());
    const [productsError, setProductsError] = useState('');
    const [isSavingProduct, setIsSavingProduct] = useState(false);
    const navigate = useNavigate();

    const dragItem = React.useRef(null);
    const dragOverItem = React.useRef(null);
    const [draggableRowIndex, setDraggableRowIndex] = useState(null);

    useEffect(() => {
        let ignore = false;

        const loadProducts = async () => {
            try {
                const nextProducts = await getAllProducts();

                if (!ignore) {
                    setProducts(nextProducts);
                    setProductsError('');
                }
            } catch (error) {
                console.error(error);

                if (!ignore) {
                    setProductsError('Unable to load products right now.');
                }
            }
        };

        loadProducts();

        return () => {
            ignore = true;
        };
    }, []);

    const handleSort = async () => {
        if (dragItem.current !== null && dragOverItem.current !== null) {
            let _products = [...products];
            const draggedItemContent = _products.splice(dragItem.current, 1)[0];
            _products.splice(dragOverItem.current, 0, draggedItemContent);
            dragItem.current = null;
            dragOverItem.current = null;
            setProducts(_products);

            try {
                await saveProductOrder(_products);
                setProductsError('');
            } catch (error) {
                console.error(error);
                setProductsError('Unable to save the new product order.');
            }
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('logi_admin_auth');
        navigate('/admin/login');
    };

    const handleCreateNew = () => {
        setIsEditing(true);
        setIsCustomCategory(false);
        setCurrentProduct(createEmptyProduct());
    };

    const handleEdit = (product) => {
        setIsEditing(true);
        setIsCustomCategory(false);
        setCurrentProduct(product);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this product?')) {
            const previousProducts = products;
            const updated = products.filter(p => p.id !== id);
            setProducts(updated);

            try {
                await deleteProduct(id);
                await saveProductOrder(updated);
                setProductsError('');
            } catch (error) {
                console.error(error);
                setProducts(previousProducts);
                setProductsError('Unable to delete this product.');
            }
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCurrentProduct({
                    ...currentProduct,
                    images: [...(currentProduct.images || []), reader.result]
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddImageUrl = () => {
        const url = prompt("Enter Image URL:");
        if (url) {
            setCurrentProduct({
                ...currentProduct,
                images: [...(currentProduct.images || []), url]
            });
        }
    };

    const handleRemoveImage = (indexToRemove) => {
        setCurrentProduct({
            ...currentProduct,
            images: currentProduct.images.filter((_, index) => index !== indexToRemove)
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSavingProduct(true);

        try {
            const productToSave = { ...currentProduct, price: parseFloat(currentProduct.price) };
            const savedProduct = await saveProduct(productToSave);
            const hasExistingProduct = products.some((product) => product.id === savedProduct.id);
            const updatedProducts = hasExistingProduct
                ? products.map((product) => product.id === savedProduct.id ? savedProduct : product)
                : [...products, { ...savedProduct, order_index: products.length }];

            setProducts(updatedProducts);
            await saveProductOrder(updatedProducts);
            setProductsError('');
            setIsEditing(false);
            setCurrentProduct(createEmptyProduct());
        } catch (error) {
            console.error(error);
            setProductsError('Unable to save this product.');
        } finally {
            setIsSavingProduct(false);
        }
    };

    const handlePromoImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSettings({ ...settings, promoBannerImage: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveSettings = (e) => {
        e.preventDefault();
        saveSettings(settings);
        alert('Settings saved successfully!');
    };

    return (
        <div className="admin-dashboard">
            <header className="dashboard-header glass">
                <div className="header-brand">
                    <MonitorPlay className="logo-icon" size={24} />
                    <span className="logo-text">ADMIN<span className="logo-accent">PANEL</span></span>
                </div>
                <div className="header-actions">
                    <a href="/" className="view-store-link" target="_blank" rel="noopener noreferrer">View Storefront</a>
                    <button className="btn btn-secondary logout-btn" onClick={handleLogout}>
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </header>

            <main className="dashboard-content">
                <div className="dashboard-topbar">
                    <h1 className="dashboard-title">Product Management</h1>
                    <button className="btn btn-primary" onClick={handleCreateNew}>
                        <Plus size={18} style={{ marginRight: '8px' }} /> Add Product
                    </button>
                </div>

                {productsError && (
                    <div className="empty-state" style={{ marginBottom: '1rem' }}>
                        {productsError}
                    </div>
                )}

                <div className="products-table-container">
                    <table className="products-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}></th>
                                <th>Image</th>
                                <th>Name</th>
                                <th>Category</th>
                                <th>Brand</th>
                                <th>Price</th>
                                <th>Featured</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((product, index) => (
                                <tr
                                    key={product.id}
                                    draggable={draggableRowIndex === index}
                                    onDragStart={() => (dragItem.current = index)}
                                    onDragEnter={() => (dragOverItem.current = index)}
                                    onDragEnd={() => {
                                        handleSort();
                                        setDraggableRowIndex(null);
                                    }}
                                    onDragOver={(e) => e.preventDefault()}
                                    className="draggable-row"
                                >
                                    <td
                                        className="drag-handle-cell"
                                        onMouseEnter={() => setDraggableRowIndex(index)}
                                        onMouseLeave={() => setDraggableRowIndex(null)}
                                        onMouseDown={() => setDraggableRowIndex(index)}
                                    >
                                        <GripVertical size={18} className="drag-handle-icon" />
                                    </td>
                                    <td>
                                        <div className="table-img-container">
                                            {product.images && product.images.length > 0 ? (
                                                <img src={product.images[0]} alt={product.name} />
                                            ) : (
                                                <span style={{ color: '#666' }}>No img</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="font-bold">{product.name}</td>
                                    <td><span className="category-badge">{product.category}</span></td>
                                    <td>{product.brand}</td>
                                    <td className="font-mono">${product.price.toFixed(2)}</td>
                                    <td>{product.featured ? <span className="featured-badge">Yes</span> : '-'}</td>
                                    <td className="td-actions">
                                        <button className="action-icon edit" onClick={() => handleEdit(product)} title="Edit">
                                            <Edit2 size={18} />
                                        </button>
                                        <button className="action-icon delete" onClick={() => handleDelete(product.id)} title="Delete">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {products.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="empty-state">No products found. Add one to get started.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="dashboard-settings-section">
                    <h2 className="dashboard-subtitle">Site Settings</h2>
                    <form onSubmit={handleSaveSettings} className="settings-form">
                        <div className="form-group flex-row align-center">
                            <label className="checkbox-label" style={{ marginBottom: 0 }}>
                                <input
                                    type="checkbox"
                                    checked={settings.promoBannerVisible}
                                    onChange={e => setSettings({ ...settings, promoBannerVisible: e.target.checked })}
                                />
                                Show Promo Banner
                            </label>
                        </div>
                        <div className="form-group">
                            <label>Promo Banner Title</label>
                            <input
                                type="text"
                                value={settings.promoBannerTitle}
                                onChange={e => setSettings({ ...settings, promoBannerTitle: e.target.value })}
                                placeholder="Enter banner main title..."
                            />
                        </div>
                        <div className="form-group">
                            <label>Promo Banner Subtitle</label>
                            <input
                                type="text"
                                value={settings.promoBannerSubtitle}
                                onChange={e => setSettings({ ...settings, promoBannerSubtitle: e.target.value })}
                                placeholder="Enter banner subtitle text..."
                            />
                        </div>
                        <div className="form-group">
                            <label>Promo Banner Background Image URL or Upload</label>
                            <input
                                type="text"
                                value={settings.promoBannerImage}
                                onChange={e => setSettings({ ...settings, promoBannerImage: e.target.value })}
                                placeholder="Enter image URL..."
                            />
                            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>OR</span>
                                <div className="custom-file-upload">
                                    <label className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '6px 12px', cursor: 'pointer', margin: 0 }}>
                                        Upload Image...
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handlePromoImageUpload}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                </div>
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

                                            {/* Preview */}
                                            <div style={{ width: '100%', height: '120px', backgroundColor: '#111', borderRadius: '4px', marginBottom: '1rem', overflow: 'hidden' }}>
                                                {cat.image ? (
                                                    <img src={cat.image} alt={cat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '0.9rem' }}>No Image</div>
                                                )}
                                            </div>

                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>Image URL</label>
                                            <input
                                                type="text"
                                                value={cat.image}
                                                onChange={(e) => {
                                                    const newCategories = [...settings.featuredCategories];
                                                    newCategories[index].image = e.target.value;
                                                    setSettings({ ...settings, featuredCategories: newCategories });
                                                }}
                                                placeholder="Enter image URL..."
                                                style={{ width: '100%', padding: '8px', backgroundColor: 'var(--logi-surface)', border: '1px solid var(--logi-border)', color: 'white', borderRadius: '4px' }}
                                            />

                                            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>OR</span>
                                                <div className="custom-file-upload">
                                                    <label className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 8px', cursor: 'pointer', margin: 0 }}>
                                                        Upload Image...
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(e) => {
                                                                const file = e.target.files[0];
                                                                if (file) {
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => {
                                                                        const newCategories = [...settings.featuredCategories];
                                                                        newCategories[index].image = reader.result;
                                                                        setSettings({ ...settings, featuredCategories: newCategories });
                                                                    };
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }}
                                                            style={{ display: 'none' }}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Save Settings</button>
                    </form>
                </div>
            </main>

            {/* Edit/Create Modal */}
            {isEditing && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{currentProduct.name ? 'Edit Product' : 'Add New Product'}</h2>
                            <button className="close-modal" onClick={() => setIsEditing(false)}>×</button>
                        </div>
                        <form onSubmit={handleSave} className="product-form">
                            <div className="form-row">
                                <div className="form-group flex-2">
                                    <label>Product Name</label>
                                    <input
                                        type="text"
                                        value={currentProduct.name}
                                        onChange={e => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group flex-1">
                                    <label>Price</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={currentProduct.price}
                                        onChange={e => setCurrentProduct({ ...currentProduct, price: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group flex-1">
                                    <label>Category</label>
                                    <select
                                        value={isCustomCategory ? 'Custom' : currentProduct.category}
                                        onChange={e => {
                                            if (e.target.value === 'Custom') {
                                                setIsCustomCategory(true);
                                                setCurrentProduct({ ...currentProduct, category: '' });
                                            } else {
                                                setIsCustomCategory(false);
                                                setCurrentProduct({ ...currentProduct, category: e.target.value });
                                            }
                                        }}
                                        style={{ marginBottom: isCustomCategory ? '8px' : '0' }}
                                    >
                                        {Array.from(new Set(['Mice', 'Keyboards', 'Audio', 'Streaming', 'Accessories', ...products.map(p => p.category)])).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                        <option value="Custom">+ Add Custom Category...</option>
                                    </select>
                                    {isCustomCategory && (
                                        <input
                                            type="text"
                                            value={currentProduct.category}
                                            onChange={e => setCurrentProduct({ ...currentProduct, category: e.target.value })}
                                            placeholder="Enter new category name"
                                            required
                                        />
                                    )}
                                </div>
                                <div className="form-group flex-1">
                                    <label>Brand</label>
                                    <select
                                        value={currentProduct.brand}
                                        onChange={e => setCurrentProduct({ ...currentProduct, brand: e.target.value })}
                                    >
                                        <option value="Logitech">Logitech</option>
                                        <option value="Razer">Razer</option>
                                        <option value="Onten">Onten</option>
                                        <option value="Lention">Lention</option>
                                        <option value="Anker">Anker</option>
                                        <option value="Elgato">Elgato</option>

                                    </select>
                                </div>
                                <div className="form-group flex-1 flex-row">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={currentProduct.featured}
                                            onChange={e => setCurrentProduct({ ...currentProduct, featured: e.target.checked })}
                                        />
                                        Featured on Homepage
                                    </label>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    rows="3"
                                    value={currentProduct.description}
                                    onChange={e => setCurrentProduct({ ...currentProduct, description: e.target.value })}
                                    required
                                ></textarea>
                            </div>

                            <div className="form-group">
                                <label>Images ({currentProduct.images ? currentProduct.images.length : 0})</label>

                                <div className="images-preview-grid" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                    {currentProduct.images && currentProduct.images.map((imgUrl, idx) => (
                                        <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', backgroundColor: '#1a1a1a', borderRadius: '4px', border: '1px solid var(--logi-border)' }}>
                                            <img src={imgUrl} alt="prev" style={{ width: '100%', height: '100%', objectFit: 'cover', padding: '4px' }} />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveImage(idx)}
                                                style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: 'var(--logi-cyan)', color: 'black', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}
                                            >×</button>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                                        onClick={handleAddImageUrl}
                                    >
                                        + Add Image URL
                                    </button>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>OR</span>
                                    <div className="custom-file-upload">
                                        <label className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '6px 12px', cursor: 'pointer', margin: 0 }}>
                                            Upload File...
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                    </div>
                                </div>
                                {(!currentProduct.images || currentProduct.images.length === 0) && (
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#ff4757' }}>* At least one image is required.</div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={isSavingProduct || !currentProduct.images || currentProduct.images.length === 0}>
                                    {isSavingProduct ? 'Saving...' : 'Save Product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
