const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Counter = require('../models/Counter');
const Order = require('../models/Order');

// ============================================================
// ===== سكريبت لمرة واحدة: تصفير عداد رقم الأوردر ليبدأ من 1000 =====
// المشكلة: كان فيه document قديم في collection الـ"counters" اسمه
// "orderNumber" بقيمة seq أقل من 1000 (زي 0 مثلاً) من نسخة قديمة من الكود،
// فالعداد كمّل من عليها (1، 2، 3...) بدل ما يبدأ من 1001 زي المطلوب.
//
// السكريبت ده:
// 1. بيجيب أعلى orderNumber موجود فعليًا في الأوردرات (Order collection).
// 2. بيحسب أعلى قيمة بين (1000) و(أعلى orderNumber موجود) - عشان لو عندك
//    فعلاً أوردرات وصلت لرقم أكبر من 1000 (مثلاً 1500)، السكريبت مش هيرجّع
//    العداد لتحت ويعمل تكرار في الأرقام (نفس الرقم لأوردرين مختلفين) -
//    وده بالظبط اللي يضمن "مش هيبوظ حاجة".
// 3. بيحدّث الـCounter لنفس القيمة دي، فأول أوردر جديد بعد السكريبت هياخد
//    رقم = (القيمة دي + 1).
//
// طريقة التشغيل (من مجلد server_build):
//   node scripts/fixOrderNumberCounter.js
// ============================================================

const run = async () => {
  await connectDB();

  const highestOrder = await Order.findOne({ orderNumber: { $ne: null } })
    .sort({ orderNumber: -1 })
    .select('orderNumber')
    .lean();

  const highestExisting = highestOrder && Number.isFinite(highestOrder.orderNumber)
    ? highestOrder.orderNumber
    : 0;

  const targetSeq = Math.max(1000, highestExisting);

  const before = await Counter.findById('orderNumber').lean();
  const beforeSeq = before ? before.seq : null;

  if (before && before.seq >= targetSeq) {
    console.log(`لا داعي للتعديل: العداد الحالي (${before.seq}) أكبر من أو يساوي ${targetSeq} بالفعل.`);
  } else {
    await Counter.findByIdAndUpdate(
      'orderNumber',
      { $set: { seq: targetSeq } },
      { upsert: true, setDefaultsOnInsert: true }
    );
    console.log(`تم تعديل العداد: من ${beforeSeq === null ? '(غير موجود)' : beforeSeq} إلى ${targetSeq}.`);
    console.log(`أول أوردر جديد هياخد رقم: ${targetSeq + 1}`);
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('فشل السكريبت:', err);
  process.exit(1);
});