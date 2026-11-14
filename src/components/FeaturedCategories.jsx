import { useLocale } from '../context/LocaleContext';
import React from 'react';
import { Link } from 'react-router-dom';
import useStoreSettings from '../hooks/useStoreSettings';
import { tileForPath } from '../data/categoryTiles';
import './FeaturedCategories.css';
const SHOP_CATEGORIES = new Set(['Mice', 'Keyboards', 'Headsets', 'Webcams', 'Gaming', 'Accessories', 'Audio', 'Streaming']);
const CATEGORY_ALIASES = {
  mouse: 'Mice',
  mice: 'Mice',
  keyboard: 'Keyboards',
  keyboards: 'Keyboards',
  headset: 'Headsets',
  headsets: 'Headsets',
  webcam: 'Webcams',
  webcams: 'Webcams',
  gaming: 'Gaming',
  'gaming gear': 'Gaming',
  accessories: 'Accessories',
  audio: 'Audio',
  streaming: 'Streaming'
};
const resolveShopCategory = value => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const aliased = CATEGORY_ALIASES[normalized];
  if (aliased && SHOP_CATEGORIES.has(aliased)) {
    return aliased;
  }
  return SHOP_CATEGORIES.has(value) ? value : null;
};
const buildCategoryPath = category => {
  const basePath = category.path || '/products';

  // Keep external or non-shop paths untouched.
  if (!basePath.startsWith('/products')) {
    return basePath;
  }
  const url = new URL(basePath, 'https://example.com');
  if (!url.searchParams.has('category')) {
    const mappedCategory = resolveShopCategory(category.category || category.name);
    if (mappedCategory) {
      url.searchParams.set('category', mappedCategory);
    }
  }
  return `${url.pathname}${url.search}`;
};
// Tiles show a brand's own product photo (no background) on a grey tile, so
// they match what we sell. A tile set in the admin with its own picture keeps it.
// Shown after the tiles managed in the admin.
const MORE_CATEGORIES = [{
  name: 'Video Conferencing',
  path: '/video-conferencing'
}, {
  name: 'Webcams',
  path: '/products?category=Webcams'
}, {
  name: 'Speakers & Audio',
  path: '/products?category=Audio'
}, {
  name: 'Accessories',
  path: '/products?category=Accessories'
}];
// The stock pictures the site shipped with are replaced by the cut-outs.
const isStockPicture = image => !image || image.startsWith('/images/categories/');
export default function FeaturedCategories() {
  const {
    t
  } = useLocale();
  const {
    settings
  } = useStoreSettings();
  const managed = settings?.featuredCategories || [];
  const managedPaths = new Set(managed.map(buildCategoryPath));
  const categories = [...managed, ...MORE_CATEGORIES.filter(category => !managedPaths.has(category.path))].map(category => {
    const path = buildCategoryPath(category);
    return {
      name: category.name,
      path,
      cutout: isStockPicture(category.image) ? tileForPath(path)?.cutout ?? null : null,
      image: category.image
    };
  });
  return <section className="featured-categories" aria-labelledby="featured-categories-title">
            <div className="section-container">
                <h2 id="featured-categories-title" className="section-title">{t("Shop by category")}</h2>
                <div className="category-grid">
                    {categories.map(category => <Link to={category.path} key={category.path + category.name} className={`category-card ${category.cutout ? 'category-card--cutout' : ''}`}>
                            {category.cutout ? <div className="category-bg"><img src={category.cutout} alt="" loading="lazy" decoding="async" /></div> : <div className="category-bg" style={{
            backgroundImage: `url(${category.image})`
          }} />}
                            <h3 className="category-name">{t(category.name)}</h3>
                        </Link>)}
                </div>
            </div>
        </section>;
}
