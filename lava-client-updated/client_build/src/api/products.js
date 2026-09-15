import client, { unwrapApiData } from './client';

const normalizeProductList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.products)) return value.products;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

export const productsAPI = {
  async getAll() {
    try {
      const response = await client.get('/products');
      return normalizeProductList(unwrapApiData(response));
    } catch (error) {
      console.error('Failed to load products:', error.message);
      throw new Error(error.response?.data?.message || 'Failed to load products');
    }
  },

  // ===== جلب صفحة منتجات من السيرفر (server-side pagination/filter/sort) =====
  // params: { page, limit, category, search, onSale, isFeatured, minPrice, maxPrice, sizes, color, sortBy, sortDir }
  // بيرجع { items, total, page, pageSize, totalPages }
  async getPage(params = {}) {
    try {
      const response = await client.get('/products', { params });
      const data = unwrapApiData(response);
      if (data && Array.isArray(data.items)) return data;
      // fallback احتياطي لو السيرفر رجع array عادي (مسار قديم)
      return { items: normalizeProductList(data), total: normalizeProductList(data).length, page: 1, pageSize: normalizeProductList(data).length, totalPages: 1 };
    } catch (error) {
      console.error('Failed to load products page:', error.message);
      throw new Error(error.response?.data?.message || 'Failed to load products');
    }
  },

  async getAllAdmin() {
    try {
      const response = await client.get('/products/admin');
      return normalizeProductList(unwrapApiData(response));
    } catch (error) {
      console.error('Failed to load admin products:', error.message);
      throw new Error(error.response?.data?.message || 'Failed to load products');
    }
  },

  async getById(id) {
    try {
      const response = await client.get(`/products/${id}`);
      return unwrapApiData(response);
    } catch (error) {
      console.error('Failed to load product:', error.message);
      throw new Error(error.response?.data?.message || 'Failed to load product');
    }
  },

  async create(productData, images) {
    const formData = new FormData();
    formData.append('data', JSON.stringify(productData));
    
    if (images && images.length > 0) {
      images.forEach((image) => {
        formData.append('images', image);
      });
    }

    const response = await client.post('/products', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return unwrapApiData(response);
  },

  async update(id, productData, images) {
    if (!id) {
      throw new Error('Missing product id for update');
    }
    const formData = new FormData();
    formData.append('data', JSON.stringify(productData));
    
    if (images && images.length > 0) {
      images.forEach((image) => {
        formData.append('images', image);
      });
    }

    const response = await client.put(`/products/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return unwrapApiData(response);
  },

  async remove(id) {
    const response = await client.delete(`/products/${id}`);
    return unwrapApiData(response);
  },

  async uploadVariantImages(productId, variantIndex, images) {
    const formData = new FormData();
    images.forEach((image) => {
      formData.append('images', image);
    });

    const response = await client.post(`/products/${productId}/variants/${variantIndex}/images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return unwrapApiData(response);
  },

  // رفع فيديو المنتج مباشرة على Cloudinary (بدون أي تحويل Base64)
  // بيرجع بيانات الفيديو عشان تتحط في newProdVideo وتترفق مع باقي بيانات المنتج وقت الحفظ
  async uploadVideo(file) {
    const formData = new FormData();
    formData.append('video', file);
    const response = await client.post('/products/video', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrapApiData(response);
  },
};