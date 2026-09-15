// ============================================================================
// Return / Exchange tracking sync
// ------------------------------------------------------------------------
// نفس فكرة sync.js (syncOrderTracking / applyIncomingStatus) بالظبط، لكن
// لشحنات الإرجاع (Order.returnTrackingNumber) والاستبدال (سواء القديم على
// الأوردر نفسه Order.exchangeTrackingNumber، أو الموديل الجديد المستقل
// ExchangeRequest.trackingNumber - شوف models/ExchangeRequest.js).
//
// ليه ملف منفصل ومش استخدام sync.js زي ما هو؟ لأن:
//   1. شحنة الإرجاع/الاستبدال ليها دورة حياة مختلفة (statusMap الخاص بيها -
//      RETURN_EXCHANGE_STATUS_RANK - مش نفس STATUS_RANK بتاع الشحن العادي).
//   2. لازم منأثرش على order.shippingStatus/order.status أبدًا هنا - دول
//      خاصين بشحنة الطلب الأصلية بس. تحديث حالة الإرجاع/الاستبدال بيتم على
//      حقول منفصلة تمامًا (returnStatus/exchangeStatus أو ExchangeRequest.status)
//      عشان نلتزم بقاعدة "متعملش تحديث لشحنة الطلب الأصلية بالغلط".
//   3. تقدّم returnRequestStatus/ExchangeRequest.status (اللي هو الـworkflow
//      البيزنسي اللي بيتحكم فيه الأدمن يدويًا - موافقة/رفض/تحويل فلوس) بيتم
//      تلقائيًا بس للمراحل الآمنة غير القابلة للجدل (استلام من العميل/وصول
//      المخزن/جاري المعاينة/شحن للعميل) - أي مرحلة نهائية (completed/rejected/
//      cancelled) بتفضل قرار يدوي بالكامل من الأدمن زي ما هي، عشان مبتضمنش
//      إجراءات تانية مرتبطة (رد فلوس، تعديل مخزون...الخ) مش من مسؤولية
//      التتبع نفسه.
// ============================================================================
const { normalizeReturnExchangeStatus, RETURN_EXCHANGE_STATUS_RANK, isBlockedReturnExchangeTerminalTransition } = require('./statusMap');

// خرائط تقدّم آمنة من حالة التتبع الداخلية -> حالة الـworkflow البيزنسي
// المقابلة (لو موجودة في enum الموديل). أي حالة تتبع مش موجودة هنا (زي
// delivered/returned_to_store/cancelled) متتحطش تلقائيًا في workflow status -
// الأدمن هو اللي بيقفلها يدويًا (completed/cancelled) بعد ما يتأكد.
const RETURN_WORKFLOW_ADVANCE = {
  picked_up: 'carrier_picked_up',
  received_at_warehouse: 'received_at_warehouse',
  inspecting: 'inspecting',
};
const EXCHANGE_WORKFLOW_ADVANCE = {
  picked_up: 'carrier_picked_up',
  received_at_warehouse: 'received_at_warehouse',
  inspecting: 'inspecting',
  shipped_to_customer: 'shipped_to_customer',
};

// ترتيب تقدّم returnRequestStatus/ExchangeRequest.status (الجزء اللي التتبع
// مسموحله يحركه بس - المراحل قبل completed/rejected/cancelled). مستخدم عشان
// منرجعش لمرحلة أقدم لو وصل تحديث متأخر.
const WORKFLOW_RANK = {
  pending: 0, under_review: 0, approved: 1,
  carrier_picked_up: 2, received_at_warehouse: 3, inspecting: 4,
  shipped_to_customer: 5, processing: 4,
  completed: 6, rejected: 6, cancelled: 6,
};

/**
 * بيطبّق نتيجة تتبع (سواء جاية من Pull - زرار "مزامنة الآن" - أو من Push -
 * Webhook) على أي "target" فيه trackingStatus/trackingRawStatus/lastTrackingSyncAt/
 * lastProviderEvent + (اختياري) workflowStatusField لتقدّم الـworkflow تلقائيًا.
 *
 * @param {object} opts
 * @param {object} opts.doc - Mongoose document (Order أو ExchangeRequest) - هيتحفظ (save()) لو اتغيّر حاجة
 * @param {string} opts.provider - 'bosta' الخ
 * @param {string} opts.rawStatus - الحالة الخام من شركة الشحن
 * @param {string} opts.statusField - اسم الحقل اللي بيحفظ الحالة الداخلية الموحّدة (مثلاً 'returnStatus')
 * @param {string} opts.rawStatusField - اسم الحقل اللي بيحفظ الحالة الخام
 * @param {string} [opts.workflowField] - اسم حقل الـworkflow البيزنسي (مثلاً 'returnRequestStatus') - اختياري
 * @param {object} [opts.workflowAdvanceMap] - خريطة تقدّم الـworkflow (RETURN_WORKFLOW_ADVANCE مثلاً)
 * @param {string} [opts.lastSyncField] - اسم حقل "آخر مزامنة" (مثلاً 'returnLastTrackingSyncAt')
 * @param {string} [opts.lastEventField] - اسم حقل "آخر حدث من الشركة" (مثلاً 'returnLastProviderEvent')
 * @param {boolean} [opts.save=true]
 * @returns {{changed:boolean, internalStatus:string|null, ignored:boolean, reason?:string}}
 */
