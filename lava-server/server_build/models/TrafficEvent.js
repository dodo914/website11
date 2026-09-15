const mongoose = require('mongoose');

const trafficEventSchema = new mongoose.Schema({
  // ─── معرّفات الزائر والجلسة ───────────────────────────────────────────
  visitorId:    { type: String, required: true, index: true }, // ثابت عبر الجلسات (localStorage)
  sessionId:    { type: String, required: true, index: true }, // يتجدد بعد 30 دقيقة خمول
  customerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // ─── مصدر الزيارة ────────────────────────────────────────────────────
  source:       { type: String, default: 'direct' }, // facebook | instagram | tiktok | google | direct | other
  utm_source:   { type: String, default: null },
  utm_medium:   { type: String, default: null },
  utm_campaign: { type: String, default: null },
  utm_term:     { type: String, default: null },      // ← جديد
  utm_content:  { type: String, default: null },      // ← جديد
  referrer:     { type: String, default: null },
  landingPage:  { type: String, default: '/' },       // أول صفحة في الجلسة

  // ─── بيانات الجلسة ───────────────────────────────────────────────────
  page:         { type: String, default: '/' },       // آخر صفحة
  pageViewCount:{ type: Number, default: 1 },         // عدد الصفحات المشاهَدة في الجلسة
  lastActivity: { type: Date, default: Date.now },    // ← جديد — لحساب الخمول
  device:       { type: String, default: null },      // mobile | desktop | tablet
  country:      { type: String, default: null },

  // ─── بيانات التحويل ──────────────────────────────────────────────────
  orderId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  orderAmount:  { type: Number, default: null },
  converted:    { type: Boolean, default: false },
}, {
  timestamps: true,
});

trafficEventSchema.index({ createdAt: -1 });
trafficEventSchema.index({ visitorId: 1, createdAt: -1 });
trafficEventSchema.index({ source: 1, createdAt: -1 });
trafficEventSchema.index({ sessionId: 1, createdAt: -1 });

module.exports = mongoose.model('TrafficEvent', trafficEventSchema);