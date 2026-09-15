// ============================================================================
// services/orderIdempotencyService.js  (P1-1: Order Creation Idempotency)
// ------------------------------------------------------------------------
// نفس مبدأ services/shipping/idempotency.js (withIdempotency) بالظبط، بس
// هنا لحماية إنشاء الـOrder نفسه بدل إنشاء الشحنة. اتبنت كـfactory
// (makeOrderIdempotencyService) عشان تتختبر بـ fake model بدون قاعدة بيانات
// حقيقية (شوف test/orderIdempotency.test.js) - النسخة المُصدَّرة افتراضيًا
// من هذا الملف بتستخدم موديل MongoDB الحقيقي (models/OrderIdempotency.js).
// ============================================================================

// سجل "in_progress" أقدم من كده بيتعتبر عالق (السيرفر وقع/اتقفل وهو لسه
// بينفذ) ومسموح نحاول تاني بدل ما نقفل على العميل ده للأبد. نفس القيمة
// المستخدمة في services/shipping/idempotency.js.
const IN_PROGRESS_TTL_MS = 2 * 60 * 1000; // دقيقتين

// كود خطأ الـduplicate key بتاع MongoDB.
const MONGO_DUPLICATE_KEY_CODE = 11000;

/**
 * makeOrderIdempotencyService(Model)
 *
 * بيرجع { claimOrderIdempotency, finalizeOrderIdempotency } مبنيين على
 * الـModel المُمرَّر (Mongoose Model حقيقي في الإنتاج، أو fake model في
 * الاختبارات - المطلوب بس إن يكون عنده create()/findOne() بنفس السلوك
 * المتوقع من Mongoose، بما فيه رمي error بـcode === 11000 عند تكرار
 * الـunique key).
 */
function makeOrderIdempotencyService(Model) {
  /**
   * claimOrderIdempotency(key, scope)
   *
   * يحاول "يحجز" مفتاح idempotency الخاص بمحاولة إنشاء طلب واحدة بشكل
   * atomic (Model.create مباشر بدل "find ثم insert" - الحماية الحقيقية من
   * الـrace condition هي الـunique index في الداتابيز نفسها).
   *
   * بيرجع واحدة من:
   *   { claimed: true, record }
   *     → إحنا المالكين لمحاولة التنفيذ دي دلوقتي. كمّل إنشاء الطلب عادي،
   *       وبعد ما تخلص (نجاح أو فشل) لازم تنادي finalizeOrderIdempotency(record, ...).
   *   { claimed: false, replay: { statusCode, body } }
   *     → فيه نتيجة محفوظة من محاولة ناجحة سابقة بنفس المفتاح بالظبط -
   *       رجّعها للعميل زي ما هي من غير ما تنشئ Order جديد (replay آمن).
   *   { claimed: false, busy: true }
   *     → فيه محاولة تانية شغالة فعليًا دلوقتي بنفس المفتاح (concurrent
   *       duplicate حقيقي - Request B وصل لحظة Request A لسه بيتنفذ).
   */
  async function claimOrderIdempotency(key, scope, requestHash = null) {
    let record;
    try {
      record = await Model.create({
        key, scope, requestHash, status: 'in_progress', attempts: 1, lastAttemptAt: new Date(),
      });
    } catch (err) {
      if (err.code !== MONGO_DUPLICATE_KEY_CODE) throw err;

      const existing = await Model.findOne({ key });
      if (!existing) return { claimed: false, busy: true };

      if (requestHash && existing.requestHash && existing.requestHash !== requestHash) {
        return { claimed: false, mismatch: true };
      }
      if (existing.status === 'completed') {
        return { claimed: false, replay: { statusCode: existing.statusCode || 201, body: existing.result } };
      }

      const staleBefore = new Date(Date.now() - IN_PROGRESS_TTL_MS);
      // Atomic conditional reclaim. Exactly one concurrent retry can win.
      const reclaimed = await Model.findOneAndUpdate(
        {
          key,
          $or: [
            { status: 'failed' },
            { status: 'in_progress', lastAttemptAt: { $lte: staleBefore } },
          ],
        },
        {
          $set: {
            status: 'in_progress',
            lastAttemptAt: new Date(),
            errorMessage: null,
            ...(requestHash ? { requestHash } : {}),
          },
          $inc: { attempts: 1 },
        },
        { new: true }
      );
      if (reclaimed) return { claimed: true, record: reclaimed };

      // Someone else won the reclaim between our read and update.
      return { claimed: false, busy: true };
    }

    return { claimed: true, record };
  }

  /**
   * finalizeOrderIdempotency(record, { statusCode, body, orderId })
   *
   * بتحدّث سجل الـidempotency بالنتيجة النهائية بعد ما إنشاء الطلب يخلص
   * (سواء نجاح أو فشل). 2xx/3xx = 'completed' (وبيتحفظ الـresponse body
   * كامل عشان أي retry جاي ياخده كـreplay). أي حاجة تانية = 'failed' (مش
   * poisoning دائم - claimOrderIdempotency فوق بيسمح بمحاولة تانية).
   *
   * فشل هنا (مثلاً مشكلة اتصال بالداتابيز وقت التحديث) بيتسجل في الـconsole
   * فقط ومبيوقفش إرسال الـresponse الحقيقي للعميل - الطلب نفسه (لو نجح)
   * يفضل ناجح برضو حتى لو تحديث سجل الـidempotency فشل.
   */
  async function finalizeOrderIdempotency(record, { statusCode, body, orderId = null } = {}) {
    if (!record) return;
    try {
      const isSuccess = Number(statusCode) >= 200 && Number(statusCode) < 300;
      record.status = isSuccess ? 'completed' : 'failed';
      record.statusCode = statusCode;
      record.result = isSuccess ? body : null;
      record.errorMessage = isSuccess ? null : (body && body.message) || null;
      if (orderId) record.orderId = orderId;
      await record.save();
    } catch (e) {
      console.error('تعذّر تحديث سجل idempotency الخاص بإنشاء الطلب:', e.message);
    }
  }

  return { claimOrderIdempotency, finalizeOrderIdempotency };
}

const OrderIdempotency = require('../models/OrderIdempotency');
const defaultService = makeOrderIdempotencyService(OrderIdempotency);

module.exports = {
  claimOrderIdempotency: defaultService.claimOrderIdempotency,
  finalizeOrderIdempotency: defaultService.finalizeOrderIdempotency,
  makeOrderIdempotencyService,
  IN_PROGRESS_TTL_MS,
};