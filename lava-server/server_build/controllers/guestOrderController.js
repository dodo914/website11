const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const ExchangeRequest = require('../models/ExchangeRequest');
const { uploadImageToCloudinary } = require('../utils/uploadToCloudinary');
const { normalizePhone } = require('../utils/addressValidation');
const { isValidReasonCode, getEffectiveReturnReasons } = require('../utils/returnReasons');
const { isValidExchangeReasonCode, requiresDetailNote, getEffectiveExchangeReasons } = require('../utils/exchangeReasons');
const { computeFee, checkEligibility, isEvidenceRequired } = require('../utils/returnExchangeFees');
const { toCustomerOrderItems } = require('../utils/customerOrderView');

// ============================================================================
// ===== صفحة "استرجاع/استبدال بدون تسجيل دخول" =====
// نفس بالظبط منطق requestReturn/createExchangeRequest في orderController.js/
// exchangeController.js (نفس الأهلية، نفس الرسوم، نفس التحقق من المخزون)،
// الفرق الوحيد إن التحقق من ملكية الطلب هنا بيتم برقم الأوردر المتسلسل
// (orderNumber) + رقم الهاتف بدل تسجيل الدخول. الطلبات اللي بتتقدّم من هنا
// بتظهر في لوحة الأدمن بالظبط زي أي طلب استرجاع/استبدال عادي (نفس الموديل،
// نفس الـstatus/workflow) - بس عليها علامة submittedAsGuest/
// returnRequestedAsGuest للتمييز بس، من غير أي تأثير على منطق المراجعة.
// ============================================================================

const MAX_ITEM_QUANTITY = 1000;
const isValidQuantity = (q) => Number.isInteger(q) && q > 0 && q <= MAX_ITEM_QUANTITY;

// حالات "استبدال شغّال" - نفس القايمة الموجودة في exchangeController.js
const ACTIVE_EXCHANGE_STATUSES = [
  'pending', 'under_review', 'approved', 'pickup_scheduled', 'received', 'processing',
  'carrier_picked_up', 'received_at_warehouse', 'inspecting', 'shipped_to_customer',
];

// ===== إيجاد الأوردر + التحقق إن رقم الهاتف المدخل مطابق (customerPhone أو
// customerPhone2) - بيرجع null لو مفيش تطابق، من غير ما يكشف السبب بالظبط
// (رقم مش موجود أو تليفون غلط) لنفس الرسالة - عشان محدش يقدر "يجرب" أرقام
// أوردرات ويعرف مين موجود ومين لأ (نفس فكرة رسائل الخطأ الموحّدة في تسجيل
// الدخول).
const findGuestVerifiedOrder = async (orderNumberRaw, phoneRaw) => {
  const orderNumber = Number(orderNumberRaw);
  if (!Number.isFinite(orderNumber)) return null;

  const normalizedInput = normalizePhone(phoneRaw);
  if (!normalizedInput) return null;

  const order = await Order.findOne({ orderNumber });
  if (!order) return null;

  const candidates = [order.customerPhone, order.customerPhone2]
    .filter(Boolean)
    .map((p) => normalizePhone(p));

  if (!candidates.includes(normalizedInput)) return null;

  return order;
};

const GENERIC_VERIFY_FAIL_MESSAGE = 'رقم الطلب أو رقم الهاتف غير صحيح';

// ============================================================================
// POST /api/orders/guest/lookup  { orderNumber, phone }
// ============================================================================
const guestLookupOrder = async (req, res) => {
  try {
    const order = await findGuestVerifiedOrder(req.body.orderNumber, req.body.phone);
    if (!order) return res.status(404).json({ message: GENERIC_VERIFY_FAIL_MESSAGE });

    const existingActiveExchange = await ExchangeRequest.findOne({
      orderId: order._id,
      status: { $in: ACTIVE_EXCHANGE_STATUSES },
    }).lean();

    res.json({
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      totalAmount: order.totalAmount,
      customerName: order.customerName,
      // items[].costPrice كانت بتترجع للضيف من غير أي فلترة - projection آمنة.
      items: toCustomerOrderItems(order.items),
      returnRequestStatus: order.returnRequestStatus,
      hasActiveExchangeRequest: !!existingActiveExchange,
    });
  } catch (err) {
    console.error('Guest order lookup error:', err);
    res.status(500).json({ message: 'حصل خطأ أثناء البحث عن الطلب' });
  }
};

