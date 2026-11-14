import usePageMeta from '../hooks/usePageMeta';
import { useLocale } from '../context/LocaleContext';
import { breadcrumbs, SITE_URL, storeBusiness } from '../utils/seo';
import React from 'react';
import { Link } from 'react-router-dom';
import StoreInfo from '../components/StoreInfo';
import './InfoPage.css';

const pageSchema = () => [{ '@context': 'https://schema.org', '@type': 'AboutPage', '@id': `${SITE_URL}/about#page`, url: `${SITE_URL}/about`, name: 'About IT Land', about: { '@id': `${SITE_URL}/#store` } }, storeBusiness(), breadcrumbs(['About', '/about'])];

// Logitech's own photo of products the shop sells, from Logitech's image CDN.
const DESK_PHOTO = 'https://resource.logitech.com/w_1800,c_limit,q_auto,f_auto,dpr_1.0/content/dam/logitech/en/homepage/banners/cards/mx-keys-mini-mx-anywhere3s-laptopstand.jpg';

const REASONS = [
    { id: 'wcu-quality', title: 'High quality products', text: 'We exclusively carry trusted brands, hand-selected for build quality, durability, and performance.' },
    { id: 'wcu-delivery', title: 'Delivery everywhere', text: 'Delivery across all Iraq and Kurdistan. Confirm delivery fees and estimated arrival times on WhatsApp.' },
    { id: 'wcu-support', title: 'Customer support', text: 'Reach us instantly via WhatsApp. Real people, real answers, no bots and no delays.' },
    { id: 'wcu-warranty', title: 'Warranty and trust', text: 'Ask our team to confirm the warranty coverage and return terms for your exact product before ordering.' },
];

export default function About() {
    const { t } = useLocale();
    usePageMeta({
        title: t('About Us: Computer Accessories Store in Erbil'),
        description: t('IT Land is a computer accessories store on Muzaffariya Street, Erbil, selling original Logitech, Jabra and Poly products to homes, offices and resellers.'),
        path: '/about',
        jsonLd: pageSchema(),
    });
    return (
        <div className="info-page">
            <header className="info-hero">
                <h1>{t('About IT Land')}</h1>
                <p>{t('A computer accessories store in Erbil, selling original Logitech, Jabra and Poly products to homes, offices and resellers across Iraq.')}</p>
            </header>

            <figure className="info-photo">
                <img src={DESK_PHOTO} alt={t('A desk with a Logitech MX Keys Mini keyboard, an MX Anywhere 3S mouse and a laptop on a stand')} />
            </figure>

            <section className="info-split">
                <h2>{t('Our story')}</h2>
                <div className="info-prose">
                    <p>{t('ITLand ForComputer was created to bring high-quality technology products to customers who value performance, design, and reliability. We focus on premium brands like Logitech and carefully selected accessories that enhance your daily workflow, gaming, and productivity.')}</p>
                    <p>{t('Based in Erbil, Iraq, we understand what local customers need: fast delivery, honest support, and gear you can trust. Every product in our store has been personally reviewed for quality before it reaches your hands.')}</p>
                </div>
            </section>

            <section className="info-split">
                <h2>{t('Why choose us')}</h2>
                <dl className="info-list">
                    {REASONS.map((reason) => (
                        <div key={reason.id} id={reason.id}>
                            <dt>{t(reason.title)}</dt>
                            <dd>{t(reason.text)}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            <section className="info-statement">
                <h2>{t('We aim to become the go-to destination for premium tech in Iraq.')}</h2>
                <p>{t('Our mission is to make world-class technology accessible, affordable, and delivered with care right here in Iraq.')}</p>
                <Link to="/products" className="btn btn-primary" id="about-shop-btn">{t('Shop Now')}</Link>
            </section>

            <StoreInfo />
        </div>
    );
}
