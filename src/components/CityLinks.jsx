import React from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { DELIVERY_PATH, TOP_CITIES, cityPath } from '../data/cities';
import '../pages/CityDelivery.css';

// "We deliver to: Baghdad · Basra · Mosul · ..." with a link to each city's page.
export default function CityLinks({ className = '' }) {
    const { t } = useLocale();
    return <p className={`city-links ${className}`}>
        <span>{t('We deliver to')}:</span>
        {TOP_CITIES.map(city => <Link key={city.slug} to={cityPath(city)}>{t(city.name)}</Link>)}
        <Link to={`${DELIVERY_PATH}#cities`}>{t('All cities')}</Link>
    </p>;
}
