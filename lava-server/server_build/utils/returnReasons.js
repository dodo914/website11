// ===== قائمة أسباب الاسترجاع الموحّدة (Customer-facing) =====
// كل سبب له كود ثابت (بيتخزن في الطلب) ونص عربي/إنجليزي للعرض، وفلاج
// feeApplies بيحدد هل العميل بيتحمل رسوم شحن الاسترجاع ولا المتجر.
//
// - أسباب بسبب المتجر (عيب في المنتج / استلم منتج غلط) => مجاني بالكامل،
//   المتجر بيتحمل تكلفة شحن الاسترجاع.
// - أسباب باختيار العميل (مقاس مش مظبوط / غيّر رأيه / سبب تاني) => العميل
//   بيتحمل رسوم شحن الاسترجاع (المبلغ نفسه في Settings.returnFeeAmount).
//
// ملحوظة مهمة: نفس الأكواد (code) دي لازم تفضل متطابقة تمامًا مع القايمة
// المكررة في الفرونت (lava-client/src/App.jsx - RETURN_REASONS) عشان القيمة
// اللي العميل يختارها تتقبل من السيرفر. لو حبيت تضيف سبب جديد، ضيفه هنا
// وهناك بنفس الـ code بالظبط.
// evidenceRequired: هل السبب ده يستوجب إثبات (صور) قبل ما يتقبل - بيتفعّل
// فعليًا بس لو Settings.requireEvidenceImages = true (شوف utils/returnExchangeFees.js).
const RETURN_REASONS = [
  { code: 'defective', ar: 'المنتج فيه عيب / وصل تالف', en: 'Item is defective / arrived damaged', feeApplies: false, evidenceRequired: true },
  { code: 'wrong_item', ar: 'استلمت منتج مختلف عن اللي طلبته', en: 'Received a different item than ordered', feeApplies: false, evidenceRequired: true },
  { code: 'wrong_size', ar: 'المقاس مش مظبوط', en: 'Wrong size', feeApplies: true, evidenceRequired: false },
  { code: 'changed_mind', ar: 'غيرت رأيي / مش عاجبني المنتج', en: 'Changed my mind / not what I expected', feeApplies: true, evidenceRequired: false },
  { code: 'other', ar: 'سبب تاني', en: 'Other reason', feeApplies: true, evidenceRequired: false },
];

const RETURN_REASON_CODES = RETURN_REASONS.map((r) => r.code);

// ============================================================
// Phase 2B - Reasons Management: القايمة الثابتة فوق دي بتفضل الأساس/الـ
// fallback دايمًا (وأكوادها هي اللي متطابقة مع الفرونت وقت الإنشاء)، لكن
// الأدمن يقدر يعدّل التسميات (ar/en) و enabled من Admin Settings، وده بيتخزن
// في Settings.returnReasons (شوف settingsController.js - buildSettingsDefaults).
// كل الدوال هنا بتاخد `settings` اختياري - لو مبعوتة وفيها returnReasons
// بتُستخدم بدل القايمة الثابتة، لو لأ (أو الكود مش موجود فيها) بيرجع
// fallback للقايمة الثابتة عشان أي كود قديم بينادي الدوال دي من غير settings
// (زي ما كان قبل كده بالظبط) يفضل شغال زي ما هو من غير أي كسر.
// ============================================================
const getEffectiveReturnReasons = (settings) => {
  const overrides = settings && Array.isArray(settings.returnReasons) ? settings.returnReasons : null;
  if (!overrides || overrides.length === 0) return RETURN_REASONS.map((r) => ({ ...r, enabled: true }));

  // نبدأ من القايمة الثابتة (fallback لأي حقل ناقص)، ونطبّق فوقها أي override
  // بنفس الـcode، ونضيف أي سبب custom جديد الأدمن أضافه (custom: true).
  const byCode = new Map(RETURN_REASONS.map((r) => [r.code, { ...r, enabled: true }]));
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

const isValidReasonCode = (code, settings) => {
  const list = getEffectiveReturnReasons(settings);
  const found = list.find((r) => r.code === code);
  return !!found && found.enabled !== false;
};

// هل السبب ده بيستوجب رسوم شحن استرجاع على العميل؟
// لو الكود مش معروف (null/فاضي/قيمة قديمة قبل ما الميزة دي تتضاف)، بنتعامل
// معاه كـ "بيستوجب رسوم" fail-safe عشان منفوتش رسوم كان المفروض تتحصل، والأدمن
// دايمًا يقدر يشيل الرسوم يدويًا وقت المراجعة لو شاف إن السبب فعلاً عيب.
const doesReasonApplyFee = (code, settings) => {
  const found = getEffectiveReturnReasons(settings).find((r) => r.code === code);
  return found ? found.feeApplies : true;
};

// هل السبب ده يستوجب صور إثبات (لو Settings.requireEvidenceImages مفعّلة)؟
// fail-safe: كود غير معروف بيتطلب إثبات برضه.
const doesReasonRequireEvidence = (code, settings) => {
  const found = getEffectiveReturnReasons(settings).find((r) => r.code === code);
  return found ? found.evidenceRequired : true;
};

module.exports = {
  RETURN_REASONS, RETURN_REASON_CODES, isValidReasonCode, doesReasonApplyFee,
  doesReasonRequireEvidence, getEffectiveReturnReasons,
};