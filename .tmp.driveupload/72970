// ============================================================
// ===== LAVA Remote License Response Normalization (PART 2A) ===
// ============================================================
// الـLicense Server الحقيقي لسه مبنيش، فمفيش "response format" نهائي
// متفق عليه لسه. الملف ده مش بيخترع شكل نهائي - هو بس بيوفر
// normalized internal representation ثابت الشكل، عشان باقي المشروع
// (وقت ما الـremote client الحقيقي يتبني في Prompt 2B/2C) يتعامل دايمًا
// مع نفس الـshape المعروف، مش مع raw response جاي من الشبكة بأي بنية.
//
// أي حقل مش متوقع في الـraw response بيتجاهل تمامًا هنا (مش بيتخزن) -
// عشان منخزنش أي بيانات إضافية حساسة من غير سبب واضح (زي ما اتطلب).
// القيم الغلط الشكل (مش النوع المتوقع) بتترجع default آمن (null/[]) بدل
// ما تكسر أي حاجة.

const RESPONSE_VERSION_UNKNOWN = 'unknown';

/**
 * بتطبّع maxActivations بأمان - المشكلة اللي بنصلحها هنا: Number(null)
 * بيرجع 0 (مش NaN)، فكانت null بتتحول غلط لـ0 بدل ما تفضل null. كمان
 * بنرفض أي قيمة سالبة (مش منطقية لـmaxActivations).
 * @param {*} value
 * @returns {number|null}
 */
function normalizeMaxActivations(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

/**
 * بتطبّع أي قيمة تاريخ بأمان - `new Date(garbage)` بترجع "Invalid Date"
 * (instance صحيح من Date لكن بقيمة NaN جواه) بدل ما ترمي error، فمن غير
 * الفحص ده كانت ممكن تعدي كـ"تاريخ صحيح" غلط. missing/null/invalid كلهم
 * بيرجعوا null بشكل موحّد.
 * @param {*} value
 * @returns {Date|null}
 */
function normalizeDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * @typedef {Object} NormalizedRemoteLicenseState
 * @property {string|null} licenseId
 * @property {string} status
 * @property {Date|null} expiresAt
 * @property {string[]} allowedDomains
 * @property {number|null} maxActivations
 * @property {string[]} features
 * @property {string|null} buildId
 * @property {{activationId: string|null, status: string|null}|null} activation
 * @property {Date|null} serverIssuedAt
 * @property {string} responseVersion
 */

/**
 * بتحوّل raw response (أي شكل) لـNormalizedRemoteLicenseState ثابت -
 * pure function، مفيهاش أي DB/network call.
 * @param {Object|null} raw
 * @returns {NormalizedRemoteLicenseState|null} null لو الـraw مش object أصلًا
 */
function normalizeRemoteLicenseResponse(raw) {
  if (!raw || typeof raw !== 'object') return null;

  return {
    licenseId: typeof raw.licenseId === 'string' && raw.licenseId ? raw.licenseId : null,
    status: typeof raw.status === 'string' && raw.status ? raw.status : 'invalid',
    expiresAt: normalizeDate(raw.expiresAt),
    allowedDomains: Array.isArray(raw.allowedDomains)
      ? raw.allowedDomains.filter((d) => typeof d === 'string')
      : [],
    maxActivations: normalizeMaxActivations(raw.maxActivations),
    features: Array.isArray(raw.features) ? raw.features.filter((f) => typeof f === 'string') : [],
    buildId: typeof raw.buildId === 'string' && raw.buildId ? raw.buildId : null,
    activation:
      raw.activation && typeof raw.activation === 'object'
        ? {
            activationId: typeof raw.activation.activationId === 'string' ? raw.activation.activationId : null,
            status: typeof raw.activation.status === 'string' ? raw.activation.status : null,
          }
        : null,
    serverIssuedAt: normalizeDate(raw.serverIssuedAt),
    responseVersion: typeof raw.responseVersion === 'string' && raw.responseVersion ? raw.responseVersion : RESPONSE_VERSION_UNKNOWN,
  };
}

module.exports = { normalizeRemoteLicenseResponse, RESPONSE_VERSION_UNKNOWN };