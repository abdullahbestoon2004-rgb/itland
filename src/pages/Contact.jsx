import { breadcrumbs, SITE_URL, STORE_MAP_URL, storeBusiness } from '../utils/seo';
import usePageMeta from '../hooks/usePageMeta';
import { useLocale } from '../context/LocaleContext';
import React from 'react';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import StoreInfo from '../components/StoreInfo';
import './InfoPage.css';

const PAGE_SCHEMA = [{ '@context': 'https://schema.org', '@type': 'ContactPage', '@id': `${SITE_URL}/contact#page`, url: `${SITE_URL}/contact`, name: 'Contact IT Land', mainEntity: { '@id': `${SITE_URL}/#store` } }, storeBusiness, breadcrumbs(['Contact', '/contact'])];

const CONTACT_CARDS = [
    { id: 'contact-whatsapp', icon: <MessageCircle size={26} />, label: 'WhatsApp', value: '07504888570', note: 'The fastest way to order or ask a question.', href: 'https://wa.me/9647504888570', external: true },
    { id: 'contact-phone', icon: <Phone size={26} />, label: 'Phone', value: '07504888570', note: 'During opening hours.', href: 'tel:+9647504888570' },
    { id: 'contact-email', icon: <Mail size={26} />, label: 'Email', value: 'info@itlandforcomputer.com', note: 'For quotes and company orders.', href: 'mailto:info@itlandforcomputer.com' },
    { id: 'contact-location', icon: <MapPin size={26} />, label: 'Store', value: 'Muzaffariya Street, Erbil', note: 'Open in Google Maps.', href: STORE_MAP_URL, external: true },
];

export default function Contact() {
    const { t } = useLocale();
    usePageMeta({ title: t('Contact & Store Location in Erbil'), description: t('Visit IT Land (iTland For Computer) on Muzaffariya Street, Erbil, or contact us on WhatsApp at 0750 488 8570. Open Saturday to Thursday; closed Friday.'), path: '/contact', jsonLd: PAGE_SCHEMA });
    return (
        <div className="info-page">
            <header className="info-hero">
                <h1>{t('Contact us')}</h1>
                <p>{t('Delivery across all Iraq and Kurdistan. Ask on WhatsApp for fees and delivery times.')}</p>
            </header>

            <section className="info-cards" aria-label={t('Ways to reach us')}>
                {CONTACT_CARDS.map((card) => (
                    <a key={card.id} id={card.id} href={card.href} className="info-card" target={card.external ? '_blank' : undefined} rel={card.external ? 'noreferrer' : undefined}>
                        {card.icon}
                        <span className="info-card-label">{t(card.label)}</span>
                        <strong><bdi>{t(card.value)}</bdi></strong>
                        <span className="info-card-note">{t(card.note)}</span>
                    </a>
                ))}
            </section>

            <StoreInfo title="Visit our store in Erbil" />

            <section className="info-statement">
                <h2>{t('Prefer to chat?')}</h2>
                <p>{t('Send us the product name or a photo and we will reply with the price and availability.')}</p>
                <a href="https://wa.me/9647504888570" className="btn btn-primary" target="_blank" rel="noreferrer" id="contact-wa-btn"><MessageCircle size={18} aria-hidden="true" />{t('Chat on WhatsApp')}</a>
            </section>
        </div>
    );
}
