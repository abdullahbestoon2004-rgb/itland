const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=600&auto=format&fit=crop';

const normalizeProduct = (product, index = 0) => ({
  id: product.id ?? product.zoho_item_id ?? index,
  zoho_item_id: product.zoho_item_id ?? null,
  name: product.name ?? '',
  category: product.category ?? 'Accessories',
  brand: product.brand ?? '',
  price: Number(product.price ?? 0),
  wholesale_price: product.wholesale_price != null ? Number(product.wholesale_price) : null,
  description: product.description ?? '',
  images: Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : [PLACEHOLDER_IMAGE],
  featured: Boolean(product.featured),
  order_index: product.order_index ?? index,
});

export const getAllProducts = async () => {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const { products } = await res.json();
    return (products ?? []).map((p, i) => normalizeProduct(p, i));
  } catch (err) {
    console.error('Failed to load products from API:', err);
    return [];
  }
};

// These are kept for the admin dashboard's manual product additions.
// Products managed in Zoho Books do not go through these functions.

export const saveProduct = async () => {
  throw new Error('Products are managed in Zoho Books.');
};

export const deleteProduct = async () => {
  throw new Error('Products are managed in Zoho Books.');
};

export const saveProductOrder = async () => {
  // No-op: order comes from Zoho item list order.
};
