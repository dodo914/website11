const mongoose = require('mongoose');

// ============================================================
// نظام الاستبدال (Exchange) - المرحلة الأولى
// ------------------------------------------------------------------------
// ده Model مستقل ومنفصل عن Order.returnItems/returnRequestStatus (نظام
// الـReturn الموجود بالفعل جوه Order.js) لأن الاستبدال محتاج تتبع أغنى
// (Variant قديم + Variant جديد لكل عنصر، وworkflow أطول من مجرد
// pending/approved/rejected)، وده يمنع أي تعارض أو كسر لنظام الـReturn
// الحالي - Order.js متغيرش خالص في المرحلة دي.
//
// كل عنصر في exchange request بيحتفظ بالمنتج/الفاريانت/المقاس القديم
// (اللي اشتراه العميل فعلاً وموجود في الـ Order) والمنتج/الفاريانت/المقاس
// الجديد المطلوب استبداله بيه. بيتم التحقق من كل ده Server-side في
// controllers/exchangeController.js (مش بس Frontend validation).
// ============================================================

const exchangeItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, default: 1 },

  // ===== الفاريانت القديم (اللي في الطلب الأصلي فعلاً) =====
  oldVariant: {
    variantId: { type: String, default: null },
    size: { type: String, default: null },
    color: { type: mongoose.Schema.Types.Mixed, default: null },
  },

  // ===== الفاريانت الجديد المطلوب الاستبدال بيه =====
  requestedNewVariant: {
    variantId: { type: String, default: null },
    size: { type: String, default: null },
    color: { type: mongoose.Schema.Types.Mixed, default: null },
  },
}, { _id: false });

const statusHistoryEntrySchema = new mongoose.Schema({
  status: { type: String, required: true },
  at: { type: Date, default: Date.now },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  note: { type: String, default: null },
}, { _id: false });

const EXCHANGE_STATUSES = [
  'pending',
  'under_review',
  'approved',
  'rejected',
  'pickup_scheduled',
  'received',
  'processing',
  'completed',
  'cancelled',
  // ===== Phase 2C: مراحل أدق لسير عمل الاستبدال بعد الموافقة =====
  // (شركة الشحن استلمت المنتج القديم من العميل -> وصل المخزن -> جاري
  // المعاينة -> اتشحن للعميل المنتج الجديد -> العميل استلم = completed).
  // القيم القديمة فوق (pickup_scheduled/received/processing) متسابتش
  // عشان التوافق مع أي طلبات قديمة، بس الـworkflow الجديد بيستخدم دول.
  'carrier_picked_up',
  'received_at_warehouse',
  'inspecting',
  'shipped_to_customer',
];

// Any exchange request in one of these states is considered active.
// Keep this list in the model so the database-level partial unique index and
// controller checks use the same definition.
const ACTIVE_EXCHANGE_STATUSES = [
  'pending',
  'under_review',
  'approved',
  'pickup_scheduled',
  'received',
  'processing',
  'carrier_picked_up',
  'received_at_warehouse',
  'inspecting',
  'shipped_to_customer',
];

