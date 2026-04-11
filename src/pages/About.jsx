import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
    Shield,
    Zap,
    MessageCircle,
    BadgeCheck,
    ArrowRight,
} from 'lucide-react';
import './About.css';

gsap.registerPlugin(ScrollTrigger);

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
        text: 'Reach us instantly via WhatsApp. Real people, real answers — no bots, no delays.',
        id: 'wcu-support',
    },
    {
        icon: <Shield size={32} />,
        title: 'Warranty & Trust',
        text: 'Every product comes with a guarantee. We stand behind what we sell.',
        id: 'wcu-warranty',
    },
];

export default function About() {
    const heroRef = useRef(null);
    const storyTextRef = useRef(null);
    const storyImgRef = useRef(null);
    const cardsRef = useRef([]);
    const visionRef = useRef(null);
    const ctaRef = useRef(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Hero fade-in
            gsap.fromTo(
                heroRef.current,
                { opacity: 0, y: 40 },
                { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' }
            );

            // Story section slide-in
            gsap.fromTo(
                storyTextRef.current,
                { opacity: 0, x: -60 },
                {
                    opacity: 1,
                    x: 0,
                    duration: 0.95,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: storyTextRef.current,
                        start: 'top 80%',
                        toggleActions: 'play none none none',
                    },
                }
            );

            gsap.fromTo(
                storyImgRef.current,
                { opacity: 0, x: 60 },
                {
                    opacity: 1,
                    x: 0,
                    duration: 0.95,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: storyImgRef.current,
                        start: 'top 80%',
                        toggleActions: 'play none none none',
                    },
                }
            );

            // Cards stagger
            gsap.fromTo(
                cardsRef.current,
                { opacity: 0, y: 40 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.7,
                    stagger: 0.14,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: cardsRef.current[0],
                        start: 'top 82%',
                        toggleActions: 'play none none none',
                    },
                }
            );

            // Vision fade-up
            gsap.fromTo(
                visionRef.current,
                { opacity: 0, y: 50 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.9,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: visionRef.current,
                        start: 'top 80%',
                        toggleActions: 'play none none none',
                    },
                }
            );

            // CTA fade-up
            gsap.fromTo(
                ctaRef.current,
                { opacity: 0, y: 30 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.8,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: ctaRef.current,
                        start: 'top 85%',
                        toggleActions: 'play none none none',
                    },
                }
            );
        });

        return () => ctx.revert();
    }, []);

    return (
        <div className="about-page">
            {/* ── SECTION 1: HERO ── */}
            <section className="about-hero">
                <div className="about-hero-bg" aria-hidden="true">
                    <div className="about-hero-orb about-hero-orb--1" />
                    <div className="about-hero-orb about-hero-orb--2" />
                    <div className="about-hero-grid" />
                </div>
                <div className="about-hero-content" ref={heroRef}>
                    <p className="about-hero-eyebrow">Our Story</p>
                    <h1 className="about-hero-title">About ITLand</h1>
                    <p className="about-hero-subtitle">Premium Tech. Trusted Experience.</p>
                </div>
            </section>

            {/* ── SECTION 2: OUR STORY ── */}
            <section className="about-story">
                <div className="about-container">
                    <div className="about-story-grid">
                        <div className="about-story-text" ref={storyTextRef}>
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
                                Based in Erbil, Iraq, we understand what local customers need —
                                fast delivery, honest support, and gear you can trust. Every
                                product in our store has been personally reviewed for quality
                                before it reaches your hands.
                            </p>
                        </div>
                        <div className="about-story-image-wrap" ref={storyImgRef}>
                            <img
                                src="/about-workspace.png"
                                alt="Premium tech workspace setup"
                                className="about-story-image"
                                loading="lazy"
                            />
                            <div className="about-story-image-glow" aria-hidden="true" />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── SECTION 3: WHY CHOOSE US ── */}
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
                        {WHY_CARDS.map((card, i) => (
                            <div
                                key={card.id}
                                id={card.id}
                                className="about-card"
                                ref={(el) => (cardsRef.current[i] = el)}
                            >
                                <div className="about-card-icon">{card.icon}</div>
                                <h3 className="about-card-title">{card.title}</h3>
                                <p className="about-card-text">{card.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── SECTION 4: OUR VISION ── */}
            <section className="about-vision" ref={visionRef}>
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
                        and delivered with care — right here in Iraq.
                    </p>
                </div>
            </section>

            {/* ── SECTION 5: CTA ── */}
            <section className="about-cta" ref={ctaRef}>
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
