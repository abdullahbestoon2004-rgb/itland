import React from 'react';
import { Link } from 'react-router-dom';
import { getSettings } from '../data/settings';
import './PromoBanner.css';

export default function PromoBanner() {
    const settings = getSettings();

    if (!settings || !settings.promoBannerVisible) {
        return null;
    }

    const bannerImage = settings.promoBannerImage || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop';
    const bannerTitle = settings.promoBannerTitle || 'Up to 30% OFF Gaming Accessories';
    const bannerSubtitle = settings.promoBannerSubtitle || 'Level up your gameplay with premium gear at unbeatable prices.';

    return (
        <section className="promo-split-banner">
            <div className="promo-split-container">
                <div className="promo-split-image" style={{ backgroundImage: `url('${bannerImage}')` }} />
                <div className="promo-split-content">
                    <h2 className="promo-split-title">{bannerTitle}</h2>
                    <p className="promo-split-subtitle">{bannerSubtitle}</p>
                    <Link to="/products" className="btn btn-primary promo-btn">Shop the Sale</Link>
                </div>
            </div>
        </section>
    );
}
