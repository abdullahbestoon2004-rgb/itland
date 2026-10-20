import { useLocale } from '../context/LocaleContext';
import { CurrencyNote } from './Price';
import React from 'react';
import { Link } from 'react-router-dom';
import NewsletterForm from './NewsletterForm';
import { whatsappLink } from '../utils/storefront';
import './Footer.css';
export default function Footer() {
  const {
    t
  } = useLocale();
  return <footer className="footer">
            <div className="footer-container">
                <div className="footer-brand">
                    <div className="footer-logo">
                        <img src="/newitlandlogo.png" alt="IT LAND logo" className="footer-logo-image" />
                    </div>
                    <p className="brand-tagline">{t("Play to win. The ultimate gear for gamers and creators.")}</p>

                </div>

                <div className="footer-links-grid">
                    <div className="footer-column">
                        <h4 className="column-title">{t("Products")}</h4>
                        <Link to="/products?category=Mice" className="footer-link">{t("Mice")}</Link>
                        <Link to="/products?category=Keyboards" className="footer-link">{t("Keyboards")}</Link>
                        <Link to="/products?category=Headsets" className="footer-link">{t("Headsets")}</Link>
                        <Link to="/products?category=Webcams" className="footer-link">{t("Webcams")}</Link>
                    </div>

                    <div className="footer-column">
                        <h4 className="column-title">{t("Support")}</h4>
                        <Link to="/help/delivery" className="footer-link">{t("Delivery & Ordering")}</Link>
                        <a href={whatsappLink()} className="footer-link" target="_blank" rel="noreferrer">{t("Contact Us")}</a>
                        <a href="mailto:hello@itland.store" className="footer-link">{t("Email Support")}</a>
                        <Link to="/help/warranty" className="footer-link">{t("Warranty")}</Link>
                        <Link to="/help/returns" className="footer-link">{t("Returns")}</Link>
                    </div>

                    <div className="footer-column">
                        <h4 className="column-title">{t("About")}</h4>
                        <Link to="/about" className="footer-link">{t("Our Story")}</Link>
                        <Link to="/about" className="footer-link">{t("Why Choose Us")}</Link>
                        <Link to="/contact" className="footer-link">{t("Contact Us")}</Link>
                        <Link to="/products?sort=newest" className="footer-link">{t("New Arrivals")}</Link>
                    </div>

                    <div className="footer-column newsletter-col">
                        <h4 className="column-title">{t("Stay in the Loop")}</h4>
                        <p className="footer-text">{t("Subscribe to get special offers, free giveaways, and once-in-a-lifetime deals.")}</p>
                        <NewsletterForm className="footer-newsletter-form" />
                    </div>
                </div>
            </div>

            <div className="footer-bottom">
                <CurrencyNote />
                <p>&copy; {new Date().getFullYear()}{t("IT LAND. All rights reserved.")}</p>
            </div>
        </footer>;
}
