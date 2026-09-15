const crypto = require('crypto');

// ============================================================
// ===== LAVA Remote License Signature Service (PART 2B-1) ======
// ============================================================
// الملف ده مسؤول عن حاجتين بس:
//   1) canonical payload generation (PART G) - تمثيل deterministic ثابت
//      من أي remote response object، عشان License Server (مستقبلًا)
//      وLAVA Backend (هنا) يقدروا ينتجوا نفس الـbytes بالظبط للتحقق.
//   2) signature verification (PART H) - التحقق من إمضاء Ed25519 فوق
//      الـcanonical payload ده، باستخدام public key بس.
//
// أمان (PART F - مهم جدًا):
//   PRIVATE KEY NEVER EXISTS IN CUSTOMER LAVA BACKEND.
// الملف ده بيتعامل مع public key بس (LICENSE_SERVER_PUBLIC_KEY من الـ.env)
// - مفيش أي private/signing key هنا ولا في أي ملف تاني بالمشروع. توليد
// مفتاح Ed25519 حقيقي للإنتاج مؤجل بالكامل لمرحلة تانية (PART R).
//
// Fail-closed بالكامل: أي حالة غير مؤكدة 100% (missing signature/key,
// malformed base64/PEM, mismatched bytes) بترجع `false` - مفيش fallback
// لـ"نثق في الرد على أي حال"، ومفيش تفاصيل crypto داخلية بتتسرب للـcaller
// (لا stack، ولا سبب الفشل بالظبط) - ده intentional عشان منديش أي معلومة
// تساعد على تزوير إمضاء لاحقًا.

// ---- PART G: canonical payload ----
// بدل JSON.stringify(object) العشوائي (اللي ترتيب مفاتيحه بيعتمد على
// ترتيب الإدراج، مش ثابت لو نفس الـdata اتبنت بترتيب مختلف)، بنعمل ترتيب
// مفاتيح متكرر (recursive) أبجديًا قبل الـstringify. الـcontract:
//   - field ordering: كل مستويات الـobject بترتب مفاتيحها أبجديًا (لا
//     يوجد اعتماد على ترتيب إدراج الحقول الأصلي).
//   - null handling: `undefined` يتحول لـ`null` صراحة (JSON.stringify
//     العادي بيحذف مفاتيح الـundefined تمامًا وده بيغيّر الـbytes حسب
//     وجود الحقل من عدمه - إحنا عايزين سلوك ثابت بدل كده).
//   - string encoding: UTF-8 (نفس ترميز JSON.stringify + Buffer.from
//     الافتراضي بالنود).
//   - version + operation + requestId مضمونين دايمًا كجزء من الـpayload
//     الموقّع (عشان توقيع لعملية/نسخة/طلب معين منفعش يتعاد استخدامه لحاجة
//     تانية - binds الإمضاء للـcontext بتاعه).
//   - الـresponse data نفسها بتتحط جوه `data` field.
//
// مفيش مكتبة canonicalization خارجية (زي json-canonicalize) - الـ
// implementation بسيطة وكافية للحالة دي (object بسيط، مفيهوش أرقام
// عشرية غريبة أو edge cases تانية بيحتاجها JCS الكامل).
//
// ---- SECURITY FIX (review بعد PART 2B-1): كل حقول الـresponse envelope
// المؤثرة على security/protocol/business interpretation لازم تكون جوه
// الـsigned payload، مش بس `data`. قبل الـfix ده، `timestamp` و`success`
// و`code` مكنوش موقّعين - يعني مهاجم قادر (مبدئيًا) يغيّر أي منهم من غير
// ما الإمضاء تبقى invalid، مع إننا بنعتمد على `timestamp` في الـ
// freshness/replay foundation وعلى `success`/`code` في تفسير الـresponse.
// الـcanonical signed payload بقى صراحة:
//   protocolVersion, operation, requestId, timestamp, success, code, data
// وده intentional وموثّق هنا كـcontract - مش تفصيل تنفيذي عشوائي.
//
// `message` **مش** جزء من الـsigned payload، وده قرار مقصود: `message`
// أصلًا ممنوع يكون مصدر قرار أمني/business (زي ما موضح في
// licenseRemoteResponsePipeline.js) - القرارات كلها بتتاخد من `code` +
// `data` الموقّعين. بما إن `message` نفسها مش بتتقرا في أي قرار، توقيعها
// كان هيضيف تعقيد من غير أي فايدة أمنية فعلية (لو غيّرها حد، مفيش قرار
// هيتغيّر أصلًا). لو الـmessage احتاجت مستقبلًا تتستخدم في حاجة (زي عرضها
// كـerror للمستخدم النهائي)، القرار ده لازم يتراجع وقتها.
// `signature` نفسها **مش** بتدخل جوه نفسها بديهيًا (مفيش circular signing).

/**
 * بيرتب مفاتيح أي object أبجديًا بشكل recursive، وبيحول أي `undefined`
 * لـ`null` صراحة. Arrays بتفضل بنفس الترتيب (الترتيب فيها معنوي).
 * @param {*} value
 * @returns {*}
 */
