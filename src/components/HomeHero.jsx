import { useLocale } from '../context/LocaleContext';
import React from 'react';
import { Link } from 'react-router-dom';
import './HomeHero.css';
export default function HomeHero() {
  const {
    t
  } = useLocale();
  return <section className="home-hero">
            <div className="home-hero-bg"></div>
            <div className="home-hero-container">
                <div className="home-hero-content">
                    <h1 className="home-hero-title">{t("Upgrade Your Setup")}</h1>
                    <p className="home-hero-subtitle">{t("Experience the ultimate precision with computer accessories and gaming gear.")}</p>
                    <div className="home-hero-actions">
                        <Link to="/products" className="btn btn-primary btn-large">{t("Shop Now")}</Link>
                        <a href="#best-sellers" className="btn btn-secondary btn-large">{t("Explore Products")}</a>
                    </div>
                </div>
            </div>
        </section>;
}
