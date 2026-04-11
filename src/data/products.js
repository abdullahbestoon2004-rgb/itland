import { isSupabaseConfigured, supabase } from '../lib/supabase';

const PRODUCTS_STORAGE_KEY = 'logi_products';

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

const normalizeProduct = (product, index = 0) => ({
  id: product.id,
  name: product.name ?? '',
  category: product.category ?? 'Accessories',
  brand: product.brand ?? 'Logitech',
  price: Number(product.price ?? 0),
  description: product.description ?? '',
  images: Array.isArray(product.images)
    ? product.images
    : product.image
      ? [product.image]
      : ["https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=600&auto=format&fit=crop"],
  featured: Boolean(product.featured),
  order_index: product.order_index ?? index,
});

const initializeProducts = () => {
  if (!localStorage.getItem(PRODUCTS_STORAGE_KEY)) {
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(defaultProducts));
  }
};

const getLocalProducts = () => {
  initializeProducts();
  let products = JSON.parse(localStorage.getItem(PRODUCTS_STORAGE_KEY));

  let needsSave = false;
  products = products.map((p, index) => {
    if (!p.brand) {
      needsSave = true;
      p.brand = 'Logitech';
    }
    if (p.image && !p.images) {
      needsSave = true;
      const images = [p.image];
      delete p.image;
      return normalizeProduct({ ...p, images }, index);
    }
    if (!p.images && !p.image) {
      needsSave = true;
      return normalizeProduct(p, index);
    }
    return normalizeProduct(p, index);
  });

  if (needsSave) {
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
  }

  return products;
};

const saveLocalProducts = (newProducts) => {
  localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(newProducts));
};

const mapProductToRow = (product, index = 0) => ({
  ...(product.id ? { id: product.id } : {}),
  name: product.name,
  category: product.category,
  brand: product.brand,
  price: Number(product.price ?? 0),
  description: product.description,
  images: product.images ?? [],
  featured: Boolean(product.featured),
  order_index: index,
});
 
export const getAllProducts = async () => {
  if (!isSupabaseConfigured || !supabase) {
    return getLocalProducts();
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('order_index', { ascending: true })
    .order('id', { ascending: false });

  if (error) {
    console.error('Supabase fetch failed, using local data instead.', error);
    return getLocalProducts();
  }

  return (data ?? []).map((product, index) => normalizeProduct(product, index));
};

export const saveProduct = async (product) => {
  const normalizedProduct = normalizeProduct(product);

  if (!isSupabaseConfigured || !supabase) {
    const existingProducts = getLocalProducts();
    const hasExistingProduct = existingProducts.some((item) => item.id === normalizedProduct.id);
    const productToSave = hasExistingProduct
      ? normalizedProduct
      : { ...normalizedProduct, id: normalizedProduct.id ?? Date.now() };

    const updatedProducts = hasExistingProduct
      ? existingProducts.map((item) => item.id === productToSave.id ? productToSave : item)
      : [...existingProducts, productToSave];

    saveLocalProducts(updatedProducts.map((item, index) => normalizeProduct(item, index)));
    return productToSave;
  }

  const { data, error } = await supabase
    .from('products')
    .upsert([mapProductToRow(normalizedProduct, normalizedProduct.order_index)], { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return normalizeProduct(data);
};

export const deleteProduct = async (productId) => {
  if (!isSupabaseConfigured || !supabase) {
    const updatedProducts = getLocalProducts().filter((product) => product.id !== productId);
    saveLocalProducts(updatedProducts.map((product, index) => normalizeProduct(product, index)));
    return;
  }

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) {
    throw error;
  }
};

export const saveProductOrder = async (products) => {
  const normalizedProducts = products.map((product, index) => normalizeProduct(product, index));

  if (!isSupabaseConfigured || !supabase) {
    saveLocalProducts(normalizedProducts);
    return normalizedProducts;
  }

  const updates = normalizedProducts
    .filter((product) => product.id !== undefined && product.id !== null)
    .map((product, index) => (
      supabase
        .from('products')
        .update({ order_index: index })
        .eq('id', product.id)
    ));

  const results = await Promise.all(updates);
  const failedUpdate = results.find(({ error }) => error);

  if (failedUpdate?.error) {
    throw failedUpdate.error;
  }

  return normalizedProducts;
};
