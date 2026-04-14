import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, Search, ShoppingCart, User, X } from 'lucide-react';
import './Navbar.css';

export default function Navbar({ cartCount, onCartClick, onSearchClick }) {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [shopMenuOpen, setShopMenuOpen] = useState(false);

    const megaMenuRef = useRef(null);
    const navigate = useNavigate();

    const closeMenus = () => {
        setMobileMenuOpen(false);
        setShopMenuOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
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
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                closeMenus();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, []);

    const handleCategoryClick = (category) => {
        closeMenus();
        navigate(`/products?category=${encodeURIComponent(category)}`);
    };

    return (
        <>
            <nav className={`navbar ${scrolled ? 'glass scrolled' : ''} ${mobileMenuOpen ? 'menu-open' : ''}`.trim()}>
                <div className="navbar-container">
                    <button
                        type="button"
                        className="navbar-logo-button"
                        aria-label="Go to homepage"
                        onClick={() => {
                            closeMenus();
                            navigate('/');
                        }}
                    >
                        <img src="/newitlandlogo.png" alt="IT LAND" className="navbar-logo-image" />
                    </button>

                    <div className={`navbar-links ${mobileMenuOpen ? 'active' : ''}`}>
                        <NavLink
                            to="/"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            onClick={closeMenus}
                        >
                            Home
                        </NavLink>

                        <div
                            className="nav-item has-dropdown"
                            ref={megaMenuRef}
                            onMouseEnter={() => window.innerWidth > 900 && setShopMenuOpen(true)}
                            onMouseLeave={() => window.innerWidth > 900 && setShopMenuOpen(false)}
                        >
                            <button
                                type="button"
                                className="nav-link dropdown-toggle"
                                aria-expanded={shopMenuOpen}
                                aria-haspopup="true"
                                onClick={() => {
                                    closeMenus();
                                    navigate('/products');
                                }}
                            >
                                Shop
                            </button>

                            <div className={`mega-menu glass ${shopMenuOpen ? 'show' : ''}`}>
                                <div className="mega-menu-grid">
                                    <button type="button" className="mega-category" onClick={() => handleCategoryClick('Mice')}>
                                        <h4>Mice</h4>
                                        <p>Gaming and Productivity</p>
                                    </button>
                                    <button type="button" className="mega-category" onClick={() => handleCategoryClick('Keyboards')}>
                                        <h4>Keyboards</h4>
                                        <p>Mechanical and Wireless</p>
                                    </button>
                                    <button type="button" className="mega-category" onClick={() => handleCategoryClick('Headsets')}>
                                        <h4>Headsets</h4>
                                        <p>Pro Audio Gear</p>
                                    </button>
                                    <button type="button" className="mega-category" onClick={() => handleCategoryClick('Webcams')}>
                                        <h4>Webcams</h4>
                                        <p>Streaming and Video</p>
                                    </button>
                                    <button type="button" className="mega-category" onClick={() => handleCategoryClick('Gaming')}>
                                        <h4>Gaming</h4>
                                        <p>Controllers and Wheels</p>
                                    </button>
                                    <button type="button" className="mega-category" onClick={() => handleCategoryClick('Accessories')}>
                                        <h4>Accessories</h4>
                                        <p>Mats and Mounts</p>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <Link to="/products" className="nav-link all-products-link" onClick={closeMenus}>
                            All Products
                        </Link>

                        <NavLink
                            to="/about"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            onClick={closeMenus}
                        >
                            About
                        </NavLink>

                        <NavLink
                            to="/contact"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            onClick={closeMenus}
                        >
                            Contact
                        </NavLink>

                        <Link to="/admin/login" className="nav-link mobile-only-link" onClick={closeMenus}>
                            Account
                        </Link>
                    </div>

                    <div className="navbar-actions">
                        <button
                            type="button"
                            className="action-btn"
                            onClick={() => {
                                onSearchClick();
                                closeMenus();
                            }}
                            aria-label="Search"
                        >
                            <Search size={20} />
                        </button>

                        <Link to="/admin/login" className="action-btn desktop-user-btn" aria-label="Account / Admin" onClick={closeMenus}>
                            <User size={20} />
                        </Link>

                        <button
                            type="button"
                            className="action-btn cart-btn"
                            onClick={() => {
                                closeMenus();
                                onCartClick();
                            }}
                            aria-label="Cart"
                        >
                            <ShoppingCart size={20} />
                            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
                        </button>

                        <button
                            type="button"
                            className="action-btn mobile-menu-toggle"
                            onClick={() => setMobileMenuOpen((open) => !open)}
                            aria-expanded={mobileMenuOpen}
                            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        >
                            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </div>
            </nav>

            {mobileMenuOpen && (
                <button
                    type="button"
                    className="mobile-nav-backdrop"
                    aria-label="Close menu"
                    onClick={closeMenus}
                />
            )}
        </>
    );
}
