const Counter = require('../models/Counter');
const Order = require('../models/Order');

// ============================================================================
// توليد رقم أوردر متسلسل بشكل آمن.
//
// الـCounter بيخزن "آخر رقم أوردر" نفسه، وليس offset يتم جمعه مع 1000.
// قبل زيادة العداد، نرفع قيمته atomically إلى أكبر رقم موجود فعليًا في
// orders (أو 1000 كحد أدنى). ده يصلح تلقائيًا أي Counter قديم كان متسجل
// بقيمة 1/2/... من نسخة سابقة، ويمنع Duplicate Key على orderNumber.
// ============================================================================
const ORDER_NUMBER_BASE = 1000;

async function getNextOrderNumber() {
  const highestOrder = await Order.findOne({ orderNumber: { $ne: null } })
    .sort({ orderNumber: -1 })
    .select('orderNumber')
    .lean();

  const highestExisting = Number.isFinite(Number(highestOrder?.orderNumber))
    ? Number(highestOrder.orderNumber)
    : ORDER_NUMBER_BASE;

  const minimumSeq = Math.max(ORDER_NUMBER_BASE, highestExisting);
  const counter = await Counter.findOneAndUpdate(
    { _id: 'orderNumber' },
    [
      {
        $set: {
          seq: {
            $add: [
              { $max: [{ $ifNull: ['$seq', ORDER_NUMBER_BASE] }, minimumSeq] },
              1,
            ],
          },
        },
      },
    ],
    { new: true, upsert: true }
  );

  return counter.seq;
}

module.exports = { getNextOrderNumber };
