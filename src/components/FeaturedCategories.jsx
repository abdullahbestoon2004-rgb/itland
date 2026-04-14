import React from 'react';
import { Link } from 'react-router-dom';
import useStoreSettings from '../hooks/useStoreSettings';
import './FeaturedCategories.css';

const SHOP_CATEGORIES = new Set([
    'Mice',
    'Keyboards',
    'Headsets',
    'Webcams',
    'Gaming',
    'Accessories',
    'Audio',
    'Streaming',
]);

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
    streaming: 'Streaming',
};

const resolveShopCategory = (value) => {
    if (!value) return null;

    const normalized = value.trim().toLowerCase();
    const aliased = CATEGORY_ALIASES[normalized];
    if (aliased && SHOP_CATEGORIES.has(aliased)) {
        return aliased;
    }

    return SHOP_CATEGORIES.has(value) ? value : null;
};

const buildCategoryPath = (category) => {
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

export default function FeaturedCategories() {
    const { settings } = useStoreSettings();
    const categories = settings?.featuredCategories || [];

    return (
        <section className="featured-categories">
            <div className="section-container">
                <div className="category-grid">
                    {categories.map((category, index) => (
                        <Link to={buildCategoryPath(category)} key={index} className="category-card">
                            <div className="category-bg" style={{ backgroundImage: `url(${category.image})` }} />
                            <div className="category-overlay" />
                            <h3 className="category-name">{category.name}</h3>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
