const ShippingIdempotency = require('../../models/ShippingIdempotency');

// سجل "in_progress" أقدم من كده بيتعتبر عالق (السيرفر وقع/اتقفل وهو لسه
// بينفذ) ومسموح نحاول تاني بدل ما نقفل على الأوردر ده للأبد.
const IN_PROGRESS_TTL_MS = 2 * 60 * 1000; // دقيقتين

// كود خطأ الـduplicate key بتاع MongoDB.
const MONGO_DUPLICATE_KEY_CODE = 11000;

/**
 * withIdempotency({ orderId, provider, operation, providerIdempotencyKey }, fn)
 *
 * بينفذ fn() (اللي فعليًا بتنادي على شركة الشحن) مرة واحدة بس لكل
 * (orderId, provider, operation)، حتى مع concurrent requests أو retries.
 *
 * بيرجع: { executed: boolean, result }
 *   - executed=true  => احنا فعلاً نفذنا العملية دلوقتي (أول مرة).
 *   - executed=false => فيه نتيجة محفوظة بالفعل من محاولة سابقة، رجعناها
 *     من غير ما ننادي fn() تاني (يعني منعنا duplicate shipment فعليًا).
 *
 * لو fn() رمت error، بيتسجل الفشل في السجل (status: 'failed') وبترمي
 * الـerror تاني لفوق عادي عشان الـcontroller يتعامل معاها زي ما هو متوقع،
 * لكن مع تحديث عدد المحاولات attempts عشان لو حصل retry تاني بعدها.
 */
async function withIdempotency({ orderId, provider, operation, providerIdempotencyKey = null }, fn) {
  const idempotencyKey = `${orderId}:${provider}:${operation}`;

  // الخطوة الأساسية: نحاول "نحجز" السجل ده بشكل atomic. لو already موجود
  // بحالة completed/failed، منرجعش نحاول تاني - بنرجع النتيجة المحفوظة على
  // طول. لو already موجود بحالة in_progress وحديث (لسه جوه TTL)، معنى كده
  // فيه محاولة تانية شغالة فعليًا دلوقتي (concurrent request) - منعملش
  // حاجة ونرجع "مشغول حاليًا" واضح بدل ما نستنى أو نكرر النداء.
  let record;
  try {
    record = await ShippingIdempotency.create({
      orderId, provider, operation, idempotencyKey, providerIdempotencyKey,
      status: 'in_progress', attempts: 1, lastAttemptAt: new Date(),
    });
  } catch (err) {
    if (err.code !== MONGO_DUPLICATE_KEY_CODE) throw err;

    const now = new Date();
    const staleBefore = new Date(Date.now() - IN_PROGRESS_TTL_MS);

    // Atomic reclaim: only ONE concurrent retry can change failed/stale
    // -> in_progress. A second request will no longer pass a stale read and
    // call the shipping provider in parallel.
    const reclaimed = await ShippingIdempotency.findOneAndUpdate(
      {
        orderId, provider, operation,
        $or: [
          { status: 'failed' },
          { status: 'in_progress', lastAttemptAt: { $lte: staleBefore } },
        ],
      },
      {
        $set: {
          status: 'in_progress',
          lastAttemptAt: now,
          errorMessage: null,
          providerIdempotencyKey: providerIdempotencyKey || undefined,
        },
        $inc: { attempts: 1 },
      },
      { new: true }
    );

    if (reclaimed) {
      record = reclaimed;
    } else {
      const existing = await ShippingIdempotency.findOne({ orderId, provider, operation });
      if (!existing) {
        const e = new Error('تعارض مؤقت أثناء معالجة العملية، حاول تاني بعد لحظات');
        e.status = 409;
        throw e;
      }
      if (existing.status === 'completed') {
        return { executed: false, result: existing.result };
      }
      const e = new Error(existing.status === 'failed'
        ? 'تعذر حجز محاولة جديدة للعملية، حاول مرة أخرى'
        : 'العملية دي قيد التنفيذ بالفعل (طلب آخر بيعالجها الآن)، من فضلك انتظر قليلاً');
      e.status = 409;
      throw e;
    }
  }

  // من هنا واحنا فعلاً "الوحيدين" اللي بننفذ العملية دلوقتي - آمن نتصل بشركة الشحن.
  try {
    const result = await fn();
    record.status = 'completed';
    record.result = result;
    record.errorMessage = null;
    await record.save();
    return { executed: true, result };
  } catch (err) {
    record.status = 'failed';
    record.errorMessage = err.message || 'فشلت العملية';
    await record.save();
    throw err;
  }
}

module.exports = { withIdempotency, IN_PROGRESS_TTL_MS };