const Order = require('../models/Order');
const Settings = require('../models/Settings');
const { sendEmail, configured } = require('./brevoService');

// ============================================================================
// الهدف: بدل ما صاحب المتجر يكتشف إن صافي الربح بقى سالب أو إن معدل الإرجاع
// ارتفع بالصدفة (لما يفتح لوحة البيانات)، الـ worker ده بيعمل فحص يومي تلقائي
// وبيبعت إيميل تنبيه (عن طريق Brevo، بنفس الإعدادات المستخدمة أصلاً في الموقع)
// لو حصل أي من الحالتين. الفحص بيتم مرة واحدة كل 24 ساعة، وبيتفادى تكرار
// نفس التنبيه في نفس اليوم عن طريق Settings.profitAlerts.
// ============================================================================

const DAY_MS = 86400000;
const WINDOW_DAYS = 7; // بنراقب "آخر 7 أيام" كنافذة متحركة بدل يوم واحد بس، عشان تقلبات المبيعات اليومية الطبيعية متطلعش تنبيه غلط.

function shippedBackStatus(order) {
  return (order.status === 'مرتجع' || order.status === 'Returned' || order.status === 'ملغي' || order.status === 'Cancelled')
    && order.shippingStatus && order.shippingStatus !== 'pending';
}

async function computeWindowStats(start, end) {
  const orders = await Order.find({ createdAt: { $gte: start, $lte: end } })
    .select('status shippingStatus totalAmount refundedAmount exchangeExtraCollected shippingCost returnShippingCost items createdAt')
    .lean();

  const delivered = orders.filter(o => o.status === 'تم التسليم' || o.status === 'Delivered' || o.shippingStatus === 'delivered');
  // ===== FIX: كان الحساب هنا ناقص exchangeExtraCollected (فرق فلوس اتحصّل
  // فعليًا من العميل وقت الاستبدال) - نفس الحقل المستخدم في لوحة البيانات
  // الرئيسية (AdminPanel.jsx) ولوحة المدفوعات (getPaymentsDashboard) - عشان
  // رقم صافي الربح في إيميل التنبيه يبقى متطابق مع اللي بيبان في الأدمن =====
  const totalSales = delivered.reduce((s, o) => s + ((o.totalAmount || 0) + (o.exchangeExtraCollected || 0) - (o.refundedAmount || 0)), 0);
  const totalCost = delivered.reduce((s, o) => s + (o.items || []).reduce((ss, i) => ss + (i.costPrice || 0) * (i.quantity || 1), 0), 0);
  const totalShippingCost = delivered.reduce((s, o) => s + (o.shippingCost || 0), 0);
  const returnedShipped = orders.filter(shippedBackStatus);
  const returnShippingCost = returnedShipped.reduce((s, o) => s + (o.returnShippingCost != null ? o.returnShippingCost : (o.shippingCost || 0) * 2), 0);

  const settings = await Settings.findOne().select('expenses').lean();
  const expenses = Array.isArray(settings?.expenses) ? settings.expenses : [];
  const expenseTime = (e) => (e.date ? new Date(e.date).getTime() : (e.id || 0));
  const totalExpenses = expenses.reduce((s, e) => s + ((expenseTime(e) >= start.getTime() && expenseTime(e) <= end.getTime()) ? (e.amount || 0) : 0), 0);

  const netProfit = totalSales - totalCost - totalShippingCost - returnShippingCost - totalExpenses;

  const returnedOrders = orders.filter(o => o.status === 'مرتجع' || o.status === 'Returned');
  const returnRate = orders.length > 0 ? (returnedOrders.length / orders.length) * 100 : 0;

  return { ordersCount: orders.length, netProfit, returnRate };
}

