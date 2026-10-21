import { usePageData } from '../context/PageDataContext';
import usePageMeta from '../hooks/usePageMeta';
import { useLocale } from '../context/LocaleContext';
import { useCurrency } from '../context/CurrencyContext';
import { isFreshRate } from '../utils/currency';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import ProductDetailsModal from '../components/ProductDetailsModal';
import { getAllProducts } from '../data/products';
import './AllProducts.css';
const categories = ['All', 'Mice', 'Keyboards', 'Headsets', 'Webcams', 'Gaming', 'Accessories', 'Audio', 'Streaming'];
export default function AllProducts() {
  const {
    t
  } = useLocale();
  const {
    snapshot
  } = useCurrency();
  const hasRate = isFreshRate(snapshot);
  const {
    handleAddToCart
  } = useOutletContext();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = usePageData();
  const [products, setProducts] = useState(initial.products ?? []);
  const [productsError, setProductsError] = useState('');
  const [selectedImageProduct, setSelectedImageProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBrands, setActiveBrands] = useState([]);
  const [sortBy, setSortBy] = useState(() => searchParams.get('sort') === 'newest' ? 'newest' : 'featured');
  const [priceRange, setPriceRange] = useState({
    min: '',
    max: ''
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pageParam = Number(searchParams.get('page'));
  const currentPage = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const setCurrentPage = value => {
    const nextPage = typeof value === 'function' ? value(currentPage) : value;
    setSearchParams(params => {
      const next = new URLSearchParams(params);
      if (nextPage > 1) next.set('page', String(nextPage)); else next.delete('page');
      return next;
    }, { replace: true });
  };
  const itemsPerPage = 12;
  const searchInputRef = useRef(null);
  const categoryFromParams = searchParams.get('category');
  const activeCategory = categoryFromParams && categories.includes(categoryFromParams) ? categoryFromParams : 'All';
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
    const handleEscape = event => {
      if (event.key === 'Escape') {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [mobileSidebarOpen]);
  const handleCategoryChange = category => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (category === 'All') {
      nextSearchParams.delete('category');
    } else {
      nextSearchParams.set('category', category);
    }
    nextSearchParams.delete('page');
    setSearchParams(nextSearchParams, {
      replace: true
    });
    if (window.innerWidth <= 1024) {
      setMobileSidebarOpen(false);
    }
  };
  const handleBrandToggle = (brand, isChecked) => {
    setActiveBrands(previous => {
      if (isChecked) {
        return [...previous, brand];
      }
      return previous.filter(item => item !== brand);
    });
    setCurrentPage(1);
  };
  const handlePriceChange = (field, value) => {
    setPriceRange(previous => ({
      ...previous,
      [field]: value
    }));
    setCurrentPage(1);
  };
  const handleResetFilters = () => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('category');
    nextSearchParams.delete('page');
    setSearchParams(nextSearchParams, {
      replace: true
    });
    setSearchQuery('');
    setActiveBrands([]);
    setSortBy('featured');
    setPriceRange({
      min: '',
      max: ''
    });
  };
  const brands = [...new Set(products.map(product => product.brand).filter(Boolean))].sort();
  const filteredProducts = products.filter(product => {
    const matchesCategory = activeCategory === 'All' || product.category === activeCategory;
    const matchesBrand = activeBrands.length === 0 || activeBrands.includes(product.brand);
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const iqdPrice = hasRate ? Math.round(product.price * snapshot.rate) : null;
    const matchesPrice = !hasRate || (priceRange.min === '' || iqdPrice >= Number(priceRange.min)) && (priceRange.max === '' || iqdPrice <= Number(priceRange.max));
    return matchesCategory && matchesBrand && matchesSearch && matchesPrice;
  }).sort((a, b) => {
    if (sortBy === 'price-low') return a.price - b.price;
    if (sortBy === 'price-high') return b.price - a.price;
    if (sortBy === 'newest') return b.id - a.id;
    return (b.featured === true ? 1 : 0) - (a.featured === true ? 1 : 0);
  });
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);
  const filtersChanged = searchQuery.length > 0 || activeCategory !== 'All' || activeBrands.length > 0 || sortBy !== 'featured' || priceRange.min !== '' || priceRange.max !== '';
  const canonicalParams = new URLSearchParams();
  if (activeCategory !== 'All') canonicalParams.set('category', activeCategory);
  if (currentPage > 1) canonicalParams.set('page', String(currentPage));
  const canonicalPath = `/products${canonicalParams.size ? `?${canonicalParams}` : ''}`;
  const scrollToProducts = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const pagePath = page => {
    const params = new URLSearchParams(searchParams);
    if (page > 1) params.set('page', String(page)); else params.delete('page');
    return `/products${params.size ? `?${params}` : ''}`;
  };
  usePageMeta({
    title: `${activeCategory === 'All' ? 'Computer Accessories & Gaming Gear' : `${activeCategory} in Iraq`}${currentPage > 1 ? ` - Page ${currentPage}` : ''}`,
    description: `Shop ${activeCategory === 'All' ? 'computer accessories and gaming gear' : activeCategory.toLowerCase()} at IT Land in Erbil. Compare products and brands. Delivery across Iraq and Kurdistan. Order on WhatsApp.`,
    path: canonicalPath,
    noindex: Boolean(productsError) || ((initial.products || products.length > 0) && filteredProducts.length === 0) || currentPage > totalPages || filtersChanged && (searchQuery.length > 0 || activeBrands.length > 0 || sortBy !== 'featured' || priceRange.min !== '' || priceRange.max !== ''),
  });
  return <div className="all-products-page">
            <header className="shop-header">
                <h1 className="shop-title">{activeCategory === 'All' ? t('Shop Products') : t(activeCategory)}</h1>
                <p className="shop-subtitle">{t("Discover the latest computer accessories.")}</p>
                {productsError && <p className="shop-subtitle">{productsError}</p>}
            </header>

            <div className="shop-container">
                {mobileSidebarOpen && <div className="sidebar-overlay" onClick={() => setMobileSidebarOpen(false)} />}

                <aside className={`shop-sidebar ${mobileSidebarOpen ? 'active' : ''}`}>
                    <button className="close-sidebar-btn" onClick={() => setMobileSidebarOpen(false)}>
                        <X size={20} />{t("Close Filters")}
          </button>

                    <div className="filter-section">
                        <h3 className="filter-title">{t("Search")}</h3>
                        <input ref={searchInputRef} id="search-input" type="text" placeholder={t("Find products...")} aria-label={t("Search products")} className="shop-search-input" value={searchQuery} onChange={event => {
            setSearchQuery(event.target.value);
            setCurrentPage(1);
          }} />

                    </div>

                    <div className="filter-section">
                        <h3 className="filter-title">{t("Category")}</h3>
                        <div className="filter-list">
                            {categories.map(category => <label key={t(category)} className="filter-label">
                                    <input type="radio" name="category" checked={activeCategory === category} onChange={() => handleCategoryChange(category)} />

                                    <Link to={category === 'All' ? '/products' : `/products?category=${encodeURIComponent(category)}`}>{t(category)}</Link>
                                </label>)}
                        </div>
                    </div>

                    <div className="filter-section">
                        <h3 className="filter-title">{t("Brands")}</h3>
                        <div className="filter-list">
                            {brands.map(brand => <label key={brand} className="filter-label">
                                    <input type="checkbox" checked={activeBrands.includes(brand)} onChange={event => handleBrandToggle(brand, event.target.checked)} />

                                    {brand}
                                </label>)}
                        </div>
                    </div>

                    <div className="filter-section">
                        <h3 className="filter-title">{t("Price Range (IQD)")}</h3>
                        <div className="price-range-inputs">
                            <input type="number" className="price-input" placeholder={t("Min IQD")} aria-label={t("Minimum price in IQD")} min="0" disabled={!hasRate} value={priceRange.min} onChange={event => handlePriceChange('min', event.target.value)} />

                            <span className="price-separator">-</span>
                            <input type="number" className="price-input" placeholder={t("Max IQD")} aria-label={t("Maximum price in IQD")} min="0" disabled={!hasRate} value={priceRange.max} onChange={event => handlePriceChange('max', event.target.value)} />

                        </div>
                    </div>
                </aside>

                <main className="shop-main">
                    <div className="shop-controls">
                        <button className="mobile-filter-toggle" onClick={() => setMobileSidebarOpen(true)}>
                            <SlidersHorizontal size={18} />{t("Filters")}
            </button>

                        <div className="shop-controls-right">
                            <span className="results-count">{t('Showing {count} results').replace('{count}', filteredProducts.length)}</span>

                            <div className="shop-controls-actions">
                                <div className="sort-control">
                                    <span className="sort-label">{t("Sort by:")}</span>
                                    <select aria-label={t("Sort products")} className="sort-select" value={sortBy} onChange={event => {
                  setSortBy(event.target.value);
                  setCurrentPage(1);
                }}>

                                        <option value="featured">{t("Featured")}</option>
                                        <option value="newest">{t("Newest Arrivals")}</option>
                                        <option value="price-low">{t("Price: Low to High")}</option>
                                        <option value="price-high">{t("Price: High to Low")}</option>
                                    </select>
                                </div>

                                <button className="reset-filters-btn" type="button" onClick={handleResetFilters} disabled={!filtersChanged}>{t("Reset")}


                </button>
                            </div>
                        </div>
                    </div>

                    {paginatedProducts.length > 0 ? <>
                            <div className="shop-grid">
                                {paginatedProducts.map(product => <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} onImageClick={setSelectedImageProduct} />)}
                            </div>

                            {totalPages > 1 && <nav className="pagination" aria-label="Product pages">
                                {safeCurrentPage > 1 && <Link className="page-btn" onClick={scrollToProducts} to={pagePath(safeCurrentPage - 1)} aria-label="Previous page"><ChevronLeft size={20} /></Link>}
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(page => page === 1 || page === totalPages || Math.abs(page - safeCurrentPage) <= 2)
                                    .map((page, index, pages) => <React.Fragment key={page}>
                                        {index > 0 && page - pages[index - 1] > 1 && <span className="pagination-ellipsis">…</span>}
                                        <Link className={`page-btn ${safeCurrentPage === page ? 'active' : ''}`} onClick={scrollToProducts} to={pagePath(page)} aria-current={safeCurrentPage === page ? 'page' : undefined}>{page}</Link>
                                    </React.Fragment>)}
                                {safeCurrentPage < totalPages && <Link className="page-btn" onClick={scrollToProducts} to={pagePath(safeCurrentPage + 1)} aria-label="Next page"><ChevronRight size={20} /></Link>}
                            </nav>}
                        </> : <div className="no-results no-results-boxed">
                            <h3 className="no-results-title">{t("No products found.")}</h3>
                            <p className="no-results-text">{t("Try adjusting your search or filters to find what you're looking for.")}</p>
                        </div>}
                </main>
            </div>

            <ProductDetailsModal key={selectedImageProduct?.id ?? 'no-product'} product={selectedImageProduct} onClose={() => setSelectedImageProduct(null)} onAddToCart={handleAddToCart} />

        </div>;
}
