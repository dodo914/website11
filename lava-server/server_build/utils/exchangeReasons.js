// ===== قائمة أسباب الاستبدال الموحّدة (Customer-facing) =====
// نفس فكرة utils/returnReasons.js بالظبط لكن لأسباب الاستبدال (Exchange).
// المرحلة الحالية: قايمة ثابتة (static) زي ما طلب العميل بالظبط، لكن
// اتبنت كـ module مستقل عشان المرحلة الجاية (إدارة الأسباب من Admin
// Settings) تقدر تستبدل المصدر ده بقراءة من الداتابيز من غير ما تكسر أي
// كود بيستخدم isValidExchangeReasonCode / EXCHANGE_REASONS.
//
// ملحوظة مهمة: نفس الأكواد (code) دي لازم تفضل متطابقة تمامًا مع القايمة
// المكررة في الفرونت (lava-client/src/App.jsx - EXCHANGE_REASONS) عشان
// القيمة اللي العميل يختارها تتقبل من السيرفر. لو حبيت تضيف سبب جديد،
// ضيفه هنا وهناك بنفس الـ code بالظبط.
// feeApplies: هل السبب ده بيستوجب Exchange Fee على العميل؟ (false = خطأ من
// المتجر/المنتج => مجاني لو Settings.freeStoreErrorExchanges مفعّلة).
// evidenceRequired: هل السبب ده يستوجب صور إثبات لو Settings.requireEvidenceImages مفعّلة؟
// نفس فكرة utils/returnReasons.js بالظبط.
const EXCHANGE_REASONS = [
  { code: 'wrong_size', ar: 'المقاس مش مظبوط', en: 'Wrong Size', feeApplies: true, evidenceRequired: false },
  { code: 'wrong_color', ar: 'اللون مش اللي عايزه', en: 'Wrong Color', feeApplies: true, evidenceRequired: false },
  { code: 'changed_mind', ar: 'غيرت رأيي', en: 'Changed My Mind', feeApplies: true, evidenceRequired: false },
  { code: 'defective', ar: 'المنتج فيه عيب', en: 'Product Defective', feeApplies: false, evidenceRequired: true },
  { code: 'wrong_item', ar: 'استلمت منتج غلط', en: 'Wrong Product Received', feeApplies: false, evidenceRequired: true },
  { code: 'mismatch', ar: 'المنتج مش مطابق للطلب', en: "Product Doesn't Match Order", feeApplies: false, evidenceRequired: true },
  { code: 'other', ar: 'سبب تاني', en: 'Other', feeApplies: true, evidenceRequired: false },
];

const EXCHANGE_REASON_CODES = EXCHANGE_REASONS.map((r) => r.code);

// ============================================================
// Phase 2B - Reasons Management: نفس فكرة utils/returnReasons.js بالظبط -
// شوف الشرح هناك. Settings.exchangeReasons بتحمل التعديلات (تسميات/enabled/
// custom reasons) والقايمة الثابتة فوق تفضل fallback دايمًا.
// ============================================================
const getEffectiveExchangeReasons = (settings) => {
  const overrides = settings && Array.isArray(settings.exchangeReasons) ? settings.exchangeReasons : null;
  if (!overrides || overrides.length === 0) return EXCHANGE_REASONS.map((r) => ({ ...r, enabled: true }));

  const byCode = new Map(EXCHANGE_REASONS.map((r) => [r.code, { ...r, enabled: true }]));
  overrides.forEach((o) => {
    if (!o || !o.code) return;
    const base = byCode.get(o.code) || { code: o.code, ar: '', en: '', feeApplies: true, evidenceRequired: false, enabled: true, custom: true };
    byCode.set(o.code, {
      ...base,
      ar: typeof o.ar === 'string' && o.ar.trim() ? o.ar : base.ar,
      en: typeof o.en === 'string' && o.en.trim() ? o.en : base.en,
      feeApplies: typeof o.feeApplies === 'boolean' ? o.feeApplies : base.feeApplies,
      evidenceRequired: typeof o.evidenceRequired === 'boolean' ? o.evidenceRequired : base.evidenceRequired,
      enabled: o.enabled !== false,
    });
  });
  return Array.from(byCode.values());
};

const isValidExchangeReasonCode = (code, settings) => {
  const list = getEffectiveExchangeReasons(settings);
  const found = list.find((r) => r.code === code);
  return !!found && found.enabled !== false;
};

// السبب اللي لازم يتكتب معاه تفاصيل حرة (customerNote) لأنه مش محدد
const requiresDetailNote = (code) => code === 'other';

// هل السبب ده بيستوجب Exchange Fee؟ fail-safe: كود غير معروف بيستوجب رسوم.
const doesExchangeReasonApplyFee = (code, settings) => {
  const found = getEffectiveExchangeReasons(settings).find((r) => r.code === code);
  return found ? found.feeApplies : true;
};

// هل السبب ده يستوجب صور إثبات؟ fail-safe: كود غير معروف بيتطلب إثبات.
const doesExchangeReasonRequireEvidence = (code, settings) => {
  const found = getEffectiveExchangeReasons(settings).find((r) => r.code === code);
  return found ? found.evidenceRequired : true;
};

module.exports = {
  EXCHANGE_REASONS,
  EXCHANGE_REASON_CODES,
  isValidExchangeReasonCode,
  requiresDetailNote,
  doesExchangeReasonApplyFee,
  doesExchangeReasonRequireEvidence,
  getEffectiveExchangeReasons,
};