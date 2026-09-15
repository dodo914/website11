const NodeCache = require('node-cache');

// Cache configuration
const cache = new NodeCache({
  stdTTL: 60, // Default TTL: 60 seconds
  checkperiod: 120, // Check for expired keys every 120 seconds
  maxKeys: 1000, // Maximum number of keys
});

// Cache TTL configurations (in seconds)
const CACHE_TTL = {
  PRODUCTS: 60, // 1 minute
  PRODUCT_DETAIL: 120, // 2 minutes
  CATEGORIES: 300, // 5 minutes
  SETTINGS_PUBLIC: 180, // 3 minutes
  SETTINGS_ADMIN: 180, // 3 minutes
  SETTINGS_PIXELS: 300, // 5 minutes
  REVIEWS: 120, // 2 minutes
  FEATURED_PRODUCTS: 120, // 2 minutes
};

// Cache keys
const CACHE_KEYS = {
  PRODUCTS: 'products:public',
  PRODUCT_ADMIN: 'products:admin',
  PRODUCT_DETAIL: (id) => `product:${id}`,
  CATEGORIES: 'settings:categories',
  SETTINGS_PUBLIC: 'settings:public',
  SETTINGS_ADMIN: 'settings:admin',
  SETTINGS_PIXELS: 'settings:pixels',
  REVIEWS: (productId) => `reviews:${productId}`,
  FEATURED_PRODUCTS: 'products:featured',
};

// Helper functions
const get = (key) => {
  try {
    return cache.get(key);
  } catch (err) {
    console.error('Cache get error:', err);
    return null;
  }
};

const set = (key, value, ttl) => {
  try {
    cache.set(key, value, ttl);
  } catch (err) {
    console.error('Cache set error:', err);
  }
};

const del = (key) => {
  try {
    cache.del(key);
  } catch (err) {
    console.error('Cache delete error:', err);
  }
};

const flush = () => {
  try {
    cache.flushAll();
  } catch (err) {
    console.error('Cache flush error:', err);
  }
};

// Invalidate product-related caches
const invalidateProductCaches = () => {
  try {
    cache.keys().forEach((key) => {
      if (key.startsWith('product:') || key.startsWith('products:') || key.startsWith('featured')) {
        del(key);
      }
    });
  } catch (err) {
    console.error('Product cache invalidation error:', err.message);
  }
};

// Invalidate settings caches
const invalidateSettingsCaches = () => {
  del(CACHE_KEYS.SETTINGS_PUBLIC);
  del(CACHE_KEYS.SETTINGS_ADMIN);
  del(CACHE_KEYS.SETTINGS_PIXELS);
  del(CACHE_KEYS.CATEGORIES);
};

// Invalidate review caches
const invalidateReviewCaches = (productId) => {
  if (productId) {
    del(CACHE_KEYS.REVIEWS(productId));
  } else {
    // Invalidate all review caches
    cache.keys().forEach(key => {
      if (key.startsWith('reviews:')) {
        del(key);
      }
    });
  }
};

module.exports = {
  cache,
  CACHE_TTL,
  CACHE_KEYS,
  get,
  set,
  del,
  flush,
  invalidateProductCaches,
  invalidateSettingsCaches,
  invalidateReviewCaches,
};