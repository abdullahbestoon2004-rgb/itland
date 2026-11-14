// The cities the shop delivers to, each with its own page (/delivery/baghdad).
// Names are shown through t(), so the Arabic and Kurdish ones live in
// translations.json. `region` decides which sentence introduces the city.
export const CITIES = [
    // Kurdistan Region
    { slug: 'erbil', name: 'Erbil', region: 'kurdistan' },
    { slug: 'sulaymaniyah', name: 'Sulaymaniyah', region: 'kurdistan' },
    { slug: 'duhok', name: 'Duhok', region: 'kurdistan' },
    { slug: 'halabja', name: 'Halabja', region: 'kurdistan' },
    { slug: 'zakho', name: 'Zakho', region: 'kurdistan' },
    { slug: 'soran', name: 'Soran', region: 'kurdistan' },
    { slug: 'koya', name: 'Koya', region: 'kurdistan' },
    { slug: 'shaqlawa', name: 'Shaqlawa', region: 'kurdistan' },
    { slug: 'ranya', name: 'Ranya', region: 'kurdistan' },
    { slug: 'qaladze', name: 'Qaladze', region: 'kurdistan' },
    { slug: 'kalar', name: 'Kalar', region: 'kurdistan' },
    { slug: 'chamchamal', name: 'Chamchamal', region: 'kurdistan' },
    { slug: 'darbandikhan', name: 'Darbandikhan', region: 'kurdistan' },
    { slug: 'akre', name: 'Akre', region: 'kurdistan' },
    { slug: 'amedi', name: 'Amedi', region: 'kurdistan' },
    // The rest of Iraq
    { slug: 'baghdad', name: 'Baghdad', region: 'iraq' },
    { slug: 'basra', name: 'Basra', region: 'iraq' },
    { slug: 'mosul', name: 'Mosul', region: 'iraq' },
    { slug: 'kirkuk', name: 'Kirkuk', region: 'iraq' },
    { slug: 'najaf', name: 'Najaf', region: 'iraq' },
    { slug: 'karbala', name: 'Karbala', region: 'iraq' },
    { slug: 'hillah', name: 'Hillah', region: 'iraq' },
    { slug: 'ramadi', name: 'Ramadi', region: 'iraq' },
    { slug: 'fallujah', name: 'Fallujah', region: 'iraq' },
    { slug: 'baqubah', name: 'Baqubah', region: 'iraq' },
    { slug: 'khanaqin', name: 'Khanaqin', region: 'iraq' },
    { slug: 'tikrit', name: 'Tikrit', region: 'iraq' },
    { slug: 'samarra', name: 'Samarra', region: 'iraq' },
    { slug: 'kut', name: 'Kut', region: 'iraq' },
    { slug: 'amarah', name: 'Amarah', region: 'iraq' },
    { slug: 'nasiriyah', name: 'Nasiriyah', region: 'iraq' },
    { slug: 'samawah', name: 'Samawah', region: 'iraq' },
    { slug: 'diwaniyah', name: 'Diwaniyah', region: 'iraq' },
];

// The cities named in the footer and on every product page.
export const TOP_CITIES = ['baghdad', 'basra', 'mosul', 'erbil', 'sulaymaniyah', 'duhok'].map(slug => CITIES.find(city => city.slug === slug));
export const DELIVERY_PATH = '/help/delivery';
export const cityPath = city => `/delivery/${city.slug}`;
export const cityBySlug = slug => CITIES.find(city => city.slug === slug) ?? null;
