const mongoose = require('mongoose');

// ============================================================================
// ShippingIdempotency
// ------------------------------------------------------------------------
// بيحمي من إنشاء أكتر من شحنة (Shipment) لنفس الأوردر مع نفس شركة الشحن،
// حتى لو حصل:
//   - double click من الأدمن على زرار "إنشاء شحنة"
//   - refresh للصفحة وإعادة إرسال نفس الطلب
//   - retry تلقائي بعد timeout (من الـfrontend أو من أي مكان بينادي الـAPI)
//   - network failure وبعدين إعادة المحاولة
//   - اتنين request جايين في نفس اللحظة تمامًا (concurrent requests)
//
// آلية العمل:
//   1. الـidempotencyKey = ثابت ومحسوب من (orderId + provider + operation)
//      وليس عشوائي، عشان أي محاولتين لنفس العملية على نفس الأوردر يبقى
//      ليهم نفس المفتاح بالظبط.
//   2. فيه unique index على (orderId, provider, operation) في الداتابيز
//      نفسها - ده اللي بيمنع الـrace condition الحقيقي: حتى لو وصل
//      request-ين في نفس اللحظة بالظبط، MongoDB نفسها هترفض الإدراج
//      التاني (duplicate key error E11000)، مش بس الكود بتاعنا.
//   3. أول ما request يوصل، بنحاول ننشئ سجل بحالة "in_progress" (عن طريق
//      findOneAndUpdate + upsert، وده atomic operation في MongoDB). لو
//      نجحنا في الإنشاء، معنى كده احنا أول واحد ننفذ العملية دي فعليًا.
//      لو فشلنا (duplicate key) معنى كده فيه سجل موجود بالفعل، فبنرجع
//      نتيجته المحفوظة بدل ما ننشئ شحنة جديدة.
//   4. لما العملية تخلص (نجاح أو فشل)، بنحدّث السجل بالنتيجة النهائية
//      (status: 'completed' أو 'failed') عشان أي طلب جاي بعد كده ياخد
//      نفس النتيجة بالظبط من غير ما ينادي على شركة الشحن تاني.
//   5. سجل بحالة "in_progress" قديم جدًا (مثلاً فشل السيرفر نفسه أثناء
//      تنفيذ العملية وماكملش) بيتعتبر "منتهي الصلاحية" بعد IN_PROGRESS_TTL_MS
//      عشان منقفلش على الأوردر ده للأبد - وقتها بيبقى مسموح بمحاولة تانية.
// ============================================================================

const shippingIdempotencySchema = new mongoose.Schema({
  // orderId + provider + operation = المفتاح المنطقي الثابت للعملية.
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  provider: { type: String, required: true, lowercase: true, trim: true },
  operation: {
    type: String,
    required: true,
    enum: ['create_shipment', 'create_return', 'create_exchange', 'cancel_shipment'],
  },
  // نفس المفتاح بردو كـstring صريح (orderId:provider:operation) - مش بيستخدم
  // في أي query فعلي (الـindex المركب تحت هو المرجع الحقيقي)، بس بيتحفظ
  // كـsnapshot واضح يسهّل الـdebugging وقراءة الداتا من الداتابيز مباشرة.
  idempotencyKey: { type: String, required: true },

  status: {
    type: String,
    enum: ['in_progress', 'completed', 'failed'],
    default: 'in_progress',
  },

  // نتيجة العملية بعد ما تخلص - أي request جاي تاني بنفس المفتاح بياخد
  // نفس الـresult ده تمامًا من غير ما ينادي على شركة الشحن مرة تانية.
  result: { type: mongoose.Schema.Types.Mixed, default: null },
  errorMessage: { type: String, default: null },

  // اسم الـprovider الخاص بيه الـofficial idempotency support (لو موجود) -
  // بعض شركات الشحن بتدعم idempotency key رسمي في الـAPI بتاعتها. لو
  // استخدمناه، بيتسجل هنا للمرجعية.
  providerIdempotencyKey: { type: String, default: null },

  attempts: { type: Number, default: 1 },
  lastAttemptAt: { type: Date, default: Date.now },
}, { timestamps: true });

// الحماية الحقيقية من الـduplicate/race condition: MongoDB نفسها هترفض أي
// إدراج تاني بنفس (orderId, provider, operation) - مش مجرد فحص منطقي في الكود.
shippingIdempotencySchema.index({ orderId: 1, provider: 1, operation: 1 }, { unique: true });

module.exports = mongoose.model('ShippingIdempotency', shippingIdempotencySchema);