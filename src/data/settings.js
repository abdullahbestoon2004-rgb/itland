const SETTINGS_KEY = 'logi_store_settings';

const LEGACY_PROMO_BANNER_IMAGES = [
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop',
];

const defaultSettings = {
    promoBannerVisible: true,
    promoBannerTitle: 'Up to 30% OFF Gaming Accessories',
    promoBannerSubtitle: 'Level up your gameplay with premium gear at unbeatable prices.',
    promoBannerImage: 'https://images.unsplash.com/photo-1717283413190-d4551453b92a?fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=3000',
    featuredCategories: [
        { name: 'Gaming Gear', image: 'https://resource.logitechg.com/w_776,h_437,ar_16:9,c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/ghub-update/2025/g-hub-tips-and-tricks-5.jpg', path: '/products' },
        { name: 'Keyboards', image: 'https://www.cnet.com/a/img/resize/f2ae5397b2da3754b3a3ceccd051452d6e102a71/hub/2025/02/25/f0d07227-6eaa-49e3-bf8a-09fec28c1ac3/logitech-pop-icon-keys.jpg?auto=webp&fit=crop&height=1200&width=1200', path: '/products' },
        { name: 'Mice', image: 'https://media.wired.com/photos/65394d5de1bb680c1c7a7a11/master/w_1600%2Cc_limit/Logitech-POP-Mice-Gear.jpg', path: '/products' },
        { name: 'Headsets', image: 'https://store.alnabaa.com/cdn/shop/files/1684885584_1763226.jpg?v=1716797196', path: '/products' },
    ],
};

export const getSettings = () => {
    const data = localStorage.getItem(SETTINGS_KEY);

    if (!data) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings));
        return defaultSettings;
    }

    try {
        const parsed = JSON.parse(data);

        if (parsed.promoBannerVisible === undefined) parsed.promoBannerVisible = true;
        if (!parsed.promoBannerTitle) parsed.promoBannerTitle = defaultSettings.promoBannerTitle;
        if (!parsed.promoBannerSubtitle) parsed.promoBannerSubtitle = defaultSettings.promoBannerSubtitle;

        const usesLegacyPromoImage = LEGACY_PROMO_BANNER_IMAGES.includes(parsed.promoBannerImage);
        if (!parsed.promoBannerImage || usesLegacyPromoImage) {
            parsed.promoBannerImage = defaultSettings.promoBannerImage;
        }

        if (!parsed.featuredCategories) parsed.featuredCategories = defaultSettings.featuredCategories;

        return { ...defaultSettings, ...parsed };
    } catch {
        return defaultSettings;
    }
};

export const saveSettings = (settings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};
