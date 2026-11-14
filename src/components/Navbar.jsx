import { useLocale } from '../context/LocaleContext';
import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { CATEGORY_TILES } from '../data/categoryTiles';
import { Menu, Search, ShoppingCart, Truck, User, X } from 'lucide-react';
import { whatsappLink } from '../utils/storefront';
import LanguageMenu from './LanguageMenu';
import './Navbar.css';
export default function Navbar({
  cartCount,
  onCartClick
}) {
  const {
    t
  } = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  // The search box sends the visitor to the shop page with the words in the address.
  const submitSearch = event => {
    event.preventDefault();
    const words = query.trim();
    setSearchOpen(false);
    setMobileMenuOpen(false);
    navigate(words ? `/products?q=${encodeURIComponent(words)}` : '/products');
  };
  const megaMenuRef = useRef(null);
  const {
    pathname
  } = useLocation();
  const closeMenus = () => {
    setMobileMenuOpen(false);
    setShopMenuOpen(false);
  };
  useEffect(() => {
    const handleClickOutside = event => {
      if (megaMenuRef.current && !megaMenuRef.current.contains(event.target)) {
        setShopMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 28);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);
  useEffect(() => {
    const handleEscape = event => {
      if (event.key === 'Escape') {
        closeMenus();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    closeMenus();
  }
  return <>
            <nav className={`navbar ${scrolled ? 'glass scrolled' : ''} ${mobileMenuOpen ? 'menu-open' : ''} ${searchOpen ? 'search-open' : ''}`.trim()}>
                <div className="navbar-topbar">
                    <div className="navbar-topbar-inner">
                        <span className="navbar-topbar-note"><Truck size={15} aria-hidden="true" />{t("Delivery across Iraq and Kurdistan")}</span>
                        <div className="navbar-topbar-links">
                            <Link to="/wholesale/login" onClick={closeMenus}>{t("Wholesale")}</Link>
                            <Link to="/help/delivery" onClick={closeMenus}>{t("Delivery & Ordering")}</Link>
                            <a href={whatsappLink()} target="_blank" rel="noreferrer">{t("Order on WhatsApp")}</a>
                        </div>
                    </div>
                </div>
                <div className="navbar-container">
                    <Link to="/" className="navbar-logo-button" aria-label={t("Go to homepage")} onClick={closeMenus}>
                        <img src="/itland-wordmark.webp" alt="iTLand" className="navbar-logo-image" width="631" height="144" />
                    </Link>

                    <div className={`navbar-links ${mobileMenuOpen ? 'active' : ''}`}>
                        <NavLink to="/" className={({
            isActive
          }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenus}>{t("Home")}


            </NavLink>

                        <div className="nav-item has-dropdown" ref={megaMenuRef} onMouseEnter={() => window.innerWidth > 900 && setShopMenuOpen(true)} onMouseLeave={() => window.innerWidth > 900 && setShopMenuOpen(false)}>

                            <NavLink to="/products" className={({ isActive }) => `nav-link dropdown-toggle ${isActive ? 'active' : ''}`} onClick={closeMenus}>{t("Shop")}</NavLink>

                            <div className={`mega-menu glass ${shopMenuOpen ? 'show' : ''}`}>
                                <div className="mega-menu-grid">
                                    {CATEGORY_TILES.map(tile => <Link key={tile.path} className="mega-category" to={tile.path} onClick={closeMenus}>
                                            <span className="mega-category-photo"><img src={tile.cutout} alt="" loading="lazy" decoding="async" /></span>
                                            <span className="mega-category-name">{t(tile.name)}</span>
                                        </Link>)}
                                </div>
                                <Link className="view-all-link mega-menu-all" to="/products" onClick={closeMenus}>{t("View All Products")}</Link>
                            </div>
                        </div>

                        <NavLink to="/video-conferencing" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenus}>{t("Video Conferencing")}</NavLink>

                        <NavLink to="/about" className={({
            isActive
          }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenus}>{t("About")}


            </NavLink>

                        <NavLink to="/contact" className={({
            isActive
          }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenus}>{t("Contact")}


            </NavLink>

                        <Link to="/admin/login" className="nav-link mobile-only-link" onClick={closeMenus}>{t("Account")}

            </Link>
                    </div>

                    <div className="navbar-actions">
                        <LanguageMenu />
                        <form className="navbar-search" role="search" onSubmit={submitSearch}>
                            <input type="search" name="q" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Search products")} aria-label={t("Search products")} />
                            <button type="submit" aria-label={t("Search")}><Search size={18} aria-hidden="true" /></button>
                        </form>
                        <button type="button" className="action-btn navbar-search-toggle" onClick={() => setSearchOpen(open => !open)} aria-expanded={searchOpen} aria-label={t("Search")}>
                            <Search size={20} />
                        </button>

                        <Link to="/admin/login" className="action-btn desktop-user-btn" aria-label="Account / Admin" onClick={closeMenus}>
                            <User size={20} />
                        </Link>

                        <button type="button" className="action-btn cart-btn" onClick={() => {
            closeMenus();
            onCartClick();
          }} aria-label={t("Cart")}>

                            <ShoppingCart size={20} />
                            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
                        </button>

                        <button type="button" className="action-btn mobile-menu-toggle" onClick={() => setMobileMenuOpen(open => !open)} aria-expanded={mobileMenuOpen} aria-label={mobileMenuOpen ? t("Close menu") : t("Open menu")}>

                            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </div>
            </nav>

            {mobileMenuOpen && <button type="button" className="mobile-nav-backdrop" aria-label={t("Close menu")} onClick={closeMenus} />}
        </>;
}
