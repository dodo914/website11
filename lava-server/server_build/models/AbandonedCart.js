const mongoose = require('mongoose');

const abandonedCartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: mongoose.Schema.Types.Mixed },
  variantId: String,
  size: String,
  price: Number,
  quantity: { type: Number, default: 1 },
  image: String,
}, { _id: false });

const abandonedCartSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  customerPhone: { type: String, default: null },
  customerEmail: { type: String, default: null },
  items: [abandonedCartItemSchema],
  subtotal: { type: Number, default: 0 },
  governorate: { type: String, default: null },
  recoveredAt: { type: Date, default: null }, // لو اتعمل أوردر حقيقي بعدها
  lastSeen: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

abandonedCartSchema.index({ createdAt: -1 });
abandonedCartSchema.index({ sessionId: 1 });

module.exports = mongoose.model('AbandonedCart', abandonedCartSchema);
