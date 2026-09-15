const mongoose = require('mongoose');

// ===== سجل نشاط الأدمن/الموظفين =====
// كل سطر بيسجل: مين عمل، عمل إيه (action)، على إيه (entityType/entityLabel)، وإمتى.
const activityLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userName: { type: String, required: true },
  userRole: { type: String, default: 'admin' },
  action: { type: String, required: true }, // 'create' | 'update' | 'delete' | 'login' | ...
  entityType: { type: String, required: true }, // 'product' | 'order' | 'settings' | 'staff' | 'customer' | ...
  entityId: { type: String, default: null },
  entityLabel: { type: String, default: '' }, // اسم/رقم مختصر يظهر في السجل (اسم المنتج، رقم الطلب...)
  description: { type: String, default: '' }, // النص الكامل اللي بيتعرض (زي: "Ahmed changed product price")
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ entityType: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
