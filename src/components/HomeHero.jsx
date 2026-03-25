import React from 'react';
import { Link } from 'react-router-dom';
import './HomeHero.css';

export default function HomeHero() {
    return (
        <section className="home-hero">
            <div className="home-hero-bg"></div>
            <div className="home-hero-container">
                <div className="home-hero-content">
                    <h1 className="home-hero-title">Upgrade Your Setup</h1>
                    <p className="home-hero-subtitle">Experience the ultimate precision with original Logitech products.</p>
                    <div className="home-hero-actions">
                        <Link to="/products" className="btn btn-primary btn-large">Shop Now</Link>
                        <a href="#best-sellers" className="btn btn-secondary btn-large">View Deals</a>
                    </div>
                </div>
            </div>
        </section>
    );
}
