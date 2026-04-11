import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
    Phone,
    Mail,
    MapPin,
    MessageCircle,
    Send,
    ArrowRight,
} from 'lucide-react';
import './Contact.css';

gsap.registerPlugin(ScrollTrigger);

const CONTACT_CARDS = [
    {
        id: 'contact-phone',
        icon: <Phone size={28} />,
        label: 'Phone',
        value: '07504888570',
        href: 'tel:+9647504888570',
    },
    {
        id: 'contact-email',
        icon: <Mail size={28} />,
        label: 'Email',
        value: 'hello@itland.store',
        href: 'mailto:hello@itland.store',
    },
    {
        id: 'contact-location',
        icon: <MapPin size={28} />,
        label: 'Location',
        value: 'Erbil, Kurdistan Region, Iraq',
        href: 'https://maps.app.goo.gl/FnZ4478eTBAsR7ym9',
    },
    {
        id: 'contact-whatsapp',
        icon: <MessageCircle size={28} />,
        label: 'WhatsApp',
        value: '07504888570',
        href: 'https://wa.me/9647504888570',
        isWhatsApp: true,
    },
];

export default function Contact() {
    const heroRef = useRef(null);
    const cardsRef = useRef([]);
    const formRef = useRef(null);
    const mapRef = useRef(null);
    const whatsAppRef = useRef(null);

    const [formData, setFormData] = useState({ name: '', email: '', message: '' });
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Hero fade-in
            gsap.fromTo(
                heroRef.current,
                { opacity: 0, y: 40 },
                { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' }
            );

            // Cards stagger
            gsap.fromTo(
                cardsRef.current,
                { opacity: 0, y: 40 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.7,
                    stagger: 0.13,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: cardsRef.current[0],
                        start: 'top 82%',
                        toggleActions: 'play none none none',
                    },
                }
            );

            // Form slide up
            gsap.fromTo(
                formRef.current,
                { opacity: 0, y: 50 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.9,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: formRef.current,
                        start: 'top 82%',
                        toggleActions: 'play none none none',
                    },
                }
            );

            // Map fade
            gsap.fromTo(
                mapRef.current,
                { opacity: 0, scale: 0.97 },
                {
                    opacity: 1,
                    scale: 1,
                    duration: 0.9,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: mapRef.current,
                        start: 'top 84%',
                        toggleActions: 'play none none none',
                    },
                }
            );

            // WhatsApp CTA
            gsap.fromTo(
                whatsAppRef.current,
                { opacity: 0, y: 40 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.9,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: whatsAppRef.current,
                        start: 'top 85%',
                        toggleActions: 'play none none none',
                    },
                }
            );
        });

        return () => ctx.revert();
    }, []);

    const handleChange = (e) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setSubmitted(true);
        setFormData({ name: '', email: '', message: '' });
        setTimeout(() => setSubmitted(false), 4000);
    };

    return (
        <div className="contact-page">
            {/* ── FLOATING WHATSAPP BUTTON ── */}
            <a
                href="https://wa.me/9647504888570"
                target="_blank"
                rel="noreferrer"
                className="contact-whatsapp-float"
                aria-label="Chat on WhatsApp"
                id="whatsapp-float-btn"
            >
                <svg viewBox="0 0 24 24" fill="currentColor" className="contact-wa-icon">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
            </a>

            {/* ── SECTION 1: HERO ── */}
            <section className="contact-hero">
                <div className="contact-hero-bg" aria-hidden="true">
                    <div className="contact-hero-orb contact-hero-orb--1" />
                    <div className="contact-hero-orb contact-hero-orb--2" />
                    <div className="contact-hero-grid" />
                </div>
                <div className="contact-hero-content" ref={heroRef}>
                    <p className="contact-hero-eyebrow">Get in Touch</p>
                    <h1 className="contact-hero-title">Contact Us</h1>
                    <p className="contact-hero-subtitle">We're here to help you anytime</p>
                </div>
            </section>

            {/* ── SECTION 2: CONTACT INFO CARDS ── */}
            <section className="contact-info-section">
                <div className="contact-container">
                    <div className="contact-section-header">
                        <p className="contact-eyebrow">Reach Out</p>
                        <h2 className="contact-section-title">How to Find Us</h2>
                    </div>
                    <div className="contact-cards-grid">
                        {CONTACT_CARDS.map((card, i) => (
                            <a
                                key={card.id}
                                id={card.id}
                                href={card.href}
                                target={card.isWhatsApp ? '_blank' : undefined}
                                rel={card.isWhatsApp ? 'noreferrer' : undefined}
                                className={`contact-info-card ${card.isWhatsApp ? 'contact-info-card--whatsapp' : ''}`}
                                ref={(el) => (cardsRef.current[i] = el)}
                            >
                                <div className="contact-info-icon">{card.icon}</div>
                                <p className="contact-info-label">{card.label}</p>
                                <p className="contact-info-value">{card.value}</p>
                            </a>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── SECTION 3: CONTACT FORM ── */}
            <section className="contact-form-section">
                <div className="contact-container">
                    <div className="contact-form-wrap" ref={formRef}>
                        <div className="contact-form-header">
                            <p className="contact-eyebrow">Send a Message</p>
                            <h2 className="contact-section-title">We'd Love to Hear From You</h2>
                            <p className="contact-form-sub">
                                Fill out the form below and we'll get back to you as soon as possible.
                            </p>
                        </div>

                        {submitted && (
                            <div className="contact-success-banner" role="alert">
                                ✅ Message sent! We'll be in touch shortly.
                            </div>
                        )}

                        <form className="contact-form" onSubmit={handleSubmit} noValidate>
                            <div className="contact-form-row">
                                <div className="contact-form-group">
                                    <label htmlFor="contact-name" className="contact-label">
                                        Full Name
                                    </label>
                                    <input
                                        id="contact-name"
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="Your name"
                                        className="contact-input"
                                        required
                                    />
                                </div>
                                <div className="contact-form-group">
                                    <label htmlFor="contact-email" className="contact-label">
                                        Email Address
                                    </label>
                                    <input
                                        id="contact-email"
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="your@email.com"
                                        className="contact-input"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="contact-form-group">
                                <label htmlFor="contact-message" className="contact-label">
                                    Message
                                </label>
                                <textarea
                                    id="contact-message"
                                    name="message"
                                    value={formData.message}
                                    onChange={handleChange}
                                    placeholder="How can we help you?"
                                    className="contact-input contact-textarea"
                                    rows={5}
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary contact-submit-btn"
                                id="contact-send-btn"
                            >
                                Send Message <Send size={16} />
                            </button>
                        </form>
                    </div>
                </div>
            </section>

            {/* ── SECTION 4: MAP ── */}
            <section className="contact-map-section">
                <div className="contact-container">
                    <div className="contact-map-header">
                        <p className="contact-eyebrow">Visit Us</p>
                        <h2 className="contact-section-title">Our Location</h2>
                    </div>
                    <div className="contact-map-wrap" ref={mapRef}>
                        <iframe
                            title="iTland For Computer — Erbil, Iraq"
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3220.0386974054522!2d44.0007757!3d36.1899407!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x400723e112abc16b%3A0x3147244a034d6616!2siTland%20For%20Computer!5e0!3m2!1sen!2sus!4v1744364000000!5m2!1sen!2sus"
                            className="contact-map-iframe"
                            allowFullScreen=""
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                    </div>
                </div>
            </section>

            {/* ── SECTION 5: WHATSAPP CTA ── */}
            <section className="contact-wa-section" ref={whatsAppRef}>
                <div className="contact-container">
                    <div className="contact-wa-card">
                        <div className="contact-wa-glow" aria-hidden="true" />
                        <div className="contact-wa-body">
                            <div className="contact-wa-icon-large">
                                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                </svg>
                            </div>
                            <div className="contact-wa-text">
                                <h2 className="contact-wa-title">Need a quick response?</h2>
                                <p className="contact-wa-sub">
                                    Chat with us on WhatsApp. We typically respond within minutes.
                                </p>
                            </div>
                            <a
                                href="https://wa.me/9647504888570"
                                target="_blank"
                                rel="noreferrer"
                                className="btn contact-wa-btn"
                                id="contact-whatsapp-chat-btn"
                            >
                                Chat Now <ArrowRight size={16} />
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
