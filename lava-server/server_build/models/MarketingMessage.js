const mongoose = require('mongoose');
const marketingMessageSchema = new mongoose.Schema({
  kind: { type: String, enum: ['campaign','order_confirmation','order_status','abandoned_cart'], required: true, index: true },
  channel: { type: String, enum: ['email','whatsapp'], required: true },
  recipientEmail: String,
  recipientPhone: String,
  subject: String,
  content: String,
  entityId: String,
  couponCode: String,
  step: { type: Number, default: 0 },
  scheduledAt: { type: Date, index: true },
  sentAt: Date,
  status: { type: String, enum: ['pending','sending','sent','failed','cancelled'], default: 'pending', index: true },
  providerMessageId: String,
  whatsappTemplateId: Number,
  error: String,
  // ===== retry محدود وآمن للعمليات غير الحرجة (بدون أي queue خارجية) =====
  // attempts: عدد المحاولات الفاشلة حتى الآن. maxAttempts: أقصى عدد محاولات
  // قبل ما نعتبر الرسالة "failed" نهائيًا ونوقف إعادة المحاولة تلقائيًا.
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
}, { timestamps: true });
marketingMessageSchema.index({ status: 1, scheduledAt: 1 });
marketingMessageSchema.index({ kind: 1, entityId: 1, step: 1, channel: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model('MarketingMessage', marketingMessageSchema);