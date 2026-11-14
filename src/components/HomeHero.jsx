import { useLocale } from '../context/LocaleContext';
import React from 'react';
import { Link } from 'react-router-dom';
import './HomeHero.css';

// Logitech's own photo of an MX keyboard, mouse, webcam and creative console, from Logitech's image CDN.
const HERO_PHOTO = 'https://resource.logitech.com/w_1400,c_limit,q_auto,f_auto,dpr_1.0/content/dam/logitech/en/homepage/banners/cards/mx-ecosystem-card.jpg';
export default function HomeHero() {
  const {
    t
  } = useLocale();
  return <section className="home-hero">
            <div className="home-hero-container">
                <div className="home-hero-content">
                    {/* One heading: search engines read the store line and the headline together. */}
                    <h1 className="home-hero-title"><span className="home-hero-eyebrow">{t("Computer store in Erbil")}</span>{' '}{t("Everything for your desk")}</h1>
                    <p className="home-hero-subtitle">{t("Mice, keyboards, headsets, webcams and meeting room gear from Logitech, Jabra and Poly, in stock in Erbil.")}</p>
                    <div className="home-hero-actions">
                        <Link to="/products" className="btn btn-primary btn-large">{t("Shop Now")}</Link>
                        <a href="#best-sellers" className="btn btn-secondary btn-large">{t("Explore Products")}</a>
                    </div>
                </div>
                <div className="home-hero-photo">
                    <img src={HERO_PHOTO} alt={t("A Logitech keyboard, mouse, webcam and control pads laid out on a desk")} fetchPriority="high" />
                </div>
            </div>
        </section>;
}
