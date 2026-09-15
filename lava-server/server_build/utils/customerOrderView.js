// ============================================================================
// utils/customerOrderView.js
// ----------------------------------------------------------------------------
// Dedicated customer-safe projection for Order documents.
//
// WHY: controllers/orderController.js and controllers/guestOrderController.js
// return Order documents (or slices of them) directly to customers/guests in
// several places (order creation response, GET /orders/mine, return-request
// responses, guest order lookup). Order documents contain internal/financial
// fields that must never reach a customer: item costPrice, payment gateway
// raw responses, refund gateway payloads, internal admin notes, reviewer
// user ids, etc.
//
// This module is an explicit ALLOWLIST (not "return everything then delete
// sensitive fields") — every field a customer/guest is allowed to see is
// listed here by name. Anything not listed is dropped by construction.
// ============================================================================

// ===== عنصر الطلب - آمن للعميل =====
function toCustomerOrderItem(item) {
  if (!item) return item;
  return {
    productId: item.productId,
    name: item.name,
    variantId: item.variantId,
    size: item.size,
    color: item.color,
    colorHex: item.colorHex,
    productImage: item.productImage,
    price: item.price,
    originalPrice: item.originalPrice,
    quantity: item.quantity,
    isBundleItem: item.isBundleItem,
    bundleDiscount: item.bundleDiscount,
    // NEVER include: costPrice
  };
}

function toCustomerOrderItems(items) {
  return Array.isArray(items) ? items.map(toCustomerOrderItem) : [];
}

// ===== الطلب الكامل - آمن للعميل/الضيف (order creation response, GET /orders/mine) =====
// يقبل مستند Mongoose أو object عادي (.lean()) - بيستخدم fallback ?? عشان
// يشتغل مع الاتنين من غير فرق.
function toCustomerOrderView(order) {
  if (!order) return order;

  return {
    _id: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,

    items: toCustomerOrderItems(order.items),
    subtotal: order.subtotal,
    discount: order.discount,
    discountType: order.discountType,
    discountCode: order.discountCode,
    promoLabel: order.promoLabel,
    shippingCost: order.shippingCost,
    totalAmount: order.totalAmount,

    // ===== بيانات الشحن اللي محتاجها العميل بس (مفيش shippingProviderId/
    // shippingRawStatus/shippingErrorCode - دي تفاصيل تشغيلية داخلية) =====
    governorate: order.governorate,
    country: order.country,
    address: order.address,
    zipCode: order.zipCode,
    shippingCompany: order.shippingCompany,
    trackingNumber: order.trackingNumber,
    shippingStatus: order.shippingStatus,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,

    // العنوان المنظّم - نفس الملحوظة، مفيش حقول تشغيلية داخلية هنا أصلاً.
    shippingAddress: order.shippingAddress,

    // ===== الدفع - حالة الدفع بس، من غير أي مرجع بوابة دفع (paymentGateway) =====
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    walletPayment: order.walletPayment
      ? {
          methodName: order.walletPayment.methodName,
          confirmed: order.walletPayment.confirmed,
          confirmedAt: order.walletPayment.confirmedAt,
          // NEVER include: senderPhone/screenshotPublicId/screenshotUrl internals
          // beyond what the customer already submitted themselves - screenshotUrl
          // kept since it's the customer's own uploaded proof, harmless to echo back.
          screenshotUrl: order.walletPayment.screenshotUrl,
        }
      : null,

    // ===== الاسترجاع/الاستبدال - معلومات مناسبة للعرض للعميل =====
    returnRequestStatus: order.returnRequestStatus,
    returnRequestReason: order.returnRequestReason,
    returnRequestReasonCode: order.returnRequestReasonCode,
    returnItems: order.returnItems,
    returnFeeCharged: order.returnFeeCharged,
    returnFeeCurrency: order.returnFeeCurrency,
    returnFeeType: order.returnFeeType,
    returnEvidenceImages: order.returnEvidenceImages,
    returnInspectionResult: order.returnInspectionResult,
    trackingProviderReturn: order.returnTrackingProvider,
    returnTrackingNumber: order.returnTrackingNumber,

    // NEVER include:
    //  - items[].costPrice, supplier/cost fields
    //  - paymentGateway (kashierOrderId/transactionId)
    //  - refunds[] / refunds[].gatewayResponse
    //  - returnAdminNote, returnReviewedBy, returnReviewedAt
    //  - shippingProviderId, shippingRawStatus, shippingErrorCode, shippingNotes
    //  - returnRefundReference / returnRefundTransferredBy (internal ops trail)
    //  - internal accounting fields (refundedAmount, exchangeExtraCollected, refundInProgress)
    //  - notes (internal order notes), packerStatus
    //  - emailConfirmation.cancelTokenHash / messageId
    //  - customerPhone2 is kept out too (not needed by the customer viewing their own order UI)
  };
}

function toCustomerOrderViews(orders) {
  return Array.isArray(orders) ? orders.map(toCustomerOrderView) : [];
}

// ===== تفاصيل طلب استرجاع - نسخة آمنة للعميل (بديل للنسخة الإدارية الكاملة
// في getReturnRequestDetails - بدون adminNote/reviewedBy/orderItems.costPrice) =====
function toCustomerReturnRequestView(order) {
  if (!order) return order;
  return {
    requestId: String(order._id),
    orderId: order._id,
    type: 'return',
    order: {
      _id: order._id,
      customerName: order.customerName,
      totalAmount: order.totalAmount,
      status: order.status,
    },
    items: order.returnItems,
    orderItems: toCustomerOrderItems(order.items),
    status: order.returnRequestStatus,
    requestedBy: order.returnRequestedBy,
    reason: order.returnRequestReason,
    reasonCode: order.returnRequestReasonCode,
    createdAt: order.returnRequestedAt || order.createdAt,
    fee: order.returnFeeCharged,
    currency: order.returnFeeCurrency || 'EGP',
    feeType: order.returnFeeType,
    evidenceImages: order.returnEvidenceImages,
    statusHistory: order.returnStatusHistory,
    refundAmount: order.returnRefundAmount,
    refundMethod: order.returnRefundMethod,
    refundTransferredAt: order.returnRefundTransferredAt,
    returnInspectionResult: order.returnInspectionResult,
    returnStockRestored: order.returnStockRestored,
    trackingNumber: order.returnTrackingNumber,
    trackingProvider: order.returnTrackingProvider,
    trackingStatus: order.returnStatus,
    lastTrackingSyncAt: order.returnLastTrackingSyncAt,
    // NEVER include: adminNote, reviewedBy, reviewedAt, refundReference,
    // refundTransferredBy, customerPhone/customerEmail/address (already known
    // to the requesting customer, omitted here to keep this projection minimal),
    // trackingRawStatus (raw carrier payload)
  };
}

module.exports = {
  toCustomerOrderItem,
  toCustomerOrderItems,
  toCustomerOrderView,
  toCustomerOrderViews,
  toCustomerReturnRequestView,
};