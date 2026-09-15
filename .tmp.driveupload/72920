const path = require('path');
const crypto = require('crypto');

// ============================================================
// ===== LAVA_BUILD_ID foundation (PART 1A) ====================
// ============================================================
// الهدف: قيمة "buildId" ثابتة تعرّف نسخة الكود المنشورة دي (مش نسخة
// عشوائية بتتغير كل restart)، من غير أي معلومات شخصية أو secrets.
//
// طريقة الحساب (deterministic - نفس المدخلات = نفس الناتج دايمًا):
//   1) لو LICENSE_BUILD_ID متحدد في الـ.env -> يتستخدم زي ما هو
//      (ده اللي هيسمح مستقبلًا بعمل customer-specific builds من غير أي
//      تغيير في الكود، لكن في PART 1A مفيش packaging فعلي بيستخدمها).
//   2) لو مش متحدد -> بيتحسب hash قصير من (اسم المشروع + رقم الإصدار من
//      package.json). دي قيم ثابتة مش عشوائية، فالنتيجة بتفضل زي ما هي
//      بين كل restart طول ما package.json متغيرش.
// الناتج بيتخزن في الذاكرة (memoized) عشان محسبش الحساب أكتر من مرة في
// نفس الـprocess.
let cachedBuildId = null;

function readPackageInfo() {
  try {
    // eslint-disable-next-line global-require
    const pkg = require(path.join(__dirname, '..', '..', 'package.json'));
    return {
      name: pkg.name || 'lava-server',
      version: pkg.version || '0.0.0',
    };
  } catch (err) {
    return { name: 'lava-server', version: '0.0.0' };
  }
}

function computeDeterministicBuildId() {
  const { name, version } = readPackageInfo();
  const seed = `${name}@${version}`;
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

/**
 * يرجّع الـLAVA_BUILD_ID الحالي (ثابت طول عمر الـprocess، ومش عشوائي).
 *
 * ملحوظة مهمة (PART 1E review):
 *   CURRENT BUILD ID  ≠  CUSTOMER-SPECIFIC BUILD ID.
 * القيمة الحالية بتعرّف نسخة الكود المنشورة (نفس القيمة لكل عميل شغّال نفس
 * الإصدار) - مش build موقّع أو مخصص لعميل بعينه، ومش anti-tampering، ومش
 * جزء من أي signing scheme. الـcustomer-specific build fingerprinting
 * (build موقّع/مخصص لكل عميل يميّزه عن باقي النسخ) هيتضاف لاحقًا في
 * Prompt 2/3 مع الـLicense Server - النقطة الوحيدة اللي التصميم الحالي
 * بيسهّلها هي إن LICENSE_BUILD_ID (لو اتحدد صراحة في .env) بيتاخد زي ما هو
 * من غير أي تغيير في الكود وقتها.
 * @returns {string}
 */
function getBuildId() {
  if (cachedBuildId) return cachedBuildId;

  const fromEnv = (process.env.LICENSE_BUILD_ID || '').trim();
  cachedBuildId = fromEnv || computeDeterministicBuildId();
  return cachedBuildId;
}

module.exports = { getBuildId };