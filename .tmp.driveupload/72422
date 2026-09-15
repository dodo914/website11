// ============================================================================
// middleware/rateLimitIdentity.js
// ----------------------------------------------------------------------------
// جزء من إصلاح مشكلة "Too many requests, please try again later." اللي كانت
// بتظهر مع زيادة الاستخدام (خصوصًا فتح Admin Dashboard) ولا تُحل إلا بإعادة
// تشغيل السيرفر.
//
// السبب الحقيقي (Root cause):
// الـglobal limiter (createLimiter في server.js) كان دلو واحد مشترك بالـIP
// لكل حاجة تحت /api - زوار الموقع العاديين + طلبات تسجيل الدخول + Admin
// Dashboard كلهم بياخدوا من نفس الـ400 طلب/15 دقيقة (production). لوحة تحكم
// الأدمن وحدها بتعمل auto-refresh كل 10 ثواني لأكتر من قسم (عملاء، سلات
// متروكة، طلبات، طلبات استبدال) طول ما فيه موظف مسجّل دخول - ده لوحده بيولّد
// أكتر من 350 طلب كل 15 دقيقة من تاب واحد بس فاتح وواقف من غير ما حد يعمل
// حاجة، فبيستهلك تقريبًا كل الدلو المشترك، وأي طلب حقيقي زيادة (تاب تاني،
// جهاز زميل على نفس شبكة المكتب، عميل بيتصفح المتجر) بيرجّع 429 بسرعة جدًا -
// وده اللي كان شكله "السيرفر وقع" مع إنه لسه شغال عادي وبس بيرفض الطلبات
// الزيادة. إعادة تشغيل السيرفر بتصفّر عداد الـMemoryStore (تخزين في نفس
// الـprocess) فبيرجع "يشتغل" مؤقتًا لحد ما العداد يمتلئ تاني.
//
// الحل: مفيش رفع لأي رقم بشكل عشوائي. بدل كده، بنفصل حركة "الموظف المسجّل
// دخول" (admin/call_center/packer/staff) عن حركة "الزائر/العميل" في دلو
// مستقل مربوط بحساب الموظف نفسه (staffId) مش بالـIP، عشان:
//   1) استخدام الأدمن الطبيعي (حتى مع auto-refresh) ميتصادمش مع زوار الموقع
//      العاديين على نفس الدلو.
//   2) أكتر من موظف/تاب خلف نفس الـIP (شبكة مكتب، أو بيئة local development
//      اللي كل حد فيها بيبان بنفس الـIP لأن trust proxy مش مفعّل غير في
//      production - شوف server.js) ميتحاسبوش على بعض غلط.
// الحد العام (createLimiter) بيفضل زي ما هو تمامًا لحماية الزوار/الـpublic
// traffic - مفيش أي تخفيف في الحماية دي.
//
// ملحوظة أمان مهمة: التصنيف هنا (staff ولا لأ) بيتحسب من توقيع الـJWT بس
// (من غير أي DB lookup) عشان يبقى خفيف وسريع كـmiddleware بيشتغل على كل
// طلب. ده مش قرار صلاحيات - قرار الصلاحيات الفعلي (وأي تحقق من tokenVersion
// لتوكن ملغي بعد logout/تغيير باسورد) لسه بيحصل بالكامل زي ما هو في
// middleware/auth.js (protect/authorize/access) من غير أي تغيير. أسوأ
// سيناريو لو توكن قديم/ملغي اتصنّف هنا "موظف" غلط: ياخد دلو rate-limit أوسع
// لثواني قليلة قبل ما protect() يرفضه فعليًا - مفيش أي صلاحية أو بيانات
// إضافية بتتاح من هنا.
// ============================================================================

const jwt = require('jsonwebtoken');
const { AUTH_COOKIE_NAME } = require('../utils/cookieAuth');

const STAFF_ROLES = ['admin', 'call_center', 'packer', 'staff'];

// بيرجع { isStaffRequest, staffId } من غير ما يرمي أي error ومن غير أي
// اتصال بالداتابيز - آمن يتنفذ على كل طلب.
const classifyRateLimitRequest = (req) => {
  try {
    const token = req.cookies && req.cookies[AUTH_COOKIE_NAME];
    if (!token) return { isStaffRequest: false, staffId: null };

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded && decoded.id && STAFF_ROLES.includes(decoded.role)) {
      return { isStaffRequest: true, staffId: String(decoded.id) };
    }
  } catch (_err) {
    // توكن غلط/منتهي/غير موجود - يتعامل كزائر لغرض تصنيف الـrate limit بس.
    // (لو فعلاً محتاج تسجيل دخول، middleware/auth.js هيرفضه برسالة واضحة).
  }
  return { isStaffRequest: false, staffId: null };
};

const identifyRateLimitRequest = (req, res, next) => {
  const { isStaffRequest, staffId } = classifyRateLimitRequest(req);
  req.isStaffRequest = isStaffRequest;
  req.staffId = staffId;
  next();
};

module.exports = { classifyRateLimitRequest, identifyRateLimitRequest, STAFF_ROLES };