import { useLocale } from '../context/LocaleContext';
import React from 'react';
import { MessageCircle } from 'lucide-react';
import NewsletterForm from './NewsletterForm';
import { whatsappLink } from '../utils/storefront';
import './NewsletterCTA.css';
export default function NewsletterCTA() {
  const {
    t
  } = useLocale();
  return <section className="newsletter-cta">
            <div className="section-container cta-container">
                <div className="cta-content">
                    <h2>{t("Join the Elite Setup")}</h2>
                    <p>{t("Subscribe for new products and offers, or chat with our team on WhatsApp.")}</p>
                </div>

                <div className="cta-actions">
                    <NewsletterForm />

                    <div className="cta-divider">
                        <span>{t("OR")}</span>
                    </div>

                    <a href={whatsappLink()} className="btn whatsapp-btn" target="_blank" rel="noreferrer">

                        <MessageCircle size={20} />{t("Chat on WhatsApp")}

          </a>
                </div>
            </div>
        </section>;
}
