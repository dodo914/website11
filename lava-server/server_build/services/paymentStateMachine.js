// ============================================================================
// P1-2: Centralized Payment State Machine / Transition Guard
// ----------------------------------------------------------------------------
// Single source of truth for which order.paymentStatus transitions are
// legitimate. Every code path that writes order.paymentStatus (webhooks,
// browser callbacks, admin manual update, refund flow, payment-expiry
// worker) must go through applyPaymentStatusTransition() below instead of
// assigning order.paymentStatus directly, so an invalid/dangerous jump
// (paid -> pending, paid -> failed, refunded -> anything, a cancelled
// order suddenly becoming "paid", ...) can never slip in through one path
// while being blocked on another.
//
// Business rules encoded here (derived from the *existing* flows already
// audited in paymentController.js / orderController.js / paymentExpiryWorker.js,
// not invented from scratch):
//
//   pending  -> paid      Kashier/Paymob webhook success, or admin manually
//                         confirming a wallet/manual transfer.
//   pending  -> failed    Kashier/Paymob webhook failure, payment-expiry
//                         worker timeout, checkout-session-creation rollback,
//                         or admin rejecting a wallet/manual transfer.
//   failed   -> paid      Legitimate retry: the customer failed one attempt
//                         (e.g. card declined / abandoned the wallet screenshot)
//                         and later completed payment for the SAME order, or an
//                         admin reviews a wallet transfer they'd rejected too
//                         hastily and confirms it after all.
//   paid     -> refunded  Kashier/Paymob refund webhook, admin electronic
//                         refund (refundOrderPayment), or admin manual refund
//                         for wallet/COD orders (no gateway API to call).
//
// Everything else is rejected, in particular the dangerous transitions this
// ticket calls out explicitly:
//   paid -> pending, paid -> failed, refunded -> paid, refunded -> pending,
//   refunded -> failed, failed -> refunded, pending -> refunded.
//
// "refunded" is a terminal state once fully refunded (partial refunds keep
// paymentStatus 'paid' and only increment refundedAmount — see
// paymentController.markRefunded / orderController.refundOrderPayment).
//
// A request to move a status to the value it already has is treated as a
// safe no-op (idempotent) rather than an error — this is what keeps duplicate
// webhooks (Kashier/Paymob retrying a webhook delivery) safe.
// ============================================================================

const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

const ALLOWED_TRANSITIONS = {
  pending: ['paid', 'failed'],
  failed: ['paid'],
  paid: ['refunded'],
  refunded: [],
};

// Order.status values that mean "this order is cancelled" (mirrors the
// relevant subset of STOCK_RESTORING_STATUSES in controllers/orderController.js).
// Kept as its own small constant here (rather than importing orderController)
// to avoid a circular require — if the set of cancellation status labels ever
// changes there, update it here too.
const CANCELLED_ORDER_STATUSES = new Set(['ملغي', 'Cancelled']);

/**
 * Pure check — does NOT mutate anything.
 * @param {string} fromStatus current order.paymentStatus
 * @param {string} toStatus   requested new paymentStatus
 * @param {object} [order]    optional order doc, used for the cancelled-order guard
 * @returns {{ok: boolean, noop?: boolean, reason?: string}}
 */
function canTransitionPaymentStatus(fromStatus, toStatus, order) {
  if (!PAYMENT_STATUSES.includes(toStatus)) {
    return { ok: false, reason: `unknown_status:${toStatus}` };
  }

  if (fromStatus === toStatus) {
    // Idempotent no-op — this is what makes duplicate webhooks/requests safe.
    return { ok: true, noop: true };
  }

  const allowedTargets = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowedTargets.includes(toStatus)) {
    return { ok: false, reason: `invalid_transition:${fromStatus}->${toStatus}` };
  }

  // Never let a cancelled order become "paid" through any path (webhook,
  // admin, reconciliation). The order itself may still legitimately move to
  // other paymentStatus values (e.g. staying 'pending' or being marked
  // 'failed') — only the jump *into* 'paid' is blocked here.
  if (toStatus === 'paid' && order && CANCELLED_ORDER_STATUSES.has(order.status)) {
    return { ok: false, reason: 'order_cancelled' };
  }

  return { ok: true };
}

/**
 * Mutates order.paymentStatus IN MEMORY if (and only if) the transition is
 * legitimate. Caller is still responsible for order.save(). Never throws by
 * default — check the returned `applied` flag.
 *
 * @param {object} order matching Mongoose Order document (reads/writes .paymentStatus, .status)
 * @param {string} toStatus requested new paymentStatus
 * @returns {{applied: boolean, noop?: boolean, reason?: string}}
 */
function applyPaymentStatusTransition(order, toStatus) {
  if (!order) return { applied: false, reason: 'no_order' };

  const check = canTransitionPaymentStatus(order.paymentStatus, toStatus, order);
  if (!check.ok) {
    return { applied: false, reason: check.reason };
  }
  if (check.noop) {
    return { applied: false, noop: true };
  }

  order.paymentStatus = toStatus;
  return { applied: true };
}

module.exports = {
  PAYMENT_STATUSES,
  ALLOWED_TRANSITIONS,
  CANCELLED_ORDER_STATUSES,
  canTransitionPaymentStatus,
  applyPaymentStatusTransition,
};