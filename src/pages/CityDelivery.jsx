import React, { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import usePageMeta from '../hooks/usePageMeta';
import { useLocale } from '../context/LocaleContext';
import { usePageData } from '../context/PageDataContext';
import { getAllProducts } from '../data/products';
import { CITIES, DELIVERY_PATH, cityBySlug, cityPath } from '../data/cities';
import { helpContent } from '../data/help';
import { breadcrumbs, SITE_URL } from '../utils/seo';
import { fill } from '../utils/locale';
import { homeProducts, shopDay, whatsappLink } from '../utils/storefront';
import FeaturedCategories from '../components/FeaturedCategories';
import ProductCard from '../components/ProductCard';
import ProductDetailsModal from '../components/ProductDetailsModal';
import StoreInfo from '../components/StoreInfo';
import NotFound from './NotFound';
import './InfoPage.css';
import './CityDelivery.css';

const INTROS = {
    erbil: 'IT Land is on Muzaffariya Street in Erbil. Visit the store to see the products and pick up your order, or have it delivered anywhere in the city.',
    kurdistan: 'IT Land delivers original Logitech, Jabra and Poly products to {city} and the rest of the Kurdistan Region from our store on Muzaffariya Street in Erbil.',
    iraq: 'IT Land delivers original Logitech, Jabra and Poly products to {city} and every governorate of Iraq from our store in Erbil.',
};
const QUESTIONS = [
    ['Does IT Land deliver to {city}?', 'Yes. We deliver to {city} and every other city in Iraq and the Kurdistan Region from our store in Erbil.'],
    ['How much is delivery to {city}, and how long does it take?', 'The fee and the delivery time depend on your area. Send us your address on WhatsApp and we confirm both before your order is final.'],
    ['How do I order from {city}?', 'Add the products to your cart and send the order on WhatsApp, or message us the product name. We reply with the price in IQD and the delivery details.'],
    ['Are the products original?', 'Yes. IT Land sells original Logitech, Jabra and Poly products, and our team can confirm the warranty for your exact model before you order.'],
];

// One page per city the shop delivers to: what is in stock now, how to order
// from that city, and answers to the delivery questions people ask.
export default function CityDelivery() {
    const { t } = useLocale();
    const { city: slug } = useParams();
    const { handleAddToCart } = useOutletContext();
    const initial = usePageData();
    const [products, setProducts] = useState(initial.products ?? []);
    const [day, setDay] = useState(initial.day ?? shopDay());
    const [preview, setPreview] = useState(null);
    useEffect(() => {
        let ignore = false;
        getAllProducts().then(next => { if (!ignore) { setProducts(next); setDay(shopDay()); } }).catch(error => console.error(error));
        return () => { ignore = true; };
    }, []);

    const city = cityBySlug(slug);
    const name = city ? t(city.name) : '';
    const say = text => fill(t(text), { city: name });
    const path = city ? cityPath(city) : undefined;
    usePageMeta({
        title: city ? say('Computer Accessories in {city}: Logitech, Jabra & Poly') : 'Page not found',
        description: city ? say('Buy original Logitech, Jabra and Poly mice, keyboards, headsets and webcams in {city}. IT Land delivers from its Erbil store. Order on WhatsApp.') : undefined,
        path,
        noindex: !city,
        jsonLd: city ? [
            { '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${SITE_URL}${path}#page`, url: `${SITE_URL}${path}`, name: say('Computer accessories delivered to {city}'), about: { '@id': `${SITE_URL}/#store` }, spatialCoverage: { '@type': 'City', name: city.name, containedInPlace: { '@type': 'Country', name: 'Iraq' } } },
            breadcrumbs(['Delivery', DELIVERY_PATH], [city.name, path]),
            { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: QUESTIONS.map(([question, answer]) => ({ '@type': 'Question', name: say(question), acceptedAnswer: { '@type': 'Answer', text: say(answer) } })) },
        ] : undefined,
    });
    if (!city) return <NotFound />;

    // Each city shows its own selection, and it changes daily like the home page's.
    const picks = homeProducts(products, day + (CITIES.indexOf(city) + 1) * 3).products;
    const others = CITIES.filter(other => other !== city);
    return <div className="info-page city-page">
        <header className="info-hero">
            <nav className="city-breadcrumb" aria-label="Breadcrumb">
                <Link to="/">{t('Home')}</Link><span aria-hidden="true">›</span>
                <Link to={DELIVERY_PATH}>{t('Delivery')}</Link><span aria-hidden="true">›</span>
                <span>{name}</span>
            </nav>
            <h1>{say('Computer accessories delivered to {city}')}</h1>
            <p>{say(INTROS[city.slug] ?? INTROS[city.region])}</p>
            <p>{say('Choose your products, send the order on WhatsApp, and our team confirms the stock, the delivery fee and the delivery time for {city}.')}</p>
            <a href={whatsappLink(`Hello IT Land! I would like to order with delivery to ${city.name}.`)} className="btn btn-primary" target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" />{say('Order for {city} on WhatsApp')}</a>
        </header>

        {picks.length > 0 && <section className="city-products" aria-labelledby="city-products-title">
            <div className="section-header section-header-row">
                <h2 id="city-products-title" className="section-title">{say('In stock now, ready to send to {city}')}</h2>
                <Link to="/products" className="view-all-link">{t('View All Products')}</Link>
            </div>
            <div className="products-grid">
                {picks.map(product => <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} onImageClick={setPreview} />)}
            </div>
        </section>}

        <FeaturedCategories />

        <section className="info-split">
            <h2>{say('How to order from {city}')}</h2>
            <dl className="info-list">
                {helpContent.delivery.sections.map(([title, text]) => <div key={title}><dt>{t(title)}</dt><dd>{t(text)}</dd></div>)}
            </dl>
        </section>

        <section className="info-split">
            <h2>{say('Questions about delivery to {city}')}</h2>
            <dl className="info-list">
                {QUESTIONS.map(([question, answer]) => <div key={question}><dt>{say(question)}</dt><dd>{say(answer)}</dd></div>)}
            </dl>
        </section>

        <section className="info-split">
            <h2>{t('Other cities we deliver to')}</h2>
            <div className="city-groups">
                {[['Kurdistan Region', 'kurdistan'], ['Rest of Iraq', 'iraq']].map(([label, region]) => <div key={region}>
                    <h3>{t(label)}</h3>
                    <ul className="city-list">
                        {others.filter(other => other.region === region).map(other => <li key={other.slug}><Link to={cityPath(other)}>{t(other.name)}</Link></li>)}
                    </ul>
                </div>)}
            </div>
        </section>

        <StoreInfo />
        <ProductDetailsModal key={preview?.id ?? 'no-product'} product={preview} onClose={() => setPreview(null)} onAddToCart={handleAddToCart} />
    </div>;
}
