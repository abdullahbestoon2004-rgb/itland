// The shop's categories with the pictures used for them across the site: a
// brand's own product photo without a background (tiles, the Shop menu) and,
// where there is one, a brand photo of the product in use (category banners).
const logitech = (path, width = 640) => `https://resource.logitech.com/w_${width},c_limit,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/${path}`;
const logitechPhoto = path => `https://resource.logitech.com/w_1400,c_limit,q_auto,f_auto,dpr_1.0/content/dam/logitech/en/${path}`;

export const CATEGORY_TILES = [
  { name: 'Mice', category: 'Mice', path: '/products?category=Mice', cutout: logitech('logitech/en/products/mice/mx-master-4/gallery/mx-master-4-black-top-angle-gallery-1.png'), photo: logitechPhoto('products/mice/mx-anywhere-3/lifestyle-images/mx-anywhere-3s-graphite-person-using-a-wireless-mouse.jpg') },
  { name: 'Keyboards', category: 'Keyboards', path: '/products?category=Keyboards', cutout: logitech('logitech/en/products/combos/mx-keys-s-combo/product-gallery/graphite/mx-keys-s-combo-keyboard-top-view-graphite-us-intl.png'), photo: logitechPhoto('homepage/banners/cards/mx-keys-mini-mx-anywhere3s-laptopstand.jpg') },
  { name: 'Headsets', category: 'Headsets', path: '/products?category=Headsets', cutout: logitech('logitech/en/products/headsets/zone-vibe-100/gallery/zone-vibe-100-gallery-graphite-1.png'), photo: logitechPhoto('homepage/banners/cards/girl-listening-zone300-rose-headset.jpg') },
  { name: 'Webcams', category: 'Webcams', path: '/products?category=Webcams', cutout: logitech('logitech/en/products/webcams/mx-brio/buy/migration-assets-for-delorean-2025/gallery/mx-brio-3qtr-front-right-black.png'), photo: logitechPhoto('products/webcams/mx-brio/learn/mx-brio-intro-video-poster.jpg') },
  { name: 'Video Conferencing', path: '/video-conferencing', cutout: logitech('logitech/en/products/video-conferencing/rally-bar/buy/2026/gallery/rally-bar-front-angle-graphite-gallery-1.png') },
  { name: 'Gaming', category: 'Gaming', path: '/products?category=Gaming', cutout: logitech('gaming/en/products/g502x-plus/2026-update/gallery/g502-x-plus-top-angle-black-gallery-1.png') },
  { name: 'Speakers & Audio', category: 'Audio', path: '/products?category=Audio', cutout: '/product_images/Jabra_Speak2_75_official.webp' },
  { name: 'Accessories', category: 'Accessories', path: '/products?category=Accessories', cutout: logitech('logitech/en/products/presenters/r500s/gallery/r500s-gallery-1.png') },
];

export const tileForPath = path => CATEGORY_TILES.find(tile => tile.path === path) ?? null;
export const tileForCategory = category => CATEGORY_TILES.find(tile => tile.category === category) ?? null;