// ============================================================================
// GET /api/orders/guest/return-reasons  (نفس getReturnReasons بالظبط - عام
// بالفعل، متسابة هنا كمان عشان صفحة الجيست تقدر تستخدم نفس الـbase path)
// ============================================================================
const guestGetReturnReasons = async (req, res) => {
  try {
    const settingsDoc = await Settings.findOne().lean();
    const effective = getEffectiveReturnReasons(settingsDoc).filter((r) => r.enabled !== false);
    res.json(effective.map(({ code, ar, en }) => ({ code, ar, en })));
  } catch (err) {
    console.error('Error fetching return reasons (guest):', err);
    res.status(500).json({ message: 'حصل خطأ في جلب أسباب الاسترجاع' });
  }
};

const guestGetExchangeReasons = async (req, res) => {
  try {
    const settingsDoc = await Settings.findOne().lean();
    const effective = getEffectiveExchangeReasons(settingsDoc).filter((r) => r.enabled !== false);
    res.json(effective.map(({ code, ar, en }) => ({ code, ar, en })));
  } catch (err) {
    console.error('Error fetching exchange reasons (guest):', err);
    res.status(500).json({ message: 'حصل خطأ في جلب أسباب الاستبدال' });
  }
};

// ============================================================================
// GET /api/orders/guest/return-eligibility?orderNumber=&phone=&reasonCode=
// ============================================================================
const guestGetReturnEligibility = async (req, res) => {
  try {
    const order = await findGuestVerifiedOrder(req.query.orderNumber, req.query.phone);
    if (!order) return res.status(404).json({ message: GENERIC_VERIFY_FAIL_MESSAGE });

    const settingsDoc = await Settings.findOne().lean();
    const reasonCode = isValidReasonCode(req.query.reasonCode, settingsDoc) ? req.query.reasonCode : 'other';

    if (order.returnRequestStatus === 'pending' || order.returnRequestStatus === 'approved') {
      return res.json({ eligible: false, message: 'فيه طلب استرجاع لنفس الطلب ده اتسجل بالفعل' });
    }

    const eligibility = checkEligibility({ order, type: 'return', reasonCode, settings: settingsDoc });
    res.json({
      eligible: eligibility.eligible,
      message: eligibility.message,
      evidenceRequired: isEvidenceRequired({ type: 'return', reasonCode, settings: settingsDoc }),
      fee: eligibility.eligible ? computeFee({ type: 'return', reasonCode, settings: settingsDoc }) : null,
    });
  } catch (err) {
    console.error('Error checking return eligibility (guest):', err);
    res.status(500).json({ message: 'حصل خطأ في التحقق من أهلية الاسترجاع' });
  }
};

// ============================================================================
// GET /api/orders/guest/exchange-eligibility?orderNumber=&phone=&reasonCode=
// ============================================================================
const guestGetExchangeEligibility = async (req, res) => {
  try {
    const order = await findGuestVerifiedOrder(req.query.orderNumber, req.query.phone);
    if (!order) return res.status(404).json({ message: GENERIC_VERIFY_FAIL_MESSAGE });

    const settingsDoc = await Settings.findOne().lean();
    const reasonCode = isValidExchangeReasonCode(req.query.reasonCode, settingsDoc) ? req.query.reasonCode : 'other';

    const existingActive = await ExchangeRequest.findOne({ orderId: order._id, status: { $in: ACTIVE_EXCHANGE_STATUSES } });
    if (existingActive) {
      return res.json({ eligible: false, message: 'فيه طلب استبدال لنفس الطلب ده لسه قيد المعالجة' });
    }

    const eligibility = checkEligibility({ order, type: 'exchange', reasonCode, settings: settingsDoc });
    res.json({
      eligible: eligibility.eligible,
      message: eligibility.message,
      evidenceRequired: isEvidenceRequired({ type: 'exchange', reasonCode, settings: settingsDoc }),
      fee: eligibility.eligible ? computeFee({ type: 'exchange', reasonCode, settings: settingsDoc }) : null,
    });
  } catch (err) {
    console.error('Error checking exchange eligibility (guest):', err);
    res.status(500).json({ message: 'حصل خطأ في التحقق من أهلية الاستبدال' });
  }
};

