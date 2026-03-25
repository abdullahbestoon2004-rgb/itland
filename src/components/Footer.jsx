import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Send } from 'lucide-react';
import './Footer.css';

export default function Footer() {
    const [email, setEmail] = useState('');

    const handleSubscribe = (event) => {
        event.preventDefault();
        if (email) {
            alert('Thank you for subscribing!');
            setEmail('');
        }
    };

    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-brand">
                    <div className="footer-logo">
                        <img src="/newitlandlogo.png" alt="IT LAND logo" className="footer-logo-image" />
                    </div>
                    <p className="brand-tagline">Play to win. The ultimate gear for gamers and creators.</p>
                    <div className="social-links">
                        <a href="https://www.instagram.com" className="social-link" target="_blank" rel="noreferrer" aria-label="Instagram">
                            <Instagram size={18} />
                        </a>
                        <a href="https://www.facebook.com" className="social-link" target="_blank" rel="noreferrer" aria-label="Facebook">
                            <Facebook size={18} />
                        </a>
                    </div>
                </div>

                <div className="footer-links-grid">
                    <div className="footer-column">
                        <h4 className="column-title">Products</h4>
                        <Link to="/products" className="footer-link">Mice</Link>
                        <Link to="/products" className="footer-link">Keyboards</Link>
                        <Link to="/products" className="footer-link">Headsets</Link>
                        <Link to="/products" className="footer-link">Webcams</Link>
                    </div>

                    <div className="footer-column">
                        <h4 className="column-title">Support</h4>
                        <a href="https://wa.me/9647502045634" className="footer-link" target="_blank" rel="noreferrer">Contact Us</a>
                        <a href="mailto:hello@itland.store" className="footer-link">Email Support</a>
                        <Link to="/products" className="footer-link">Warranty</Link>
                        <Link to="/products" className="footer-link">Returns</Link>
                    </div>

                    <div className="footer-column">
                        <h4 className="column-title">About</h4>
                        <Link to="/" className="footer-link">Our Story</Link>
                        <Link to="/products" className="footer-link">New Arrivals</Link>
                        <Link to="/products" className="footer-link">Popular Gear</Link>
                        <Link to="/admin/login" className="footer-link">Admin Portal</Link>
                    </div>

                    <div className="footer-column newsletter-col">
                        <h4 className="column-title">Stay in the Loop</h4>
                        <p className="footer-text">Subscribe to get special offers, free giveaways, and once-in-a-lifetime deals.</p>
                        <form className="footer-newsletter-form" onSubmit={handleSubscribe}>
                            <input
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                            />
                            <button type="submit" aria-label="Subscribe">
                                <Send size={18} />
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} IT LAND. All rights reserved.</p>
            </div>
        </footer>
    );
}
