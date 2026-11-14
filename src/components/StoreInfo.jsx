import React from 'react';
import { Clock, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { STORE_GEO, STORE_MAP_URL } from '../utils/seo';
import { erbilWeekday, maghribTime, STORE_CLOSED_DAYS, STORE_OPEN_DAYS, STORE_OPENS } from '../utils/storeHours';
import { fill } from '../utils/locale';
import { WHATSAPP_DISPLAY, WHATSAPP_NUMBER, whatsappLink } from '../utils/storefront';
import './StoreInfo.css';

const DAY_ORDER = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// "Sunday – Thursday" for a run of days, the single day otherwise.
function dayRange(days, t) {
  const sorted = [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  return sorted.length > 1 ? `${t(sorted[0])} – ${t(sorted.at(-1))}` : t(sorted[0]);
}

// The physical shop: address, opening hours, phone and a map. Used on the home
// page and on landing pages, so a visitor always sees there is a real store.
export default function StoreInfo({ title = 'Visit our store in Erbil' }) {
  const { t } = useLocale();
  // The shop closes at Maghrib, which moves with the seasons: show today's time.
  const openToday = STORE_OPEN_DAYS.includes(erbilWeekday());
  return <section className="store-info" aria-labelledby="store-info-title">
      <div className="section-container store-info-grid">
        <div className="store-info-details">
          <h2 id="store-info-title" className="store-info-title">{t(title)}</h2>
          <p className="store-info-lead">{t('See the products, ask our team and pick up your order, or have it delivered anywhere in Iraq and Kurdistan.')}</p>
          <ul className="store-info-list">
            <li>
              <MapPin size={20} aria-hidden="true" />
              <div>
                <strong>{t('Address')}</strong>
                <span>{t('Muzaffariya Street, Erbil, Kurdistan Region, Iraq')}</span>
              </div>
            </li>
            <li>
              <Clock size={20} aria-hidden="true" />
              <div>
                <strong>{t('Opening hours')}</strong>
                <span>{dayRange(STORE_OPEN_DAYS, t)}: <bdi>{STORE_OPENS}</bdi> – {t('Maghrib prayer')}</span>
                {openToday && <span suppressHydrationWarning>{fill(t('Closes today at {time}'), { time: maghribTime() })}</span>}
                <span>{dayRange(STORE_CLOSED_DAYS, t)}: {t('Closed')}</span>
              </div>
            </li>
            <li>
              <Phone size={20} aria-hidden="true" />
              <div>
                <strong>{t('Phone & WhatsApp')}</strong>
                <a href={`tel:+${WHATSAPP_NUMBER}`}><bdi>{WHATSAPP_DISPLAY}</bdi></a>
              </div>
            </li>
          </ul>
          <div className="store-info-actions">
            <a href={STORE_MAP_URL} className="btn btn-primary" target="_blank" rel="noreferrer"><MapPin size={18} aria-hidden="true" />{t('Open in Google Maps')}</a>
            <a href={whatsappLink()} className="btn btn-secondary" target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" />{t('Chat on WhatsApp')}</a>
          </div>
        </div>
        <div className="store-info-map">
          <iframe title={t('IT Land store location on the map')} src={`https://www.google.com/maps?q=${STORE_GEO.latitude},${STORE_GEO.longitude}&z=16&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
        </div>
      </div>
    </section>;
}
