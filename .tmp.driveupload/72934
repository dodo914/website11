const crypto = require('crypto');
const LicenseInstallation = require('../../models/LicenseInstallation');

// ============================================================
// ===== Installation ID Service (PART 1B) ======================
// ============================================================
// Storage choice: MongoDB (نفس الداتابيز الموجودة أصلًا) - مش ملف على
// الـdisk، ومش Redis (ممنوع بالتعليمات).
//   - الـinstallationId لازم يفضل ثابت بين كل server restart، وبيئات
//     الاستضافة السحابية المستخدمة هنا (زي ما واضح من BOSTA/PAYMOB
//     webhooks و.env.example comments عن Render/Railway) غالبًا فيها
//     ephemeral filesystem - يعني أي ملف بنكتبه على الـdisk ممكن يضيع
//     بعد deploy جديد. الداتابيز هي المكان الوحيد المضمون إنه ثابت.
//   - upsert atomic عن طريق findOneAndUpdate + $setOnInsert بيمنع إنشاء
//     أكتر من installationId لو حصل race بين طلبين وقت الإنشاء الأول
//     (نفس pattern الـatomic claim المستخدم في باقي المشروع، زي
//     orderIdempotencyService.js).
const INSTALLATION_DOC_ID = 'default';

let cachedInstallationId = null;

/**
 * بيرجّع الـinstallationId الثابت (بيتعمل create مرة واحدة بس لو مش
 * موجود). Memoized في الذاكرة بعد أول قراءة ناجحة في نفس الـprocess.
 * @returns {Promise<string>}
 */
async function getInstallationId() {
  if (cachedInstallationId) return cachedInstallationId;

  const candidate = crypto.randomUUID();
  const doc = await LicenseInstallation.findOneAndUpdate(
    { _id: INSTALLATION_DOC_ID },
    { $setOnInsert: { installationId: candidate } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  cachedInstallationId = doc.installationId;
  return cachedInstallationId;
}

/** للتستات فقط - بيمسح الـin-memory cache (مش الداتابيز). */
function _resetCacheForTests() {
  cachedInstallationId = null;
}

module.exports = { getInstallationId, _resetCacheForTests };
