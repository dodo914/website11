const ActivityLog = require('../models/ActivityLog');

// ===== دالة مساعدة موحدة لتسجيل أي نشاط في لوحة التحكم =====
// بتستخدم من أي كنترولر: logActivity(req, { action, entityType, entityId, entityLabel, description, metadata })
// آمنة تماماً: أي خطأ في التسجيل (مشكلة داتا بيز مؤقتة مثلاً) لا يوقف العملية الأساسية أبداً.
const ROLE_LABELS_AR = {
  admin: 'أدمن',
  call_center: 'كول سنتر',
  packer: 'باكر',
  customer: 'عميل',
};

const logActivity = async (req, { action, entityType, entityId = null, entityLabel = '', description = '', metadata = null }) => {
  try {
    const user = req && req.user;
    const userName = user ? (user.name || user.email || 'مستخدم') : 'النظام';
    const userRole = user ? user.role : 'system';

    const finalDescription = description || buildDefaultDescription({ userName, action, entityType, entityLabel });

    await ActivityLog.create({
      userId: user ? user._id : null,
      userName,
      userRole,
      action,
      entityType,
      entityId: entityId != null ? String(entityId) : null,
      entityLabel: entityLabel || '',
      description: finalDescription,
      metadata,
    });
  } catch (err) {
    // ما نكسرش الطلب الأساسي أبداً بسبب فشل تسجيل النشاط
    console.error('تعذّر تسجيل النشاط:', err.message);
  }
};

const ACTION_LABELS_AR = {
  create: 'أضاف',
  update: 'عدّل',
  delete: 'حذف',
  login: 'سجّل دخول',
  status_change: 'غيّر حالة',
};

const ENTITY_LABELS_AR = {
  product: 'منتج',
  order: 'طلب',
  settings: 'الإعدادات',
  staff: 'موظف',
  customer: 'عميل',
  homepage: 'الصفحة الرئيسية',
  discount: 'كود خصم',
  campaign: 'عرض ترويجي',
};

const buildDefaultDescription = ({ userName, action, entityType, entityLabel }) => {
  const actionLabel = ACTION_LABELS_AR[action] || action;
  const entityTypeLabel = ENTITY_LABELS_AR[entityType] || entityType;
  const suffix = entityLabel ? ` "${entityLabel}"` : '';
  return `${userName} ${actionLabel} ${entityTypeLabel}${suffix}`;
};

module.exports = { logActivity, ROLE_LABELS_AR };