function sortKeysDeep(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const sortedKeys = Object.keys(value).sort();
    const result = {};
    for (const key of sortedKeys) {
      result[key] = sortKeysDeep(value[key]);
    }
    return result;
  }
  return value;
}

/**
 * بيبني الـcanonical bytes اللي بيتم التوقيع/التحقق عليها - ده تحديدًا
 * الـ**response** signing payload (مش أي payload تاني/عام)، وبيغطي كل
 * حقول الـenvelope المؤثرة على security/protocol/business interpretation:
 * protocolVersion, operation, requestId, timestamp, success, code, data.
 * `message` و`signature` عمدًا مش جوه (شوف الشرح فوق).
 *
 * `success` بيتفحص بـ`typeof === 'boolean'` صراحة (مش truthiness) عشان
 * `success: false` قيمة شرعية ومهمة - لازم تتفرق عن "الحقل مش موجود
 * أصلًا"، وfalsy check عادي كان هيغلط في الحالة دي.
 * @param {{protocolVersion: string, operation: string, requestId: string, timestamp: string, success: boolean, code: string, data?: Object|null}} input
 * @returns {Buffer}
 */
function buildCanonicalSigningPayload({ protocolVersion, operation, requestId, timestamp, success, code, data } = {}) {
  if (!protocolVersion || !operation || !requestId || !timestamp) {
    throw new Error('buildCanonicalSigningPayload requires protocolVersion, operation, requestId and timestamp');
  }
  if (typeof success !== 'boolean') {
    throw new Error('buildCanonicalSigningPayload requires a boolean success flag');
  }
  if (!code) {
    throw new Error('buildCanonicalSigningPayload requires code');
  }
  const canonicalObject = sortKeysDeep({
    protocolVersion,
    operation,
    requestId,
    timestamp,
    success,
    code,
    data: data === undefined ? null : data,
  });
  return Buffer.from(JSON.stringify(canonicalObject), 'utf8');
}

// ---- PART F/H: public key loading + signature verification ----

/**
 * بيحمّل الـpublic key من PEM string (من الـ.env افتراضيًا) - آمن دايمًا:
 * مفيش/فاضي/PEM غلط الشكل -> `null` (مش throw)، عشان الـcaller يقدر
 * يتعامل معاها كـ"فشل تحقق" عادي.
 * @param {string} [pemOverride] - يفيد في التستات، وإلا بيقرا من LICENSE_SERVER_PUBLIC_KEY
 * @returns {import('crypto').KeyObject|null}
 */
function loadPublicKey(pemOverride) {
  const pem = (pemOverride !== undefined ? pemOverride : process.env.LICENSE_SERVER_PUBLIC_KEY || '').trim();
  if (!pem) return null;
  try {
    const key = crypto.createPublicKey(pem);
    // نتأكد إنه فعلًا Ed25519 مش نوع تاني اتحط بالغلط في الـenv.
    if (key.asymmetricKeyType !== 'ed25519') return null;
    return key;
  } catch (err) {
    return null;
  }
}

/**
 * بيتحقق من إمضاء Ed25519 فوق الـcanonical payload. **Fail-closed**: أي
 * سبب فشل (missing signature, malformed signature, missing/malformed
 * public key, altered payload) بيرجع `false` بنفس الشكل - من غير أي
 * تمييز بين الأسباب للـcaller الخارجي (عشان منسربش تفاصيل crypto).
 * @param {{protocolVersion: string, operation: string, requestId: string, timestamp: string, success: boolean, code: string, data?: Object|null, signature: string, publicKeyPem?: string}} input
 * @returns {boolean}
 */
function verifyRemoteResponseSignature({ protocolVersion, operation, requestId, timestamp, success, code, data, signature, publicKeyPem } = {}) {
  try {
    if (!protocolVersion || !operation || !requestId || !timestamp) return false;
    if (typeof success !== 'boolean') return false;
    if (!code) return false;
    if (!signature || typeof signature !== 'string') return false;

    const publicKey = loadPublicKey(publicKeyPem);
    if (!publicKey) return false;

    let signatureBuffer;
    try {
      signatureBuffer = Buffer.from(signature, 'base64');
    } catch (err) {
      return false;
    }
    if (!signatureBuffer.length) return false;

    const payload = buildCanonicalSigningPayload({ protocolVersion, operation, requestId, timestamp, success, code, data });

    // Ed25519: أول argument (algorithm) لازم يكون null - الخوارزمية
    // نفسها بتحدد الـhashing جوه المفتاح، مفيش hash منفصل زي RSA/ECDSA.
    return crypto.verify(null, payload, publicKey, signatureBuffer);
  } catch (err) {
    // أي exception غير متوقعة (مفتاح تالف بشكل غريب، إلخ) = فشل تحقق،
    // مش crash، ومفيش تفاصيل الـerror بترجع للـcaller.
    return false;
  }
}

module.exports = {
  sortKeysDeep,
  buildCanonicalSigningPayload,
  loadPublicKey,
  verifyRemoteResponseSignature,
};