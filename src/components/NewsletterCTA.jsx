import React, { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import './NewsletterCTA.css';

export default function NewsletterCTA() {
    const [email, setEmail] = useState('');

    const handleSubscribe = (event) => {
        event.preventDefault();
        alert(`Thanks for subscribing with ${email}!`);
        setEmail('');
    };

    return (
        <section className="newsletter-cta">
            <div className="section-container cta-container">
                <div className="cta-content">
                    <h2>Join the Elite Setup</h2>
                    <p>Subscribe for exclusive drops or join our VIP WhatsApp community.</p>
                </div>

                <div className="cta-actions">
                    <form onSubmit={handleSubscribe} className="newsletter-form">
                        <input
                            type="email"
                            placeholder="Enter your email address"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                        <button type="submit" className="btn btn-primary">
                            <Send size={18} />
                        </button>
                    </form>

                    <div className="cta-divider">
                        <span>OR</span>
                    </div>

                    <a
                        href="https://wa.me/9647502045634"
                        className="btn whatsapp-btn"
                        target="_blank"
                        rel="noreferrer"
                    >
                        <MessageCircle size={20} />
                        Join WhatsApp
                    </a>
                </div>
            </div>
        </section>
    );
}
