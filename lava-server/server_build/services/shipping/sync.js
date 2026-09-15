const { normalizeStatus, STATUS_RANK, isBlockedTerminalTransition } = require('./statusMap');

// ============================================================================
// syncOrderTracking(order, provider, config)
// ------------------------------------------------------------------------
// المنطق الوحيد والموحّد لتحديث حالة شحنة طلب معين من شركة الشحن. نفس الكود
// ده بيتنادى من مكانين:
//   1. زرار "تحديث التتبع" اليدوي في الأدمن (controllers/shippingController.js)
//   2. الـworker التلقائي اللي بيشتغل لوحده كل فترة (services/shippingSyncWorker.js)
// عشان أي تحديث في منطق التحديث يفضل متسق في المكانين، ومفيش تكرار/تعارض.
//
// بيرجع { changed, result } - changed=true لو فعلاً اتغيّر أي حاجة واتحفظت.
// ============================================================================
async function syncOrderTracking(order, provider, config) {
  const result = await provider.track(order.trackingNumber, config);
  const internalStatus = normalizeStatus(order.shippingCompany, result.status);

  // ============================================================
  // Bug fix: حماية من التراجع للخلف (regression) - نفس منطق applyIncomingStatus
  // بالظبط بس هنا كمان (كانت ناقصة قبل كده). المسار ده بينادى من زرار
  // "تحديث التتبع" اليدوي ومن الـworker التلقائي، فلو رد شركة الشحن رجع
  // حالة أقدم (rank أقل) من اللي عندنا بالفعل (تعارض مؤقت/رد متأخر من
  // الشركة)، منرجعش لحالة أقدم - نفس الحماية الموجودة أصلاً في الـWebhook.
  // ============================================================
  const currentRank = STATUS_RANK[order.shippingStatus] ?? -1;
  const incomingRank = STATUS_RANK[internalStatus] ?? -1;
  const isRegression = incomingRank !== -1 && incomingRank < currentRank;
  // ===== FIX: STATUS_RANK وحدها مش كافية - delivered/cancelled/returned/failed
  // كلهم نفس الـrank، فـ`incomingRank < currentRank` بيبقى false بينهم ومش
  // بيمنع انتقال زي delivered -> cancelled. شوف تعليق isBlockedTerminalTransition
  // في statusMap.js للتفاصيل الكاملة. =====
  const isBlockedTerminal = isBlockedTerminalTransition(order.shippingStatus, internalStatus);

  let changed = false;
  if (result.status && result.status !== order.shippingRawStatus && !isRegression && !isBlockedTerminal) {
    order.shippingRawStatus = String(result.status);
    changed = true;
  }
  if (internalStatus && internalStatus !== order.shippingStatus && !isRegression && !isBlockedTerminal) {
    order.shippingStatus = internalStatus;
    if (internalStatus === 'delivered') {
      if (!order.deliveredAt) order.deliveredAt = new Date();
      // الحالة العامة للطلب (status) بتتحول تلقائيًا لـ"تم التسليم" لما شركة
      // الشحن تأكد التسليم - عشان الأدمن ميحتاجش يأكدها يدوي مرتين (مرة في
      // تتبع الشحن ومرة في حالة الطلب العامة). ده بس للطلبات المتابعة بشركة
      // شحن؛ الطلبات اليدوية (من غير شركة شحن) لسه بتتأكد يدويًا زي ما هي.
      order.status = 'تم التسليم';
    } else if (internalStatus === 'returned') {
      // نفس الفكرة بالظبط لكن للمرتجع - لو الشحنة رجعت (حتى لو كانت وصلت
      // "delivered" قبل كده وبعدين اترجعت)، لازم status العام يتحدث لـ"مرتجع"
      // برضو، وإلا هيفضل الطلب محسوب غلط كـ"تم التسليم" في الإيرادات وصافي
      // الأرباح رغم إن المنتج فعليًا رجع.
      order.status = 'مرتجع';
    }
    changed = true;
  }
  if (changed) {
    order.shippingUpdatedAt = new Date();
    await order.save();
  }
  return { changed, result, internalStatus, ignored: (isRegression || isBlockedTerminal) && !changed };
}

// ============================================================================
// applyIncomingStatus(order, rawStatus, provider)
// ------------------------------------------------------------------------
// نفس فكرة syncOrderTracking لكن للحالة اللي بتوصل "دفعًا" (Push) من شركة
// الشحن نفسها عبر Webhook، مش بالسؤال عنها (Pull). الفرق المهم: الـWebhook
// ممكن توصله events مش بترتيبها الصح (Out-of-order - مشكلة شبكة/إعادة إرسال
// من شركة الشحن)، فبنستخدم STATUS_RANK عشان منتراجعش لحالة أقدم لو وصل
// event قديم متأخر بعد واحد أحدث.
// بيرجع { changed, ignored, reason }.
// ============================================================================
async function applyIncomingStatus(order, rawStatus, provider) {
  const internalStatus = normalizeStatus(provider, rawStatus);
  const currentRank = STATUS_RANK[order.shippingStatus] ?? -1;
  const incomingRank = STATUS_RANK[internalStatus] ?? -1;

  // نفس الحالة بالظبط اللي عندنا بالفعل - event مكرر (duplicate)، منعملش حاجة.
  if (rawStatus && String(rawStatus) === order.shippingRawStatus && internalStatus === order.shippingStatus) {
    return { changed: false, ignored: true, reason: 'duplicate' };
  }
  // event قديم وصل متأخر (out-of-order) - منتراجعش لحالة أقدم.
  if (incomingRank !== -1 && incomingRank < currentRank) {
    return { changed: false, ignored: true, reason: 'out_of_order' };
  }
  // ===== FIX: نفس مشكلة syncOrderTracking فوق بالظبط - رانك متساوي مش كافي
  // لمنع delivered -> cancelled/pending/... (شوف isBlockedTerminalTransition
  // في statusMap.js). ده أخطر هنا تحديدًا لأنه Webhook (Push) ومش احنا اللي
  // بنسأل - أي حد يقدر يبعت event مزوّر بعد ما عدّى الـsecret check يقدر
  // "يلغي" شحنة اتسلمت فعليًا لو ماكانش الفحص ده موجود. =====
  if (isBlockedTerminalTransition(order.shippingStatus, internalStatus)) {
    return { changed: false, ignored: true, reason: 'terminal_transition_blocked' };
  }

  let changed = false;
  if (rawStatus && String(rawStatus) !== order.shippingRawStatus) {
    order.shippingRawStatus = String(rawStatus);
    changed = true;
  }
  if (internalStatus && internalStatus !== order.shippingStatus) {
    order.shippingStatus = internalStatus;
    if (internalStatus === 'delivered') {
      if (!order.deliveredAt) order.deliveredAt = new Date();
      order.status = 'تم التسليم';
    } else if (internalStatus === 'returned') {
      order.status = 'مرتجع';
    }
    changed = true;
  }
  if (changed) {
    order.shippingUpdatedAt = new Date();
    await order.save();
  }
  return { changed, ignored: false, internalStatus };
}

module.exports = { syncOrderTracking, applyIncomingStatus };