const mongoose = require('mongoose');

// كل document = خطوة واحدة في الـ funnel من session معين
const funnelEventSchema = new mongoose.Schema({
  visitorId: { type: String, required: true, index: true }, // ← جديد — لحساب unique visitors
  sessionId: { type: String, required: true, index: true },
  // الخطوات الممكنة بالترتيب:
  // visit → product_view → add_to_cart → checkout → purchase
  step: {
    type: String,
    required: true,
    enum: ['visit', 'product_view', 'add_to_cart', 'checkout', 'purchase'],
  },
}, {
  timestamps: true,
});

funnelEventSchema.index({ step: 1, createdAt: -1 });
funnelEventSchema.index({ sessionId: 1, step: 1 }, { unique: true }); // مرة واحدة لكل session لكل step

module.exports = mongoose.model('FunnelEvent', funnelEventSchema);