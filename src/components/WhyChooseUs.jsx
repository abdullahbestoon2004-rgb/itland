import React from 'react';
import { ShieldCheck, Truck, Banknote, Undo, Lock } from 'lucide-react';
import './WhyChooseUs.css';

export default function WhyChooseUs() {
    const features = [
        { icon: <ShieldCheck size={32} />, title: "100% Original", subtitle: "Guaranteed authentic" },
        { icon: <Truck size={32} />, title: "Fast Delivery", subtitle: "Next day shipping" },
        { icon: <Banknote size={32} />, title: "Cash on Delivery", subtitle: "Pay at your door" },
        { icon: <Lock size={32} />, title: "Secure Checkout", subtitle: "Safe payments" }
    ];

    return (
        <section className="why-choose-us">
            <div className="section-container">
                <div className="features-grid">
                    {features.map((feature, index) => (
                        <div key={index} className="feature-item">
                            <div className="feature-icon">{feature.icon}</div>
                            <h4 className="feature-title">{feature.title}</h4>
                            <p className="feature-subtitle">{feature.subtitle}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