// ============================================================================
// POST /api/orders/guest/evidence-image  (زي uploadEvidenceImage بالظبط بس
// من غير تسجيل دخول)
// ============================================================================
const guestUploadEvidenceImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'لم يتم إرسال صورة' });

    const uploaded = await uploadImageToCloudinary(
      req.file.buffer,
      req.file.safeOriginalName || req.file.originalname,
      req.file.detectedMime || req.file.mimetype,
      { folder: 'return-exchange-evidence' },
    );

    res.status(201).json({
      success: true,
      data: { url: uploaded.secureUrl || uploaded.url, publicId: uploaded.publicId },
    });
  } catch (err) {
    console.error('Guest evidence image upload failed:', err);
    if (err?.code === 'CLOUDINARY_UPLOAD_FAILED') {
      return res.status(502).json({ message: 'تعذر رفع الصورة إلى التخزين. حاول مرة أخرى.' });
    }
    res.status(err?.statusCode || 500).json({ message: 'تعذر رفع صورة الإثبات.' });
  }
};

// ============================================================================
// POST /api/orders/guest/return-request
// body: { orderNumber, phone, items, reasonCode, reason, evidenceImages }
// نفس بالظبط منطق requestReturn في orderController.js
// ============================================================================
const guestRequestReturn = async (req, res) => {
  try {
    const order = await findGuestVerifiedOrder(req.body.orderNumber, req.body.phone);
    if (!order) return res.status(404).json({ message: GENERIC_VERIFY_FAIL_MESSAGE });

    if (order.returnRequestStatus === 'pending' || order.returnRequestStatus === 'approved') {
      return res.status(400).json({ message: 'فيه طلب استرجاع لنفس الطلب ده اتسجل بالفعل' });
    }

    const requestedItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (requestedItems.length === 0) {
      return res.status(400).json({ message: 'اختار على الأقل منتج واحد عايز تسترجعه' });
    }

    const settingsDoc = await Settings.findOne().lean();
    const reasonCode = isValidReasonCode(req.body.reasonCode, settingsDoc) ? req.body.reasonCode : 'other';

    const eligibility = checkEligibility({ order, type: 'return', reasonCode, settings: settingsDoc });
    if (!eligibility.eligible) {
      return res.status(400).json({ message: eligibility.message });
    }

    const evidenceImages = Array.isArray(req.body.evidenceImages)
      ? req.body.evidenceImages.filter((u) => typeof u === 'string' && u.trim()).slice(0, 10)
      : [];
    if (isEvidenceRequired({ type: 'return', reasonCode, settings: settingsDoc }) && evidenceImages.length === 0) {
      return res.status(400).json({ message: 'من فضلك ارفع صورة إثبات واحدة على الأقل لهذا السبب' });
    }

    const validatedItems = [];
    for (const reqItem of requestedItems) {
      const quantity = Number(reqItem.quantity);
      if (!isValidQuantity(quantity)) {
        return res.status(400).json({ message: 'كمية غير صحيحة في أحد المنتجات المطلوب استرجاعها' });
      }
      const matchingItem = order.items.find(oi =>
        String(oi.productId) === String(reqItem.productId) &&
        String(oi.variantId || '') === String(reqItem.variantId || '') &&
        String(oi.size || '') === String(reqItem.size || '')
      );
      if (!matchingItem) {
        return res.status(400).json({ message: 'أحد المنتجات المطلوب استرجاعها مش موجود في هذا الطلب' });
      }
      if (quantity > matchingItem.quantity) {
        return res.status(400).json({ message: `الكمية المطلوب استرجاعها من "${matchingItem.name?.ar || matchingItem.name?.en || ''}" أكبر من الكمية المشتراة` });
      }
      validatedItems.push({
        productId: matchingItem.productId,
        variantId: matchingItem.variantId || null,
        size: matchingItem.size || null,
        quantity,
        reason: typeof reqItem.reason === 'string' ? reqItem.reason.trim().slice(0, 300) : null,
      });
    }

    const feeSnapshot = computeFee({ type: 'return', reasonCode, settings: settingsDoc });

    const requestAt = new Date();
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: order._id, returnRequestStatus: { $nin: ['pending', 'approved'] } },
      {
        $set: {
          returnItems: validatedItems,
          returnRequestedBy: 'customer',
          returnRequestedAsGuest: true,
          returnRequestStatus: 'pending',
          returnRequestReason: typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 500) : null,
          returnRequestReasonCode: reasonCode,
          returnRequestedAt: requestAt,
          returnReviewedBy: null,
          returnReviewedAt: null,
          returnAdminNote: null,
          returnFeeCharged: feeSnapshot.fee,
          returnFeeCurrency: feeSnapshot.currency,
          returnFeeType: feeSnapshot.feeType,
          returnEvidenceImages: evidenceImages,
        },
        $push: { returnStatusHistory: { status: 'pending', at: requestAt, by: null, note: 'العميل قدّم طلب استرجاع (بدون تسجيل دخول)' } },
      },
      { new: true, runValidators: true }
    );
    if (!updatedOrder) return res.status(409).json({ message: 'فيه طلب استرجاع لنفس الطلب ده اتسجل بالفعل' });

    require('../utils/cache').del('orders:all');
    res.json({ orderNumber: updatedOrder.orderNumber, returnRequestStatus: updatedOrder.returnRequestStatus });
  } catch (err) {
    console.error('Error requesting return (guest):', err);
    res.status(500).json({ message: 'حصل خطأ في تسجيل طلب الاسترجاع' });
  }
};

