import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import ProductDetailsModal from '../components/ProductDetailsModal';
import { getAllProducts } from '../data/products';
import './AllProducts.css';



const categories = ['All', 'Mice', 'Keyboards', 'Headsets', 'Webcams', 'Gaming', 'Accessories', 'Audio', 'Streaming'];
const brands = ['Logitech', 'Razer', 'Onten', 'Lention', 'Anker', 'Elgato'];

export default function AllProducts() {
    const { handleAddToCart } = useOutletContext();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();

    const [products, setProducts] = useState([]);
    const [productsError, setProductsError] = useState('');
    const [selectedImageProduct, setSelectedImageProduct] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [activeBrands, setActiveBrands] = useState([]);
    const [sortBy, setSortBy] = useState('featured');
    const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });

    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const itemsPerPage = 9;
    const searchInputRef = useRef(null);

    const categoryFromParams = searchParams.get('category');
    const activeCategory = categoryFromParams && categories.includes(categoryFromParams)
        ? categoryFromParams
        : 'All';

    useEffect(() => {
        if (location.state?.focusSearch && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [location.state?.focusSearch]);

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

    useEffect(() => {
        document.body.style.overflow = mobileSidebarOpen ? 'hidden' : '';

        return () => {
            document.body.style.overflow = '';
        };
    }, [mobileSidebarOpen]);

    useEffect(() => {
        if (!mobileSidebarOpen) return undefined;

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setMobileSidebarOpen(false);
            }
        };

        window.addEventListener('keydown', handleEscape);

        return () => window.removeEventListener('keydown', handleEscape);
    }, [mobileSidebarOpen]);

    const handleCategoryChange = (category) => {
        const nextSearchParams = new URLSearchParams(searchParams);

        if (category === 'All') {
            nextSearchParams.delete('category');
        } else {
            nextSearchParams.set('category', category);
        }

        setSearchParams(nextSearchParams, { replace: true });
        setCurrentPage(1);

        if (window.innerWidth <= 1024) {
            setMobileSidebarOpen(false);
        }
    };

    const handleBrandToggle = (brand, isChecked) => {
        setActiveBrands((previous) => {
            if (isChecked) {
                return [...previous, brand];
            }

            return previous.filter((item) => item !== brand);
        });
        setCurrentPage(1);
    };

    const handlePriceChange = (field, value) => {
        setPriceRange((previous) => ({ ...previous, [field]: Number(value) }));
        setCurrentPage(1);
    };

    const handleResetFilters = () => {
        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.delete('category');

        setSearchParams(nextSearchParams, { replace: true });
        setSearchQuery('');
        setActiveBrands([]);
        setSortBy('featured');
        setPriceRange({ min: 0, max: 1000 });
        setCurrentPage(1);
    };

    const filteredProducts = products
        .filter((product) => {
            const matchesCategory = activeCategory === 'All' || product.category === activeCategory;
            const matchesBrand = activeBrands.length === 0 || activeBrands.includes(product.brand);
            const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesPrice = product.price >= (priceRange.min || 0) && product.price <= (priceRange.max || 10000);

            return matchesCategory && matchesBrand && matchesSearch && matchesPrice;
        })
        .sort((a, b) => {
            if (sortBy === 'price-low') return a.price - b.price;
            if (sortBy === 'price-high') return b.price - a.price;
            if (sortBy === 'newest') return b.id - a.id;

            return (b.featured === true ? 1 : 0) - (a.featured === true ? 1 : 0);
        });

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const paginatedProducts = filteredProducts.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

    const filtersChanged =
        searchQuery.length > 0 ||
        activeCategory !== 'All' ||
        activeBrands.length > 0 ||
        sortBy !== 'featured' ||
        priceRange.min !== 0 ||
        priceRange.max !== 1000;

    return (
        <div className="all-products-page">
            <header className="shop-header">
                <h1 className="shop-title">Shop Products</h1>
                <p className="shop-subtitle">Discover the latest computer accessories.</p>
                {productsError && <p className="shop-subtitle">{productsError}</p>}
            </header>

            <div className="shop-container">
                {mobileSidebarOpen && <div className="sidebar-overlay" onClick={() => setMobileSidebarOpen(false)} />}

                <aside className={`shop-sidebar ${mobileSidebarOpen ? 'active' : ''}`}>
                    <button className="close-sidebar-btn" onClick={() => setMobileSidebarOpen(false)}>
                        <X size={20} /> Close Filters
                    </button>

                    <div className="filter-section">
                        <h3 className="filter-title">Search</h3>
                        <input
                            ref={searchInputRef}
                            id="search-input"
                            type="text"
                            placeholder="Find products..."
                            className="shop-search-input"
                            value={searchQuery}
                            onChange={(event) => {
                                setSearchQuery(event.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>

                    <div className="filter-section">
                        <h3 className="filter-title">Category</h3>
                        <div className="filter-list">
                            {categories.map((category) => (
                                <label key={category} className="filter-label">
                                    <input
                                        type="radio"
                                        name="category"
                                        checked={activeCategory === category}
                                        onChange={() => handleCategoryChange(category)}
                                    />
                                    {category}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="filter-section">
                        <h3 className="filter-title">Brands</h3>
                        <div className="filter-list">
                            {brands.map((brand) => (
                                <label key={brand} className="filter-label">
                                    <input
                                        type="checkbox"
                                        checked={activeBrands.includes(brand)}
                                        onChange={(event) => handleBrandToggle(brand, event.target.checked)}
                                    />
                                    {brand}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="filter-section">
                        <h3 className="filter-title">Price Range</h3>
                        <div className="price-range-inputs">
                            <input
                                type="number"
                                className="price-input"
                                placeholder="Min"
                                value={priceRange.min}
                                onChange={(event) => handlePriceChange('min', event.target.value)}
                            />
                            <span className="price-separator">-</span>
                            <input
                                type="number"
                                className="price-input"
                                placeholder="Max"
                                value={priceRange.max}
                                onChange={(event) => handlePriceChange('max', event.target.value)}
                            />
                        </div>
                    </div>
                </aside>

                <main className="shop-main">
                    <div className="shop-controls">
                        <button className="mobile-filter-toggle" onClick={() => setMobileSidebarOpen(true)}>
                            <SlidersHorizontal size={18} /> Filters
                        </button>

                        <div className="shop-controls-right">
                            <span className="results-count">Showing {filteredProducts.length} results</span>

                            <div className="shop-controls-actions">
                                <div className="sort-control">
                                    <span className="sort-label">Sort by:</span>
                                    <select
                                        className="sort-select"
                                        value={sortBy}
                                        onChange={(event) => {
                                            setSortBy(event.target.value);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="featured">Featured</option>
                                        <option value="newest">Newest Arrivals</option>
                                        <option value="price-low">Price: Low to High</option>
                                        <option value="price-high">Price: High to Low</option>
                                    </select>
                                </div>

                                <button
                                    className="reset-filters-btn"
                                    type="button"
                                    onClick={handleResetFilters}
                                    disabled={!filtersChanged}
                                >
                                    Reset
                                </button>
                            </div>
                        </div>
                    </div>

                    {paginatedProducts.length > 0 ? (
                        <>
                            <div className="shop-grid">
                                {paginatedProducts.map((product) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        onAddToCart={handleAddToCart}
                                        onImageClick={setSelectedImageProduct}
                                    />
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <div className="pagination">
                                    <button
                                        className="page-btn"
                                        disabled={safeCurrentPage === 1}
                                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                    >
                                        <ChevronLeft size={20} />
                                    </button>

                                    {Array.from({ length: totalPages }).map((_, index) => (
                                        <button
                                            key={index}
                                            className={`page-btn ${safeCurrentPage === index + 1 ? 'active' : ''}`}
                                            onClick={() => setCurrentPage(index + 1)}
                                        >
                                            {index + 1}
                                        </button>
                                    ))}

                                    <button
                                        className="page-btn"
                                        disabled={safeCurrentPage === totalPages}
                                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="no-results no-results-boxed">
                            <h3 className="no-results-title">No products found.</h3>
                            <p className="no-results-text">Try adjusting your search or filters to find what you're looking for.</p>
                        </div>
                    )}
                </main>
            </div>

            <ProductDetailsModal
                key={selectedImageProduct?.id ?? 'no-product'}
                product={selectedImageProduct}
                onClose={() => setSelectedImageProduct(null)}
                onAddToCart={handleAddToCart}
            />
        </div>
    );
}
