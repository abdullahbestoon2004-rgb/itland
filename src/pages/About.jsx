import React from 'react';
import { Link } from 'react-router-dom';
import {
    Shield,
    Zap,
    MessageCircle,
    BadgeCheck,
    ArrowRight,
} from 'lucide-react';
import './About.css';

const WHY_CARDS = [
    {
        icon: <BadgeCheck size={32} />,
        title: 'High Quality Products',
        text: 'We exclusively carry trusted brands, hand-selected for build quality, durability, and performance.',
        id: 'wcu-quality',
    },
    {
        icon: <Zap size={32} />,
        title: 'Fast Delivery',
        text: 'Quick and reliable service across Iraq. Your gear reaches you without the long wait.',
        id: 'wcu-delivery',
    },
    {
        icon: <MessageCircle size={32} />,
        title: 'Customer Support',
        text: 'Reach us instantly via WhatsApp. Real people, real answers, no bots and no delays.',
        id: 'wcu-support',
    },
    {
        icon: <Shield size={32} />,
        title: 'Warranty & Trust',
        text: 'Every product comes with a guarantee. We stand behind what we sell.',
        id: 'wcu-warranty',
    },
];

const STORY_IMAGE_SRC = '/backgroundimage.png';
const STORY_IMAGE_FALLBACK = 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?auto=format&fit=crop&w=1400&q=80';

export default function About() {
    return (
        <div className="about-page">
            <section className="about-hero">
                <div className="about-hero-bg" aria-hidden="true">
                    <div className="about-hero-orb about-hero-orb--1" />
                    <div className="about-hero-orb about-hero-orb--2" />
                    <div className="about-hero-grid" />
                </div>
                <div className="about-hero-content">
                    <p className="about-hero-eyebrow">Our Story</p>
                    <h1 className="about-hero-title">About ITLand</h1>
                    <p className="about-hero-subtitle">Premium Tech. Trusted Experience.</p>
                </div>
            </section>

            <section className="about-story">
                <div className="about-container">
                    <div className="about-story-grid">
                        <div className="about-story-text">
                            <p className="about-section-eyebrow">Who We Are</p>
                            <h2 className="about-section-title">Our Story</h2>
                            <p className="about-story-body">
                                ITLand ForComputer was created to bring high-quality technology
                                products to customers who value performance, design, and
                                reliability. We focus on premium brands like Logitech and
                                carefully selected accessories that enhance your daily workflow,
                                gaming, and productivity.
                            </p>
                            <p className="about-story-body">
                                Based in Erbil, Iraq, we understand what local customers need,
                                fast delivery, honest support, and gear you can trust. Every
                                product in our store has been personally reviewed for quality
                                before it reaches your hands.
                            </p>
                        </div>
                        <div className="about-story-image-wrap">
                            <img
                                src={STORY_IMAGE_SRC}
                                alt="Premium tech workspace setup"
                                className="about-story-image"
                                loading="lazy"
                                onError={(event) => {
                                    event.currentTarget.onerror = null;
                                    event.currentTarget.src = STORY_IMAGE_FALLBACK;
                                }}
                            />
                            <div className="about-story-image-glow" aria-hidden="true" />
                        </div>
                    </div>
                </div>
            </section>

            <section className="about-why">
                <div className="about-container">
                    <div className="about-section-header">
                        <p className="about-section-eyebrow">Benefits</p>
                        <h2 className="about-section-title">Why Choose Us</h2>
                        <p className="about-section-sub">
                            We built ITLand around the things that matter most to our customers.
                        </p>
                    </div>
                    <div className="about-cards-grid">
                        {WHY_CARDS.map((card) => (
                            <div key={card.id} id={card.id} className="about-card">
                                <div className="about-card-icon">{card.icon}</div>
                                <h3 className="about-card-title">{card.title}</h3>
                                <p className="about-card-text">{card.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="about-vision">
                <div className="about-vision-bg" aria-hidden="true">
                    <div className="about-vision-orb" />
                </div>
                <div className="about-container about-vision-content">
                    <p className="about-section-eyebrow about-section-eyebrow--center">
                        Looking Ahead
                    </p>
                    <h2 className="about-vision-title">
                        We aim to become the go-to destination for premium tech in Iraq.
                    </h2>
                    <p className="about-vision-sub">
                        Our mission is to make world-class technology accessible, affordable,
                        and delivered with care right here in Iraq.
                    </p>
                </div>
            </section>

            <section className="about-cta">
                <div className="about-container about-cta-content">
                    <h2 className="about-cta-title">Ready to Upgrade Your Setup?</h2>
                    <p className="about-cta-sub">
                        Explore our full collection of premium tech gear.
                    </p>
                    <Link to="/products" className="btn btn-primary about-cta-btn" id="about-shop-btn">
                        Shop Now <ArrowRight size={18} />
                    </Link>
                </div>
            </section>
        </div>
    );
}
