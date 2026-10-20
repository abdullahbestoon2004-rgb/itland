import { useLocale } from '../context/LocaleContext';
import React from 'react';
import { ShieldCheck, Truck, MessageCircle, PackageCheck } from 'lucide-react';
import './WhyChooseUs.css';
export default function WhyChooseUs() {
  const {
    t
  } = useLocale();
  const features = [{
    icon: <ShieldCheck size={32} />,
    title: "100% Original",
    subtitle: "Guaranteed authentic"
  }, {
    icon: <Truck size={32} />,
    title: "Across Iraq & Kurdistan",
    subtitle: "Ask us for delivery fees & timing"
  }, {
    icon: <PackageCheck size={32} />,
    title: "Order Confirmation",
    subtitle: "Confirm every detail in the chat"
  }, {
    icon: <MessageCircle size={32} />,
    title: "Order on WhatsApp",
    subtitle: "Talk directly with our team"
  }];
  return <section className="why-choose-us">
            <div className="section-container">
                <div className="features-grid">
                    {features.map((feature, index) => <div key={index} className="feature-item">
                            <div className="feature-icon">{feature.icon}</div>
                            <h4 className="feature-title">{t(feature.title)}</h4>
                            <p className="feature-subtitle">{t(feature.subtitle)}</p>
                        </div>)}
                </div>
            </div>
        </section>;
}
