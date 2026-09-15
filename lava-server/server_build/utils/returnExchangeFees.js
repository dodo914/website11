// ============================================================
// Returns & Exchanges - Phase 2A
// ------------------------------------------------------------------------
// نقطة واحدة مشتركة لحساب رسوم الاسترجاع/الاستبدال والتحقق من نافذة الوقت
// (Window) المسموح بيها. مستخدمة من controllers/orderController.js (Return)
// و controllers/exchangeController.js (Exchange) عشان القاعدة تفضل واحدة
// في مكان واحد، ومتتكررش. الـFee دايمًا بيتحسب هنا Server-side بس، ومفيش
// أي قيمة بتتقبل من الفرونت لتحديد الرسوم.
// ============================================================

const { doesReasonApplyFee, doesReasonRequireEvidence } = require('./returnReasons');
const { doesExchangeReasonApplyFee, doesExchangeReasonRequireEvidence } = require('./exchangeReasons');

const DEFAULT_CURRENCY = 'EGP';

// نافذة الأسباب اللي بتتحسب كـ"عيب في المنتج / خطأ من المتجر" - نفس مجموعة
// الأسباب اللي feeApplies=false ليها (شوف returnReasons.js/exchangeReasons.js).
const isStoreErrorReason = (type, reasonCode, settings) =>
  type === 'exchange' ? !doesExchangeReasonApplyFee(reasonCode, settings) : !doesReasonApplyFee(reasonCode, settings);

// ===== قراءة الإعدادات ذات الصلة من Settings document مع Fallback آمن =====
const readReturnExchangeSettings = (settingsDoc) => {
  const s = settingsDoc || {};
  const num = (v, def) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : def;
  };
  return {
    enableReturns: s.enableReturns !== false,
    returnFeeAmount: num(s.returnFeeAmount, 160),
    returnWindow: num(s.returnWindow, 7),
    defectiveProductWindow: num(s.defectiveProductWindow, 3),

    enableExchanges: s.enableExchanges !== false,
    exchangeFeeAmount: num(s.exchangeFeeAmount, 180),
    exchangeWindow: num(s.exchangeWindow, 7),

    requireEvidenceImages: !!s.requireEvidenceImages,
    freeStoreErrorReturns: s.freeStoreErrorReturns !== false,
    freeStoreErrorExchanges: s.freeStoreErrorExchanges !== false,
  };
};

// ============================================================
// حساب الـFee Server-side (بند 5 + 6 + 11 في الطلب)
// بيرجع snapshot { fee, currency, feeType } يتحفظ زي ما هو جوه الـRequest،
// ومبيتأثرش بأي تغيير لاحق في الإعدادات (شوف بند 6 - Snapshot للرسوم).
// ============================================================
const computeFee = ({ type, reasonCode, settings }) => {
  const cfg = readReturnExchangeSettings(settings);
  const isReturn = type !== 'exchange';
  const baseFee = isReturn ? cfg.returnFeeAmount : cfg.exchangeFeeAmount;
  const freeStoreErrorEnabled = isReturn ? cfg.freeStoreErrorReturns : cfg.freeStoreErrorExchanges;
  const storeError = isStoreErrorReason(type, reasonCode, settings);

  let fee = baseFee;
  let feeType = isReturn ? 'return' : 'exchange';

  if (storeError && freeStoreErrorEnabled) {
    fee = 0;
    feeType = 'free_store_error';
  } else if (!(Number.isFinite(baseFee) && baseFee > 0)) {
    fee = 0;
    feeType = 'free';
  }

  return { fee: Math.round(fee * 100) / 100, currency: DEFAULT_CURRENCY, feeType };
};

// ============================================================
// النافذة الزمنية المسموح فيها بطلب استرجاع/استبدال (بالأيام) - بند 9
// الأسباب اللي سببها المتجر (عيب/منتج غلط) بتاخد defectiveProductWindow
// بدل returnWindow/exchangeWindow العادية.
// ============================================================
const getWindowDays = ({ type, reasonCode, settings }) => {
  const cfg = readReturnExchangeSettings(settings);
  if (isStoreErrorReason(type, reasonCode, settings)) return cfg.defectiveProductWindow;
  return type === 'exchange' ? cfg.exchangeWindow : cfg.returnWindow;
};

// بيرجع تاريخ الاستلام المستخدم كأساس لحساب النافذة الزمنية. بيفضّل
// Order.deliveredAt (تاريخ استلام فعلي مسجل)، وبيعمل fallback لآخر تحديث
// شحن أو آخر تعديل على الطلب لو مش موجود (طلبات قديمة قبل ما الحقل ده يتضاف).
const resolveDeliveredAt = (order) => {
  return order.deliveredAt || order.shippingUpdatedAt || order.updatedAt || order.createdAt || new Date();
};

// ============================================================
// التحقق الكامل من الأهلية (بند 9) - بيرجع { eligible, message }
// ============================================================
const checkEligibility = ({ order, type, reasonCode, settings }) => {
  const cfg = readReturnExchangeSettings(settings);
  const isReturn = type !== 'exchange';

  if (isReturn && !cfg.enableReturns) {
    return { eligible: false, message: 'خدمة الاسترجاع غير متاحة حاليًا' };
  }
  if (!isReturn && !cfg.enableExchanges) {
    return { eligible: false, message: 'خدمة الاستبدال غير متاحة حاليًا' };
  }

  const isDelivered = order.status === 'تم التسليم' || order.status === 'Delivered' || order.shippingStatus === 'delivered';
  if (!isDelivered) {
    return { eligible: false, message: isReturn ? 'الاسترجاع متاح بس للطلبات اللي اتسلمت فعلاً' : 'الاستبدال متاح بس للطلبات اللي اتسلمت فعلاً' };
  }

  const deliveredAt = resolveDeliveredAt(order);
  const windowDays = getWindowDays({ type, reasonCode, settings });
  const deadline = new Date(deliveredAt);
  deadline.setDate(deadline.getDate() + windowDays);
  if (Date.now() > deadline.getTime()) {
    return { eligible: false, message: `انتهت المدة المسموح فيها بتقديم الطلب (${windowDays} يوم من الاستلام)` };
  }

  return { eligible: true, message: null };
};

// ============================================================
// هل الصور مطلوبة لهذا السبب؟ (بند 12) - بيرجع boolean بس
// ============================================================
const isEvidenceRequired = ({ type, reasonCode, settings }) => {
  const cfg = readReturnExchangeSettings(settings);
  if (!cfg.requireEvidenceImages) return false;
  return type === 'exchange' ? doesExchangeReasonRequireEvidence(reasonCode, settings) : doesReasonRequireEvidence(reasonCode, settings);
};

module.exports = {
  DEFAULT_CURRENCY,
  readReturnExchangeSettings,
  computeFee,
  getWindowDays,
  resolveDeliveredAt,
  checkEligibility,
  isEvidenceRequired,
};