async function applyReturnExchangeStatus(opts) {
  const {
    doc, rawStatus, statusField, rawStatusField,
    workflowField, workflowAdvanceMap, lastSyncField, lastEventField, save = true,
  } = opts;
  // بنقبل provider أو providerKey (نفس المعنى) - الكونترولرز بتستخدم
  // providerKey في أماكن مختلفة، فبدل ما نضطر نوحّد كل الاستدعاءات، بنقبل
  // الاتنين هنا عشان منقعش في نفس الـbug (قيمة provider فاضلة null بصمت).
  const provider = opts.provider || opts.providerKey;

  const internalStatus = normalizeReturnExchangeStatus(provider, rawStatus);
  const currentRank = RETURN_EXCHANGE_STATUS_RANK[doc[statusField]] ?? -1;
  const incomingRank = internalStatus ? (RETURN_EXCHANGE_STATUS_RANK[internalStatus] ?? -1) : -1;
  const isRegression = internalStatus && incomingRank !== -1 && incomingRank < currentRank;
  // ===== FIX: نفس مشكلة sync.js بالظبط - delivered/delivery_failed/
  // returned_to_store/cancelled كلهم rank=6، فـ`incomingRank < currentRank`
  // ملهاش تأثير بينهم. شوف isBlockedReturnExchangeTerminalTransition في
  // statusMap.js. =====
  const isBlockedTerminal = internalStatus && isBlockedReturnExchangeTerminalTransition(doc[statusField], internalStatus);

  let changed = false;

  if (rawStatus && String(rawStatus) !== doc[rawStatusField]) {
    doc[rawStatusField] = String(rawStatus);
    changed = true;
  }
  if (internalStatus && !isRegression && !isBlockedTerminal && internalStatus !== doc[statusField]) {
    doc[statusField] = internalStatus;
    changed = true;

    // تقدّم الـworkflow البيزنسي تلقائيًا (بس للمراحل الآمنة - شوف تعليق
    // WORKFLOW_ADVANCE فوق) مع نفس حماية عدم التراجع للخلف.
    if (workflowField && workflowAdvanceMap && workflowAdvanceMap[internalStatus]) {
      const nextWorkflowStatus = workflowAdvanceMap[internalStatus];
      const currentWfRank = WORKFLOW_RANK[doc[workflowField]] ?? -1;
      const nextWfRank = WORKFLOW_RANK[nextWorkflowStatus] ?? -1;
      // منتقدمش الـworkflow إلا لو الطلب أصلاً معتمد (approved فما فوق) -
      // منسمحش لتحديث تتبع إنه يـ"يوافق" على طلب لسه pending بدون تدخل بشري.
      if (currentWfRank >= 1 && nextWfRank !== -1 && nextWfRank > currentWfRank) {
        doc[workflowField] = nextWorkflowStatus;
        if (Array.isArray(doc.statusHistory)) {
          doc.statusHistory.push({ status: nextWorkflowStatus, note: 'تحديث تلقائي من تتبع الشحن' });
        } else if (Array.isArray(doc.returnStatusHistory)) {
          doc.returnStatusHistory.push({ status: nextWorkflowStatus, note: 'تحديث تلقائي من تتبع الشحن' });
        }
      }
    }
  }

  if (lastSyncField) { doc[lastSyncField] = new Date(); changed = true; }
  if (lastEventField && rawStatus) { doc[lastEventField] = String(rawStatus).slice(0, 200); changed = true; }

  if (changed && save) await doc.save();
  const ignored = !!isRegression || !!isBlockedTerminal;
  const reason = isRegression ? 'regression' : (isBlockedTerminal ? 'terminal_transition_blocked' : undefined);
  return { changed, internalStatus, ignored, reason };
}

// ============================================================================
// Pull: بينادى من زرار "مزامنة التتبع الآن" في الأدمن أو من الـworker الدوري.
// بيرجع { result, outcome } - result هو رد provider.track() الخام.
// ============================================================================
async function pullAndApplyReturnExchangeStatus({ doc, trackingNumber, provider, config, ...fieldOpts }) {
  const result = await provider.track(trackingNumber, config);
  const outcome = await applyReturnExchangeStatus({
    doc, provider: fieldOpts.providerKey, rawStatus: result.status, ...fieldOpts,
  });
  return { result, outcome };
}

module.exports = {
  applyReturnExchangeStatus,
  pullAndApplyReturnExchangeStatus,
  RETURN_WORKFLOW_ADVANCE,
  EXCHANGE_WORKFLOW_ADVANCE,
};