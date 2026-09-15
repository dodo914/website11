const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const { requireLicenseEnforcement } = require('../services/license/licenseEnforcementService');

// ============================================================
// ===== LAVA License Status Route (PART 2B-2C-3) =================
// ============================================================
// أول route فعلي بيستخدم requireLicenseEnforcement() - وده الوحيد. الـ
// route ده مش storefront، مش orders/payments/shipping، ومحمي admin-only
// أصلًا (protect + authorize('admin')) قبل ما يوصل للـenforcement.
//
// ترتيب المعنى هنا مهم: admin auth (protect + authorize) بتتنفذ *قبل*
// requireLicenseEnforcement() - يعني لازم تكون staff/admin مسجل دخول
// أصلًا قبل ما تعرف حالة الترخيص، مش أي حد بره النظام.
//
// requireLicenseEnforcement() هنا شغال بالـdefaults بتاعته (مفيش أي
// override) - يعني licenseId بيتقرا من الـconfigured server-side license
// context (.env بس - نفس مصدر PART 1C)، والـactivation/domain بيترجعوا من lookup حقيقي على
// LicenseActivation - **مفيش أي قيمة من الـrequest (headers/query/body)
// بتتقرا أو بتأثر على القرار خالص**.
router.get('/status', protect, authorize('admin'), requireLicenseEnforcement(), (req, res) => {
  // لو وصلنا هنا يبقى الـenforcement سمح بالعملية بالفعل (allowed: true) -
  // مفيش داعي نكرر التفاصيل، الـresponse هنا بس تأكيد بسيط وآمن للـadmin
  // panel، من غير ما نسرّب أي remote payload/secrets.
  return res.json({ licensed: true });
});

module.exports = router;