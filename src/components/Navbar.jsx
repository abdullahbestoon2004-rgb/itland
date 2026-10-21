import { useLocale } from '../context/LocaleContext';
import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, Search, ShoppingCart, User, X } from 'lucide-react';
import LanguageMenu from './LanguageMenu';
import './Navbar.css';
export default function Navbar({
  cartCount,
  onCartClick,
  onSearchClick
}) {
  const {
    t
  } = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
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
            <nav className={`navbar ${scrolled ? 'glass scrolled' : ''} ${mobileMenuOpen ? 'menu-open' : ''}`.trim()}>
                <div className="navbar-container">
                    <Link to="/" className="navbar-logo-button" aria-label={t("Go to homepage")} onClick={closeMenus}>
                        <img src="/newitlandlogo.png" alt="IT LAND" className="navbar-logo-image" />
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
                                    <Link className="mega-category" to="/products?category=Mice" onClick={closeMenus}>
                                        <h4>{t("Mice")}</h4>
                                        <p>Gaming and Productivity</p>
                                    </Link>
                                    <Link className="mega-category" to="/products?category=Keyboards" onClick={closeMenus}>
                                        <h4>{t("Keyboards")}</h4>
                                        <p>Mechanical and Wireless</p>
                                    </Link>
                                    <Link className="mega-category" to="/products?category=Headsets" onClick={closeMenus}>
                                        <h4>{t("Headsets")}</h4>
                                        <p>Pro Audio Gear</p>
                                    </Link>
                                    <Link className="mega-category" to="/products?category=Webcams" onClick={closeMenus}>
                                        <h4>{t("Webcams")}</h4>
                                        <p>Streaming and Video</p>
                                    </Link>
                                    <Link className="mega-category" to="/products?category=Gaming" onClick={closeMenus}>
                                        <h4>{t("Gaming")}</h4>
                                        <p>Controllers and Wheels</p>
                                    </Link>
                                    <Link className="mega-category" to="/products?category=Accessories" onClick={closeMenus}>
                                        <h4>{t("Accessories")}</h4>
                                        <p>Mats and Mounts</p>
                                    </Link>
                                </div>
                            </div>
                        </div>

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
                        <button type="button" className="action-btn" onClick={() => {
            onSearchClick();
            closeMenus();
          }} aria-label={t("Search")}>

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
