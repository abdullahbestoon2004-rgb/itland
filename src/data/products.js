export const defaultProducts = [
  {
    id: 1,
    name: "PRO X SUPERLIGHT 2",
    category: "Mice",
    brand: "Logitech",
    price: 159.00,
    description: "Next-gen PRO keyboard. Tenkeyless design with swappable GX switches.",
    images: ["https://resource.logitechg.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/products/pro-x-superlight-2/gallery-5-pro-x-superlight-2-gaming-mouse-black.png?v=1"],
    featured: true,
  },
  {
    id: 2,
    name: "G502 HERO",
    category: "Mice",
    brand: "Logitech",
    price: 49.99,
    description: "High performance gaming mouse with HERO 25K sensor.",
    images: ["https://www.logitechg.com/content/dam/gaming/en/non-braid/hyjal-g502-hero/2025/g502-hero-mouse-top-angle-gallery-1.png"],
    featured: false,
  },
  {
    id: 3,
    name: "PRO X TKL",
    category: "Keyboards",
    brand: "Logitech",
    price: 199.00,
    description: "Wireless mechanical gaming keyboard designed with esports pros.",
    images: ["https://resource.logitechg.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/products/pro-x-tkl/gallery-2-pro-x-tkl-black-lightspeed-gaming-keyboard.png.png"],
    featured: false,
  },
  {
    id: 4,
    name: "PRO X 2 LIGHTSPEED",
    category: "Audio",
    brand: "Logitech",
    price: 249.00,
    description: "Pro-grade wireless gaming headset with 50mm Graphene drivers.",
    images: ["https://resource.logitechg.com/d_transparent.gif/content/dam/gaming/en/products/pro-x-2-lightspeed/gallery/gallery-1-pro-x-2-lightspeed-gaming-headset-black.png"],
    featured: true,
  },
  {
    id: 5,
    name: "G915 LIGHTSPEED",
    category: "Keyboards",
    brand: "Logitech",
    price: 249.99,
    description: "Advanced acoustic engineering with ultra-thin profile.",
    images: ["https://www.logitechg.com/content/dam/gaming/en/products/g915/g915-gallery-2.png"],
    featured: false,
  },
  {
    id: 6,
    name: "YETI GX",
    category: "Streaming",
    brand: "Logitech",
    price: 149.99,
    description: "Dynamic RGB gaming microphone powered by LIGHTSYNC.",
    images: ["https://resource.logitechg.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/plp-microphones/pdp-yeti-gx-gaming-microphone/yeti-gx-gallery-3.png?v=1"],
    featured: false,
  }
];

export const initializeProducts = () => {
  if (!localStorage.getItem('logi_products')) {
    localStorage.setItem('logi_products', JSON.stringify(defaultProducts));
  }
};

export const getAllProducts = () => {
  initializeProducts();
  let products = JSON.parse(localStorage.getItem('logi_products'));

  // Migration logic for legacy products
  let needsSave = false;
  products = products.map(p => {
    if (!p.brand) {
      needsSave = true;
      p.brand = 'Logitech'; // Default brand for existing items
    }
    if (p.image && !p.images) {
      needsSave = true;
      const images = [p.image];
      delete p.image;
      return { ...p, images };
    }
    // Fallback if image is missing entirely
    if (!p.images && !p.image) {
      needsSave = true;
      return { ...p, images: ["https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=600&auto=format&fit=crop"] };
    }
    return p;
  });

  if (needsSave) {
    saveProducts(products);
  }

  return products;
};

export const getFeaturedProduct = () => {
  const products = getAllProducts();
  return products.find(p => p.featured) || products[0];
};

export const saveProducts = (newProducts) => {
  localStorage.setItem('logi_products', JSON.stringify(newProducts));
};
