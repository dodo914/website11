const mongoose = require('mongoose');

// ============================================================
// سجل حركة المخزون — كل تغيير في الـ stock بيتسجل هنا كـ history
// reason: نوع الحركة
//   stock_added      -> إضافة مخزون يدويًا (أدمن)
//   stock_reserved    -> حجز مؤقت (غير مستخدم حاليًا، للمستقبل لو اتضاف نظام حجز)
//   stock_sold        -> خصم فعلي بسبب طلب ناجح (order create)
//   stock_released    -> فك حجز/إرجاع مخزون بسبب فشل إنشاء الطلب بعد الخصم
//   stock_returned     -> إرجاع مخزون بسبب إلغاء/رفض/ارتجاع طلب
//   stock_adjusted     -> تعديل يدوي من الأدمن (تعديل منتج)
// ============================================================
const inventoryMovementSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: String, default: null },
  size: { type: String, default: null },
  quantity: { type: Number, required: true }, // موجب = إضافة، سالب = خصم
  reason: {
    type: String,
    enum: ['stock_added', 'stock_reserved', 'stock_sold', 'stock_released', 'stock_returned', 'stock_adjusted'],
    required: true,
  },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  note: { type: String, default: null },
}, {
  timestamps: true,
});

inventoryMovementSchema.index({ product: 1, createdAt: -1 });
inventoryMovementSchema.index({ order: 1 });
inventoryMovementSchema.index({ reason: 1, createdAt: -1 });

module.exports = mongoose.model('InventoryMovement', inventoryMovementSchema);
