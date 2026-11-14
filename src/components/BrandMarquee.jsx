import React from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { brandPath, brandSlug } from '../utils/seo';
import './BrandMarquee.css';

// Logo files in public/images/brands, keyed by brand slug. A brand without one
// is shown as its name in the heading font.
const LOGO_FILES = {
  acer: 'acer', anker: 'anker', apple: 'apple', asus: 'asus', dell: 'dell', elgato: 'elgato',
  hikvision: 'hikvision', hp: 'hp', jabra: 'jabra', jbl: 'jbl', lenovo: 'lenovo', logitech: 'logitech',
  msi: 'msi', poly: 'poly', razer: 'razer', redragon: 'redragon', samsung: 'samsung', sandisk: 'sandisk',
  sony: 'sony', steelseries: 'steelseries', 'tp-link': 'tplink', wd: 'westerndigital', 'western-digital': 'westerndigital'
};

// Brands with the most products come first, so the strip opens on what the shop mostly sells.
function brandsByProductCount(products) {
  const counts = new Map();
  for (const product of products) {
    if (product.brand) counts.set(product.brand, (counts.get(product.brand) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([brand]) => brand);
}

function BrandItems({ brands, hidden = false }) {
  return <ul className="brand-marquee-track" aria-hidden={hidden || undefined}>
      {brands.map(brand => {
      const logo = LOGO_FILES[brandSlug(brand)];
      return <li key={brand}>
            <Link to={brandPath(brand)} className="brand-marquee-item" tabIndex={hidden ? -1 : undefined} aria-label={hidden ? undefined : brand}>
              {logo ? <img src={`/images/brands/${logo}.svg`} alt={hidden ? '' : brand} decoding="async" /> : <span className="brand-marquee-name">{brand}</span>}
            </Link>
          </li>;
    })}
    </ul>;
}

// One line of brand logos drifting from right to left. The list is rendered
// twice so the second copy fills in as the first slides out, which makes the
// loop seamless; the copy is hidden from screen readers and the keyboard.
export default function BrandMarquee({ products }) {
  const { t } = useLocale();
  const brands = brandsByProductCount(products);
  if (brands.length === 0) return null;
  return <section className="brand-marquee" aria-label="Shop by brand">
      <h2 className="brand-marquee-title">{t('Brands')}</h2>
      <div className="brand-marquee-viewport" style={{ '--brand-marquee-duration': `${Math.max(20, brands.length * 3)}s` }}>
        <BrandItems brands={brands} />
        <BrandItems brands={brands} hidden />
      </div>
    </section>;
}
