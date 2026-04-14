import { isSupabaseConfigured, supabase } from '../lib/supabase';

const SETTINGS_KEY = 'logi_store_settings';
const SITE_SETTINGS_TABLE = 'site_settings';
const SITE_SETTINGS_ROW_ID = 1;
const SETTINGS_UPDATED_EVENT = 'logi-store-settings-updated';

const LEGACY_PROMO_BANNER_IMAGES = [
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop',
];

export const defaultSettings = {
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

let settingsCache = null;
let pendingSettingsRequest = null;

const createDefaultSettings = () => ({
    promoBannerVisible: defaultSettings.promoBannerVisible,
    promoBannerTitle: defaultSettings.promoBannerTitle,
    promoBannerSubtitle: defaultSettings.promoBannerSubtitle,
    promoBannerImage: defaultSettings.promoBannerImage,
    featuredCategories: defaultSettings.featuredCategories.map((category) => ({ ...category })),
});

const normalizeFeaturedCategory = (category, index) => {
    const fallbackCategory = defaultSettings.featuredCategories[index] ?? {
        name: `Category ${index + 1}`,
        image: '',
        path: '/products',
    };

    return {
        name: category?.name || fallbackCategory.name,
        image: category?.image || fallbackCategory.image,
        path: category?.path || fallbackCategory.path,
    };
};

export const normalizeSettings = (settings = {}) => {
    const defaults = createDefaultSettings();
    const usesLegacyPromoImage = LEGACY_PROMO_BANNER_IMAGES.includes(settings.promoBannerImage);

    return {
        promoBannerVisible: settings.promoBannerVisible ?? defaults.promoBannerVisible,
        promoBannerTitle: settings.promoBannerTitle || defaults.promoBannerTitle,
        promoBannerSubtitle: settings.promoBannerSubtitle || defaults.promoBannerSubtitle,
        promoBannerImage: !settings.promoBannerImage || usesLegacyPromoImage
            ? defaults.promoBannerImage
            : settings.promoBannerImage,
        featuredCategories: Array.isArray(settings.featuredCategories) && settings.featuredCategories.length > 0
            ? settings.featuredCategories.map(normalizeFeaturedCategory)
            : defaults.featuredCategories,
    };
};

const persistLocalSettings = (settings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

const readLocalSettings = () => {
    const data = localStorage.getItem(SETTINGS_KEY);

    if (!data) {
        const defaults = createDefaultSettings();
        persistLocalSettings(defaults);
        return defaults;
    }

    try {
        const parsed = JSON.parse(data);
        const normalizedSettings = normalizeSettings(parsed);
        persistLocalSettings(normalizedSettings);
        return normalizedSettings;
    } catch {
        const defaults = createDefaultSettings();
        persistLocalSettings(defaults);
        return defaults;
    }
};

const notifySettingsUpdated = (settings) => {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: settings }));
};

const cacheSettings = (settings, options = {}) => {
    settingsCache = settings;
    persistLocalSettings(settings);

    if (options.notify) {
        notifySettingsUpdated(settings);
    }

    return settings;
};

const mapSettingsToRow = (settings) => ({
    id: SITE_SETTINGS_ROW_ID,
    promo_banner_visible: settings.promoBannerVisible,
    promo_banner_title: settings.promoBannerTitle,
    promo_banner_subtitle: settings.promoBannerSubtitle,
    promo_banner_image: settings.promoBannerImage,
    featured_categories: settings.featuredCategories,
    updated_at: new Date().toISOString(),
});

const mapRowToSettings = (row) => normalizeSettings({
    promoBannerVisible: row?.promo_banner_visible,
    promoBannerTitle: row?.promo_banner_title,
    promoBannerSubtitle: row?.promo_banner_subtitle,
    promoBannerImage: row?.promo_banner_image,
    featuredCategories: row?.featured_categories,
});

const upsertRemoteSettings = async (settings) => {
    const { data, error } = await supabase
        .from(SITE_SETTINGS_TABLE)
        .upsert([mapSettingsToRow(settings)], { onConflict: 'id' })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return mapRowToSettings(data);
};

export const getSettings = () => {
    settingsCache ??= readLocalSettings();
    return settingsCache;
};

export const loadSettings = async () => {
    const localSettings = getSettings();

    if (!isSupabaseConfigured || !supabase) {
        return localSettings;
    }

    if (pendingSettingsRequest) {
        return pendingSettingsRequest;
    }

    pendingSettingsRequest = (async () => {
        const { data, error } = await supabase
            .from(SITE_SETTINGS_TABLE)
            .select('*')
            .eq('id', SITE_SETTINGS_ROW_ID)
            .maybeSingle();

        if (error) {
            console.error('Supabase settings fetch failed, using local data instead.', error);
            return localSettings;
        }

        if (!data) {
            try {
                const createdSettings = await upsertRemoteSettings(localSettings);
                return cacheSettings(createdSettings);
            } catch (upsertError) {
                console.error('Supabase settings initialization failed, using local data instead.', upsertError);
                return localSettings;
            }
        }

        return cacheSettings(mapRowToSettings(data));
    })().finally(() => {
        pendingSettingsRequest = null;
    });

    return pendingSettingsRequest;
};

export const saveSettings = async (settings) => {
    const normalizedSettings = normalizeSettings(settings);
    cacheSettings(normalizedSettings);

    if (!isSupabaseConfigured || !supabase) {
        notifySettingsUpdated(normalizedSettings);
        return normalizedSettings;
    }

    const savedSettings = await upsertRemoteSettings(normalizedSettings);
    return cacheSettings(savedSettings, { notify: true });
};

export const subscribeToSettings = (listener) => {
    if (typeof window === 'undefined') {
        return () => {};
    }

    const handleSettingsUpdated = (event) => {
        listener(event.detail ?? getSettings());
    };

    const handleStorage = (event) => {
        if (event.key !== SETTINGS_KEY) {
            return;
        }

        settingsCache = readLocalSettings();
        listener(settingsCache);
    };

    window.addEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    window.addEventListener('storage', handleStorage);

    return () => {
        window.removeEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
        window.removeEventListener('storage', handleStorage);
    };
};
