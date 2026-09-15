const mongoose = require('mongoose');

const sizeStockSchema = new mongoose.Schema({
  size: String,
  sku: String,
  stock: { type: Number, default: 0 },
}, { _id: false });

const imageSchema = new mongoose.Schema({
  url: String,
  secureUrl: String,
  publicId: String,
  assetId: String,
  width: Number,
  height: Number,
  format: String,
}, { _id: false });

const videoSchema = new mongoose.Schema({
  url: String,
  secureUrl: String,
  publicId: String,
  assetId: String,
  width: Number,
  height: Number,
  format: String,
  duration: Number,
}, { _id: false });

const variantSchema = new mongoose.Schema({
  id: String,
  color: {
    ar: String,
    en: String,
  },
  hex: String,
  images: [imageSchema],
  sizeStock: [sizeStockSchema],
});

const offerSchema = new mongoose.Schema({
  id: String,
  name: String,
  type: String,
  minQty: Number,
  discountPercent: Number,
  percentage: Number,
  fixedAmount: Number,
  buyQty: Number,
  freeQty: Number,
  active: { type: Boolean, default: true },
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: { ar: String, en: String },
  description: { ar: String, en: String },
  price: { type: Number, required: true },
  costPrice: { type: Number },
  onSale: { type: Boolean, default: false },
  salePrice: { type: Number, default: null },
  permanentSalePrice: { type: Number, default: null },
  isFeatured: { type: Boolean, default: false },
  images: [imageSchema],
  video: videoSchema,
  sizes: [String],
  colors: [String],
  variants: [variantSchema],
  category: { ar: String, en: String },
  googleProductCategory: { ar: String, en: String },
  gtin: String,
  barcode: String,
  visibility: { type: String, enum: ['published', 'hidden', 'draft'], default: 'published' },
  enableRecommendations: { type: Boolean, default: true },
  enableBundle: { type: Boolean, default: true },
  enableReviews: { type: Boolean, default: true },
  lowStockThreshold: { type: Number, default: null },
  slug: String,
  metaTitle: { ar: String, en: String },
  metaDescription: { ar: String, en: String },
  metaKeywords: { ar: String, en: String },
  recommendedIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  bundle: {
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    discountPercent: { type: Number, default: 0 },
  },
  offers: [offerSchema],
}, { 
  timestamps: true,
  toJSON: { virtuals: false },
  toObject: { virtuals: false },
});

// Indexes for common queries
productSchema.index({ visibility: 1, createdAt: -1 });
productSchema.index({ isFeatured: 1, visibility: 1 });
productSchema.index({ category: 1, visibility: 1 });
productSchema.index({ onSale: 1, visibility: 1 });
productSchema.index({ 'variants.sizeStock.size': 1 });
productSchema.index({ slug: 1 });
productSchema.index({ 'variants.id': 1 });
productSchema.index({ 'variants.sizeStock.sku': 1 });

module.exports = mongoose.model('Product', productSchema); 