async function checkProfitHealth() {
  if (!configured()) return; // Brevo مش متظبط (مفيش API key/from email) - مفيش داعي نحاول نبعت

  const settings = await Settings.findOne().select('adminEmail profitAlerts').lean();
  const adminEmail = String(settings?.adminEmail || '').trim();
  if (!adminEmail) return; // مفيش إيميل أدمن متسجل نبعتله

  const now = new Date();
  const currStart = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
  const prevStart = new Date(currStart.getTime() - WINDOW_DAYS * DAY_MS);
  const prevEnd = new Date(currStart.getTime() - 1);

  const [curr, prev] = await Promise.all([
    computeWindowStats(currStart, now),
    computeWindowStats(prevStart, prevEnd),
  ]);

  const lastNegAlert = settings?.profitAlerts?.lastNegativeProfitAlertAt ? new Date(settings.profitAlerts.lastNegativeProfitAlertAt) : null;
  const lastReturnAlert = settings?.profitAlerts?.lastReturnRateAlertAt ? new Date(settings.profitAlerts.lastReturnRateAlertAt) : null;
  const alreadyAlertedToday = (d) => d && (now.getTime() - d.getTime()) < DAY_MS;

  const shouldAlertNegative = curr.ordersCount >= 3 && curr.netProfit < 0 && !alreadyAlertedToday(lastNegAlert);

  const returnRateJumped = prev.ordersCount >= 5 && curr.ordersCount >= 5
    && (curr.returnRate - prev.returnRate) >= 5
    && (prev.returnRate === 0 ? curr.returnRate >= 10 : (curr.returnRate / prev.returnRate) >= 1.4);
  const shouldAlertReturnRate = returnRateJumped && !alreadyAlertedToday(lastReturnAlert);

  if (!shouldAlertNegative && !shouldAlertReturnRate) return;

  const rows = [];
  if (shouldAlertNegative) {
    rows.push(`<tr><td style="padding:10px;border-bottom:1px solid #eee">🚨 صافي الربح سالب</td><td style="padding:10px;border-bottom:1px solid #eee;color:#dc2626;font-weight:bold">${Math.round(curr.netProfit).toLocaleString()} ج.م</td></tr>`);
  }
  if (shouldAlertReturnRate) {
    rows.push(`<tr><td style="padding:10px;border-bottom:1px solid #eee">⚠️ ارتفاع معدل الإرجاع</td><td style="padding:10px;border-bottom:1px solid #eee;color:#ea580c;font-weight:bold">${prev.returnRate.toFixed(1)}% ← ${curr.returnRate.toFixed(1)}%</td></tr>`);
  }

  const html = `
    <div style="background:#fff;border-radius:16px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,.06);font-family:Arial,sans-serif;direction:rtl">
      <h2 style="margin:0 0 6px">تنبيه صحة المتجر — آخر ${WINDOW_DAYS} أيام</h2>
      <p style="margin:0 0 16px;color:#555">فحص تلقائي يومي لصافي الربح ومعدل الإرجاع.</p>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr><th style="text-align:right;padding:10px;background:#f9fafb">المؤشر</th><th style="text-align:right;padding:10px;background:#f9fafb">القيمة</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      <p style="color:#777;font-size:12px;margin-top:20px">افتح لوحة البيانات في المتجر للتفاصيل الكاملة (هامش الربح لكل منتج، أسباب الإرجاع، إلخ).</p>
    </div>`;

  try {
    await sendEmail({
      to: adminEmail,
      subject: shouldAlertNegative ? '🚨 تنبيه: صافي الربح سالب في متجرك' : '⚠️ تنبيه: ارتفاع معدل الإرجاع في متجرك',
      html,
      text: rows.map(r => r.replace(/<[^>]+>/g, ' ')).join('\n'),
      tags: ['profit-health-alert'],
    });

    const update = {};
    if (shouldAlertNegative) update['profitAlerts.lastNegativeProfitAlertAt'] = now;
    if (shouldAlertReturnRate) update['profitAlerts.lastReturnRateAlertAt'] = now;
    await Settings.updateOne({}, { $set: update });
    console.log('[profit-alert] alert email sent to', adminEmail);
  } catch (err) {
    console.error('[profit-alert] failed to send alert email:', err.message);
  }
}

let tickRunning = false;

async function startProfitAlertWorker() {
  const tick = async () => {
    if (tickRunning) return;
    tickRunning = true;
    try {
      await checkProfitHealth();
    } catch (e) {
      console.error('[profit-alert] tick error:', e.message);
    } finally {
      tickRunning = false;
    }
  };
  await tick();
  // بنفحص كل 6 ساعات (مش كل دقيقة زي worker المدفوعات) — الفحص ده مبني على
  // نافذة 7 أيام فمفيش داعي يتكرر كل شوية، وبرضو بيمنع التكرار في نفس اليوم بالـ flags فوق.
  return setInterval(tick, 6 * 60 * 60 * 1000);
}

module.exports = { startProfitAlertWorker, checkProfitHealth };