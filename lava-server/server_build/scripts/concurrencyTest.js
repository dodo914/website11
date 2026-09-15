/**
 * اختبار concurrency لمنع الـ overselling.
 *
 * السكريبت ده بيعمل الآتي:
 *  1. يوصل بقاعدة البيانات المحددة في MONGODB_URI (بيفضل تستخدمه على قاعدة بيانات تجريبية، مش الإنتاج).
 *  2. يعمل منتج تجريبي بمخزون محدود (مثلاً 5 قطع).
 *  3. يطلق 20 طلب "شراء" في نفس اللحظة (Promise.all) لنفس المنتج/الفاريانت/المقاس،
 *     كل طلب بيحاول يشتري قطعة واحدة (يعني 20 طلب على 5 قطع فقط).
 *  4. يتأكد إن عدد الطلبات اللي نجحت = بالظبط المخزون المتاح (5)، والباقي رجع OUT_OF_STOCK.
 *  5. يتأكد إن الـ stock النهائي في قاعدة البيانات = 0 بالظبط (مش رقم سالب ولا فيه كمية ضاعت).
 *
 * تشغيل:
 *   node scripts/concurrencyTest.js
 *
 * ملحوظة: يستخدم نفس دالة decrementOrderItems المستخدمة فعليًا في createOrder،
 * فالنتيجة بتعكس سلوك النظام الحقيقي عند حدوث نفس اللحظة لعدة عملاء.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { decrementOrderItems, restoreOrderItems } = require('../utils/inventory');

const CONCURRENT_REQUESTS = 20;
const INITIAL_STOCK = 5;

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI غير موجود في .env — لازم تشغّل السكريبت في بيئة فيها اتصال بقاعدة بيانات (يفضل تجريبية).');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB for concurrency test.');

  // ===== إنشاء منتج تجريبي بمخزون محدود =====
  const testProduct = await Product.create({
    name: { ar: 'منتج اختبار الـ concurrency', en: 'Concurrency Test Product' },
    price: 100,
    visibility: 'published',
    variants: [
      {
        id: 'test-variant',
        color: { ar: 'أسود', en: 'Black' },
        sizeStock: [{ size: 'M', sku: 'TEST-M', stock: INITIAL_STOCK }],
      },
    ],
  });

  console.log(`Created test product ${testProduct._id} with stock=${INITIAL_STOCK}`);

  const item = {
    productId: String(testProduct._id),
    variantId: 'test-variant',
    size: 'M',
    quantity: 1,
  };

  // ===== إطلاق N طلب في نفس اللحظة بالظبط لنفس المنتج =====
  const attempts = Array.from({ length: CONCURRENT_REQUESTS }, () => decrementOrderItems([item]));
  const results = await Promise.all(attempts);

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  const finalProduct = await Product.findById(testProduct._id).lean();
  const finalStock = finalProduct.variants[0].sizeStock[0].stock;

  console.log('====================================');
  console.log(`Concurrent requests sent : ${CONCURRENT_REQUESTS}`);
  console.log(`Succeeded (got stock)    : ${succeeded}`);
  console.log(`Failed (OUT_OF_STOCK)    : ${failed}`);
  console.log(`Final stock in DB        : ${finalStock}`);
  console.log('====================================');

  const overSold = finalStock < 0;
  const correctSuccessCount = succeeded === INITIAL_STOCK;
  const correctFinalStock = finalStock === 0;

  if (!overSold && correctSuccessCount && correctFinalStock) {
    console.log('✅ PASSED: لم يحدث overselling. عدد الطلبات الناجحة يساوي المخزون بالظبط، والمخزون النهائي = 0.');
  } else {
    console.log('❌ FAILED: في مشكلة — راجع الكود.');
  }

  // تنظيف: إرجاع أي كمية اتخصمت (لو حابب تسيب المنتج التجريبي كما هو، شيل السطر ده)
  await Product.deleteOne({ _id: testProduct._id });
  console.log('Cleaned up test product.');

  await mongoose.disconnect();
  process.exit(overSold || !correctSuccessCount || !correctFinalStock ? 1 : 0);
}

run().catch((err) => {
  console.error('Concurrency test crashed:', err);
  process.exit(1);
});
