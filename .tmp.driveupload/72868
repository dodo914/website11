// Customer-safe projection for ExchangeRequest.
// Never expose admin/internal workflow, provider diagnostics, financial
// internals, or staff identity fields to customers.
const toCustomerExchangeView = (request) => {
  if (!request) return null;
  const source = typeof request.toObject === 'function' ? request.toObject() : request;

  return {
    requestId: source.requestId,
    orderId: source.orderId,
    type: source.type,
    items: Array.isArray(source.items) ? source.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      oldVariant: item.oldVariant ? {
        variantId: item.oldVariant.variantId ?? null,
        size: item.oldVariant.size ?? null,
        color: item.oldVariant.color ?? null,
      } : null,
      requestedNewVariant: item.requestedNewVariant ? {
        variantId: item.requestedNewVariant.variantId ?? null,
        size: item.requestedNewVariant.size ?? null,
        color: item.requestedNewVariant.color ?? null,
      } : null,
    })) : [],
    reasonCode: source.reasonCode ?? null,
    reason: source.reason ?? null,
    customerNote: source.customerNote ?? null,
    evidenceImages: Array.isArray(source.evidenceImages) ? source.evidenceImages : [],
    fee: Number(source.fee) || 0,
    currency: source.currency || 'EGP',
    feeType: source.feeType ?? null,
    status: source.status,
    statusHistory: Array.isArray(source.statusHistory)
      ? source.statusHistory.map((entry) => ({
          status: entry.status,
          at: entry.at,
          note: entry.note ?? null,
        }))
      : [],
    submittedAsGuest: !!source.submittedAsGuest,
    trackingNumber: source.trackingNumber ?? null,
    trackingStatus: source.trackingStatus ?? null,
    trackingMode: source.trackingMode ?? null,
    lastTrackingSyncAt: source.lastTrackingSyncAt ?? null,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
};

const toCustomerExchangeViews = (requests) =>
  Array.isArray(requests) ? requests.map(toCustomerExchangeView) : [];

module.exports = { toCustomerExchangeView, toCustomerExchangeViews };