// يدوّر على فاريانت + مقاس داخل منتج - نفس الدالة في exchangeController.js
const findVariantAndSize = (product, variantId, size) => {
  if (!product || !Array.isArray(product.variants)) return null;
  const variant = product.variants.find(v => String(v._id) === String(variantId) || String(v.id) === String(variantId));
  if (!variant) return null;
  const sizeEntry = (variant.sizeStock || []).find(s => String(s.size) === String(size));
  if (!sizeEntry) return null;
  return { variant, sizeEntry };
};

const genRequestId = () => {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `EX-${Date.now().toString(36).toUpperCase()}-${rand}`;
};

// ============================================================================
// POST /api/orders/guest/exchange-request
// body: { orderNumber, phone, items, reasonCode, customerNote, evidenceImages }
// نفس بالظبط منطق createExchangeRequest في exchangeController.js
// ============================================================================
const guestRequestExchange = async (req, res) => {
  try {
    const order = await findGuestVerifiedOrder(req.body.orderNumber, req.body.phone);
    if (!order) return res.status(404).json({ message: GENERIC_VERIFY_FAIL_MESSAGE });

    const existingActive = await ExchangeRequest.findOne({ orderId: order._id, status: { $in: ACTIVE_EXCHANGE_STATUSES } });
    if (existingActive) {
      return res.status(400).json({ message: 'فيه طلب استبدال لنفس الطلب ده لسه قيد المعالجة' });
    }

    const requestedItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (requestedItems.length === 0) {
      return res.status(400).json({ message: 'اختار على الأقل منتج واحد عايز تستبدله' });
    }

    const settingsDoc = await Settings.findOne().lean();
    const reasonCode = isValidExchangeReasonCode(req.body.reasonCode, settingsDoc) ? req.body.reasonCode : null;
    if (!reasonCode) {
      return res.status(400).json({ message: 'اختار سبب الاستبدال' });
    }
    const customerNote = typeof req.body.customerNote === 'string' ? req.body.customerNote.trim().slice(0, 500) : '';
    if (requiresDetailNote(reasonCode) && !customerNote) {
      return res.status(400).json({ message: 'من فضلك اكتب تفاصيل السبب' });
    }

    const eligibility = checkEligibility({ order, type: 'exchange', reasonCode, settings: settingsDoc });
    if (!eligibility.eligible) {
      return res.status(400).json({ message: eligibility.message });
    }

    const evidenceImages = Array.isArray(req.body.evidenceImages)
      ? req.body.evidenceImages.filter((u) => typeof u === 'string' && u.trim()).slice(0, 10)
      : [];
    if (isEvidenceRequired({ type: 'exchange', reasonCode, settings: settingsDoc }) && evidenceImages.length === 0) {
      return res.status(400).json({ message: 'من فضلك ارفع صورة إثبات واحدة على الأقل لهذا السبب' });
    }

    const validatedItems = [];
    for (const reqItem of requestedItems) {
      const quantity = Number(reqItem.quantity);
      if (!isValidQuantity(quantity)) {
        return res.status(400).json({ message: 'كمية غير صحيحة في أحد المنتجات' });
      }

      const matchingItem = order.items.find(oi =>
        String(oi.productId) === String(reqItem.productId) &&
        String(oi.variantId || '') === String(reqItem.oldVariantId || reqItem.variantId || '') &&
        String(oi.size || '') === String(reqItem.oldSize || reqItem.size || '')
      );
      if (!matchingItem) {
        return res.status(400).json({ message: 'أحد المنتجات مش موجود في هذا الطلب' });
      }
      if (quantity > matchingItem.quantity) {
        return res.status(400).json({ message: `الكمية المطلوبة أكبر من الكمية المشتراة لمنتج "${matchingItem.name?.ar || matchingItem.name?.en || ''}"` });
      }

      const product = await Product.findById(reqItem.productId).lean();
      if (!product) {
        return res.status(400).json({ message: 'المنتج المطلوب استبداله غير موجود' });
      }

      const newVariantId = reqItem.requestedNewVariant?.variantId || reqItem.newVariantId;
      const newSize = reqItem.requestedNewVariant?.size || reqItem.newSize;
      if (!newVariantId || !newSize) {
        return res.status(400).json({ message: 'اختار الفاريانت الجديد (اللون/المقاس) اللي عايز تستبدل بيه' });
      }
      const found = findVariantAndSize(product, newVariantId, newSize);
      if (!found) {
        return res.status(400).json({ message: 'الفاريانت الجديد اللي اخترته مش موجود' });
      }
      if (Number(found.sizeEntry.stock) < quantity) {
        return res.status(400).json({ message: `الفاريانت الجديد المطلوب غير متوفر بالكمية المطلوبة (المتاح: ${Number(found.sizeEntry.stock) || 0})` });
      }

      validatedItems.push({
        productId: matchingItem.productId,
        quantity,
        oldVariant: {
          variantId: matchingItem.variantId || null,
          size: matchingItem.size || null,
          color: matchingItem.color || null,
        },
        requestedNewVariant: {
          variantId: String(newVariantId),
          size: String(newSize),
          color: found.variant.color || null,
        },
      });
    }

    const feeSnapshot = computeFee({ type: 'exchange', reasonCode, settings: settingsDoc });

    const requestId = genRequestId();
    const exchangeRequest = new ExchangeRequest({
      requestId,
      orderId: order._id,
      // العميل هنا مش لازم يكون عامل حساب - لو الأوردر مرتبط بحساب فعلاً
      // (order.customerId موجود) بنحطه، غير كده بيفضل null (شوف تعديل
      // models/ExchangeRequest.js اللي بيسمح بده).
      userId: order.customerId || null,
      requestedBy: 'customer',
      submittedAsGuest: true,
      type: 'exchange',
      items: validatedItems,
      reasonCode,
      reason: reasonCode,
      customerNote: customerNote || null,
      evidenceImages,
      fee: feeSnapshot.fee,
      currency: feeSnapshot.currency,
      feeType: feeSnapshot.feeType,
      status: 'pending',
    });
    exchangeRequest.statusHistory.push({ status: 'pending', at: new Date(), by: null, note: 'العميل قدّم طلب استبدال (بدون تسجيل دخول)' });

    await exchangeRequest.save();
    res.status(201).json({ requestId: exchangeRequest.requestId, status: exchangeRequest.status });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'فيه طلب استبدال لنفس الطلب ده لسه قيد المعالجة' });
    }
    console.error('Error creating exchange request (guest):', err);
    res.status(500).json({ message: 'حصل خطأ في تسجيل طلب الاستبدال' });
  }
};

module.exports = {
  guestLookupOrder,
  guestGetReturnReasons,
  guestGetExchangeReasons,
  guestGetReturnEligibility,
  guestGetExchangeEligibility,
  guestUploadEvidenceImage,
  guestRequestReturn,
  guestRequestExchange,
};