const exchangeRequestSchema = new mongoose.Schema({
  // ===== معرّف قصير قابل للعرض للعميل/الأدمن (منفصل عن Mongo _id) =====
  requestId: { type: String, required: true, unique: true },

  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  // ===== اختياري دلوقتي (كان required) عشان يدعم "صفحة الاسترجاع/الاستبدال
  // بدون تسجيل دخول" (تحقق برقم الأوردر + رقم الهاتف) - شوف
  // controllers/guestOrderController.js. لو الأوردر مرتبط بحساب فعلاً،
  // القيمة بتتحط زي ما هي بالظبط (order.customerId) - مفيش تغيير في
  // السلوك القديم. بترجع null بس في حالة عميل مش عامل حساب أصلاً.
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // ثابتة على 'exchange' حاليًا - موجودة عشان لو في المستقبل حبينا نوحّد
  // الـReturn والـExchange في نفس الـcollection.
  type: { type: String, default: 'exchange' },

  items: {
    type: [exchangeItemSchema],
    validate: [(arr) => Array.isArray(arr) && arr.length > 0, 'لازم تختار منتج واحد على الأقل للاستبدال'],
  },

  reasonCode: { type: String, default: null },
  reason: { type: String, default: null }, // نفس reasonCode لكن كنص عرض (مطابق لـEXCHANGE_REASONS)
  customerNote: { type: String, default: null }, // تفاصيل حرة (إلزامية لو reasonCode === 'other')

  // صور إثبات (لو Settings.requireEvidenceImages مفعّلة والسبب يستوجبها -
  // شوف utils/returnExchangeFees.js). روابط Cloudinary مرفوعة مسبقًا عن
  // طريق نفس File Upload الموجود بالفعل في المشروع (middleware/upload.js).
  evidenceImages: { type: [String], default: [] },

  // ===== Exchange Fee - Snapshot (Phase 2A - بند 5 + 6) =====
  // بتتحسب Server-side بس وقت إنشاء الطلب (utils/returnExchangeFees.js) وبتتحفظ
  // هنا زي ما هي - أي تغيير لاحق في Settings.exchangeFeeAmount مبيأثرش على
  // الطلبات القديمة، الطلبات الجديدة بس هي اللي تستخدم القيمة الجديدة.
  fee: { type: Number, default: 0 },
  currency: { type: String, default: 'EGP' },
  feeType: { type: String, default: null }, // 'exchange' | 'free_store_error' | 'free'

  status: { type: String, enum: EXCHANGE_STATUSES, default: 'pending' },
  statusHistory: { type: [statusHistoryEntrySchema], default: [] },

  // ===== مين طلب الاستبدال - زي Order.returnRequestedBy بالظبط =====
  // 'customer': العميل هو اللي فتح الطلب من "طلباتي". 'admin': الأدمن سجّله
  // بنفسه (مثلاً العميل كلّمه تليفونيًا) - في الحالة دي الطلب بيتعمله approve
  // فورًا (خطوة واحدة) بدل ما يفضل pending محتاج موافقة تانية.
  requestedBy: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  // ===== الطلب اتقدّم من صفحة "استبدال بدون تسجيل دخول" (تحقق برقم
  // الأوردر + رقم الهاتف) ولا من "طلباتي" (عميل عامل حساب)؟ حقل إضافي بس
  // للعرض في الأدمن - مبيأثرش على أي منطق موجود (default: false، فكل
  // الطلبات القديمة تفضل زي ما هي). requestedBy بيفضل 'customer' في الحالتين.
  submittedAsGuest: { type: Boolean, default: false },

  // ===== رقم تتبع شحنة الاستبدال - بيتحط يدويًا بواسطة الأدمن =====
  // (زي Order.returnTrackingNumber بالظبط) لحد ما شركة الشحن تدعم
  // Exchange API رسميًا (شوف services/shipping/capabilities.js).
  trackingNumber: { type: String, default: null },
  // ===== Bosta Return/Exchange Integration - إضافات المزامنة (Manual Mode) =====
  // provider: شركة الشحن اللي الأدمن اختارها وقت ما دخّل رقم التتبع (مش
  // بالضرورة نفس شركة شحن الأوردر الأصلي - ممكن الاستبدال يتم بشركة تانية).
  // providerShipmentId: مرجع اختياري إضافي (شحنة/طلب) لو الأدمن عنده رقم
  // غير رقم التتبع نفسه.
  provider: { type: String, default: null },
  providerShipmentId: { type: String, default: null },
  // trackingStatus: الحالة الداخلية الموحّدة بعد الـnormalize (شوف
  // services/shipping/statusMap.js - normalizeReturnExchangeStatus).
  // trackingRawStatus: نفس الحالة زي ما رجعت بالظبط من شركة الشحن (بدون فقد معلومة).
  trackingStatus: { type: String, default: null },
  trackingRawStatus: { type: String, default: null },
  // trackingMode: بتتحدد أوتوماتيك أول ما trackingNumber يتحفظ - 'auto' لو
  // الشركة supportsTracking (هنحاول نجيب حالتها لوحدنا فورًا + دوريًا)،
  // 'manual' لو مش مدعومة (الأدمن هو اللي هيحدّث status يدويًا بالكامل).
  trackingMode: { type: String, enum: ['manual', 'auto', null], default: null },
  trackingSyncEnabled: { type: Boolean, default: true },
  lastTrackingSyncAt: { type: Date, default: null },
  lastProviderEvent: { type: String, default: null },

  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  adminNote: { type: String, default: null },

  // ===== حماية المخزون من التعديل المكرر =====
  // بتبقى true أول ما المخزون يتعدّل فعليًا (خصم الفاريانت الجديد + إرجاع
  // القديم) وقت الموافقة، عشان أي محاولة موافقة/إلغاء تانية متأثرش في
  // المخزون مرتين. نفس فكرة Order.stockRestored بالظبط.
  stockAdjusted: { type: Boolean, default: false },
  stockAdjustedAt: { type: Date, default: null },

  // ===== معاينة الفاريانت القديم (اللي هيرجع من العميل) بعد ما يوصل فعليًا =====
  // قبل كده كان مخزون الفاريانت القديم بيرجع تلقائيًا فور الموافقة على
  // الاستبدال (قبل ما المنتج القديم يوصل فعليًا أو حد يعاينه) - ده غلط لنفس
  // سبب الاسترجاع بالظبط (المنتج ممكن يرجع تالف). دلوقتي خصم الفاريانت
  // الجديد (عشان يتشحن للعميل) بيحصل عادي وقت الموافقة، لكن رجوع مخزون
  // الفاريانت القديم بقى معلّق لحد "معاينة" صريحة - شوف inspectExchangeRequest
  // في controllers/exchangeController.js.
  oldVariantInspectionResult: { type: String, enum: ['pending', 'good', 'bad', null], default: null },
  oldVariantInspectedAt: { type: Date, default: null },
  oldVariantInspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  oldVariantInspectionNote: { type: String, default: null },
  // true بس لو المعاينة كانت 'good' والمخزون اترجع فعليًا - مستخدم برضو في
  // منطق الإلغاء (cancelled) عشان نعرف نرجع نخصمه تاني لو الطلب اتلغى بعد
  // ما كان اتعاين، أو منلمسوش لو المعاينة لسه مستنية/كانت 'bad'.
  oldVariantStockRestored: { type: Boolean, default: false },
  oldVariantStockRestoredAt: { type: Date, default: null },

  // ===== Phase 2C: تحويل الفلوس (انستا باي / محفظة) بتاع الاستبدال =====
  // في الاستبدال ممكن الفلوس تتحرك في الاتجاهين: العميل يحول لينا رسوم
  // الاستبدال (collect_from_customer) أو إحنا نحول للعميل فرق سعر
  // (refund_to_customer) - الأدمن هو اللي بيحدد الاتجاه يدويًا وقت المراجعة.
  moneyDirection: { type: String, enum: ['none', 'collect_from_customer', 'refund_to_customer'], default: 'none' },
  moneyAmount: { type: Number, default: 0 },
  moneyCurrency: { type: String, default: 'EGP' },
  moneyMethod: { type: String, enum: ['instapay', 'wallet', null], default: null },
  moneyTransferredAt: { type: Date, default: null },
  moneyTransferredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  moneyReference: { type: String, default: null },

  // ===== ربط فلوس الاستبدال بإيرادات الطلب المرتبط (Order.refundedAmount /
  // Order.exchangeExtraCollected) - شوف updateExchangeMoney في
  // exchangeController.js. بنسجّل هنا المبلغ/الاتجاه اللي فعلاً اتطبّق على
  // الطلب (مش موني/دايركشن الحاليين اللي ممكن يتغيروا بعد كده) عشان لو
  // الأدمن عدّل المبلغ أو ألغى التحويل بعد ما كان اتأكد، نقدر نعكس بالظبط
  // نفس القيمة اللي كانت اتضافت - ومنع تكرار التطبيق لو "تأكيد التحويل"
  // اتبعت مرتين لنفس الحالة.
  financialImpactApplied: { type: Boolean, default: false },
  financialImpactAmount: { type: Number, default: 0 },
  financialImpactDirection: { type: String, enum: ['none', 'collect_from_customer', 'refund_to_customer', null], default: null },
}, {
  timestamps: true,
});

exchangeRequestSchema.index({ orderId: 1, createdAt: -1 });
exchangeRequestSchema.index({ userId: 1, createdAt: -1 });
exchangeRequestSchema.index({ status: 1, createdAt: -1 });

// DB-level race protection: only one active exchange may exist per order.
// Terminal requests (rejected/cancelled/completed) are intentionally excluded
// so a customer can create a new request when business rules allow it.
// Existing databases should have this index created by Mongoose on startup.
exchangeRequestSchema.index(
  { orderId: 1 },
  {
    unique: true,
    name: 'uniq_active_exchange_per_order',
    partialFilterExpression: { status: { $in: ACTIVE_EXCHANGE_STATUSES } },
  }
);

module.exports = mongoose.model('ExchangeRequest', exchangeRequestSchema);
module.exports.EXCHANGE_STATUSES = EXCHANGE_STATUSES;
module.exports.ACTIVE_EXCHANGE_STATUSES = ACTIVE_EXCHANGE_STATUSES;