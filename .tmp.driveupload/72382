const mongoose = require('mongoose');

// ============================================================================
// OrderIdempotency  (P1-1: Order Creation Idempotency)
// ------------------------------------------------------------------------
// بتحمي من إنشاء أكتر من Order لنفس محاولة "تأكيد الطلب" حتى لو حصل:
//   - double click من العميل على زرار "تأكيد الطلب"
//   - المتصفح بيعيد إرسال نفس الـrequest (browser retry)
//   - network timeout والعميل/الفرونت بيعيد المحاولة تلقائيًا
//   - reverse proxy بيعيد إرسال نفس الـrequest (retry على مستوى الشبكة)
//   - نفس طلب الـcheckout اتبعت أكتر من مرة بالغلط
//
// نفس المبدأ المستخدم بالظبط في models/ShippingIdempotency.js (اللي كان
// شغال بالفعل لحماية إنشاء الشحنات) - هنا بنستخدمه لحماية إنشاء الـOrder
// نفسه بدل الشحنة:
//   1. الـkey بييجي من الفرونت (قيمة عشوائية - UUID - بتتولد مرة واحدة لكل
//      "محاولة تأكيد طلب" وتفضل هي هي لو نفس الطلب اتعاد إرساله). بنربطها
//      بهوية مقدّم الطلب (customerId المسجّل أو 'guest') عشان عميل ميقدرش
//      يستخدم مفتاح عميل تاني عمدًا ويشوف نتيجة طلب مش بتاعه - شوف
//      controllers/orderController.js (createOrder) لطريقة بناء الـkey.
//   2. فيه unique index على key نفسه في الداتابيز - ده اللي بيمنع الـrace
//      condition الحقيقي: حتى لو وصل request-ين في نفس اللحظة بالظبط،
//      MongoDB نفسها هترفض الإدراج التاني (duplicate key error E11000)،
//      مش بس فحص منطقي في الكود ("find first, then insert" مش آمن هنا).
//   3. أول ما request يوصل، بنحاول ننشئ سجل بحالة "in_progress" (Model.create
//      مباشر - عملية atomic في MongoDB بسبب الـunique index). لو نجحنا،
//      معنى كده احنا أول واحد بينفذ العملية دي فعليًا. لو فشلنا بسبب
//      duplicate key، بنرجع نتيجة السجل الموجود بدل ما ننشئ Order جديد.
//   4. لما إنشاء الطلب يخلص (نجاح أو فشل)، بنحدّث السجل بالنتيجة النهائية
//      (status: 'completed' أو 'failed' + statusCode + result) عشان أي
//      retry جاي بعد كده ياخد نفس النتيجة/الـresponse بالظبط من غير ما
//      يعمل Order تاني.
//   5. فشل حقيقي في إنشاء الطلب (خطأ تحقق، نفاد مخزون، فشل بوابة دفع...)
//      بيتسجل كـ'failed' مش بيقفل المفتاح للأبد - أي محاولة تانية بنفس
//      المفتاح (بعد ما العميل يصلّح المشكلة مثلاً) مسموح تتنفذ فعليًا من
//      جديد (شوف services/orderIdempotencyService.js).
//   6. سجل "in_progress" قديم جدًا (مثلاً السيرفر وقع أثناء التنفيذ ومكملش)
//      بيتعتبر عالق بعد IN_PROGRESS_TTL_MS ومسموح بمحاولة تانية بدل ما
//      نقفل على العميل ده للأبد.
// ============================================================================

const orderIdempotencySchema = new mongoose.Schema({
  // المفتاح الفعلي = `${scope}:${clientKey}` (scope = 'user:<id>' أو 'guest') -
  // شوف orderController.js. ده هو المرجع الوحيد المستخدم في أي query فعلي.
  key: { type: String, required: true },

  // نفس معلومة الـscope بس منفصلة كـsnapshot واضح للـdebugging/القراءة
  // المباشرة من الداتابيز (مش بيتستخدم في أي query).
  scope: { type: String, required: true },

  // ===== SECURITY HARDENING: نفس المفتاح + طلب مختلف لازم يترفض =====
  // hash لمحتوى الطلب المنطقي (السلة/كود الخصم/طريقة الدفع - شوف
  // utils/orderIdempotencyKey.js: hashOrderPayload). لو نفس المفتاح
  // اتبعت تاني بـhash مختلف، ده مش retry حقيقي لنفس المحاولة - إما خطأ
  // في الفرونت (مفتاح اترجّع استخدامه غلط) أو محاولة تلاعب، فبنرفضه بدل
  // ما نرجّع نتيجة الطلب الأول (replay) أو نسمح بتنفيذه فوق نفس السجل.
  requestHash: { type: String, default: null },

  status: {
    type: String,
    enum: ['in_progress', 'completed', 'failed'],
    default: 'in_progress',
  },

  // الكود الفعلي للـresponse اللي رجع للعميل (201 نجاح، 400/409/502/500 فشل...).
  statusCode: { type: Number, default: null },

  // مرجع للـOrder اللي اتعمل فعليًا (لو نجحت المحاولة) - مفيد للـdebugging
  // والتقارير، مش بيتستخدم لمنع التكرار (ده شغل الـunique index على key).
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },

  // نفس الـresponse body اللي اتبعت للعميل وقت النجاح - أي retry جاي بعد
  // كده بيتبعتله نفس الـbody ده بالظبط (replay آمن)، من غير أي منطق عمل تاني.
  result: { type: mongoose.Schema.Types.Mixed, default: null },
  errorMessage: { type: String, default: null },

  attempts: { type: Number, default: 1 },
  lastAttemptAt: { type: Date, default: Date.now },
}, { timestamps: true });

// الحماية الحقيقية من الـduplicate/race condition: MongoDB نفسها هترفض أي
// إدراج تاني بنفس الـkey - مش مجرد فحص منطقي في الكود.
orderIdempotencySchema.index({ key: 1 }, { unique: true });

// تنظيف تلقائي للسجلات القديمة (30 يوم) عشان الكولكشن مايكبرش للأبد -
// مفيش أي حاجة في منطق الحماية نفسه بتعتمد على بقاء السجل بعد ما يخلص
// الـcheckout بفترة طويلة.
orderIdempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('OrderIdempotency', orderIdempotencySchema);