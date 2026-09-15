const crypto = require('crypto');
const mongoose = require('mongoose');
const ExchangeRequest = require('../models/ExchangeRequest');
const { toCustomerExchangeView, toCustomerExchangeViews } = require('../utils/customerExchangeView');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const { parsePagination, buildListResponse } = require('../utils/pagination');
const { isValidExchangeReasonCode, requiresDetailNote, EXCHANGE_REASONS, getEffectiveExchangeReasons } = require('../utils/exchangeReasons');
const { decrementStockAtomic, restoreStockAtomic, logMovement } = require('../utils/inventory');
// ===== Returns & Exchanges - Phase 2A: حساب الرسوم/الأهلية/الصور المطلوبة Server-side =====
const { computeFee, checkEligibility, isEvidenceRequired } = require('../utils/returnExchangeFees');
// ===== FIX: رسائل بيرفو لحالات "طلب الاستبدال" كانت مش موجودة خالص - كل
// حالات الطلب/الشحن/الاسترجاع بتتبعت لها إشعارات ما عدا الاستبدال. بنستخدم
// نفس queueStatusNotification المستخدم مع حالات الاسترجاع في orderController.
const { queueStatusNotification } = require('./orderController');

const MAX_ITEM_QUANTITY = 1000;
const isValidQuantity = (q) => Number.isInteger(q) && q > 0 && q <= MAX_ITEM_QUANTITY;

// خريطة تسمية عربية لحالات طلب الاستبدال - نفس النصوص المستخدمة في العميل
// (EXCHANGE_STATUS_LABELS في App.jsx) عشان الأدمن يقدر يضيف رسالة لأي حالة
// منها في شاشة بيرفو ماركتنج.
const EXCHANGE_STATUS_LABELS_AR = {
  pending: 'طلب الاستبدال قيد المراجعة',
  under_review: 'طلب الاستبدال قيد المراجعة',
  approved: 'تمت الموافقة على طلب الاستبدال',
  rejected: 'تم رفض طلب الاستبدال',
  pickup_scheduled: 'تم جدولة استلام المنتج القديم',
  received: 'تم استلام المنتج القديم',
  processing: 'جاري تجهيز المنتج الجديد',
  completed: 'اكتمل الاستبدال',
  cancelled: 'تم إلغاء طلب الاستبدال',
  carrier_picked_up: 'شركة الشحن استلمت المنتج القديم منك',
  received_at_warehouse: 'وصل المنتج القديم للمخزن',
  inspecting: 'جاري معاينة المنتج القديم',
  shipped_to_customer: 'المنتج الجديد في الطريق إليك',
};

// بيبعت إشعار بيرفو (لو الأدمن مضيف رسالة للحالة دي) من غير ما يوقف أو
// يفشّل تحديث حالة الاستبدال لو الإرسال فشل - نفس فكرة queueStatusNotification.
const queueExchangeStatusNotification = async (exchangeRequest, statusValue) => {
  try {
    const label = EXCHANGE_STATUS_LABELS_AR[statusValue];
    if (!label) return;
    const order = await Order.findById(exchangeRequest.orderId).lean();
    if (!order) return;
    await queueStatusNotification(order, label);
  } catch (err) {
    console.error('Error queuing exchange status notification:', err);
  }
};

// حالات بتعتبر "طلب استبدال شغّال" (لسه ما اتقفلش) - بتمنع فتح طلب استبدال
// جديد لنفس الأوردر لحد ما الطلب الحالي يتقفل (rejected/completed/cancelled).
const ACTIVE_STATUSES = [
  'pending', 'under_review', 'approved', 'pickup_scheduled', 'received', 'processing',
  'carrier_picked_up', 'received_at_warehouse', 'inspecting', 'shipped_to_customer',
];

const genRequestId = () => {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `EX-${Date.now().toString(36).toUpperCase()}-${rand}`;
};

const pushHistory = (doc, status, userId, note) => {
  doc.statusHistory.push({ status, at: new Date(), by: userId || null, note: note || null });
};

// ============================================================
// خصم مخزون الفاريانت الجديد بس (عشان يتشحن للعميل) - مستخدمة في حالتين:
// (1) موافقة الأدمن العادية على طلب عميل قائم (reviewExchangeRequest)
// و(2) لما الأدمن يسجّل استبدال بنفسه نيابة عن العميل (createExchangeRequest
// بـ requestedBy='admin') وبيتعمله approve فوري بنفس اللحظة - بند 5.
// بترجع { ok:true } أو { ok:false, message } من غير ما تعمل throw، عشان
// الـcaller يقدر يرجع 400 بالرسالة المناسبة زي ما كان بالظبط قبل الـrefactor.
//
// ===== FIX: مبقاش بيرجّع مخزون الفاريانت القديم هنا خالص =====
// قبل كده كان بيرجّع مخزون الفاريانت القديم فورًا هنا (وقت الموافقة) قبل ما
// المنتج القديم يوصل فعليًا من العميل - ده غلط لنفس سبب الاسترجاع بالظبط.
// رجوع مخزون الفاريانت القديم بقى معلّق لحد معاينة صريحة - شوف
// inspectExchangeRequest تحت.
// ============================================================
const applyExchangeStockAdjustment = async (exchangeRequest, userId) => {
  const decremented = [];
  for (const item of exchangeRequest.items) {
    const stockItem = {
      productId: item.productId,
      variantId: item.requestedNewVariant.variantId,
      size: item.requestedNewVariant.size,
      quantity: item.quantity,
    };
    const result = await decrementStockAtomic(stockItem);
    if (!result.ok) {
      for (const done of decremented) {
        await restoreStockAtomic(done);
      }
      return { ok: false, message: 'الفاريانت الجديد بقى مش متوفر بالكمية المطلوبة، من فضلك راجع الطلب' };
    }
    decremented.push(stockItem);
    await logMovement(stockItem, 'stock_sold', {
      orderId: exchangeRequest.orderId,
      userId,
      note: `حجز مخزون للفاريانت الجديد بسبب موافقة استبدال (${exchangeRequest.requestId})`,
    });
  }
  return { ok: true };
};

// ============================================================
// إرجاع مخزون الفاريانت القديم فعليًا - بتتنادى بس من inspectExchangeRequest
// لما الأدمن يأكّد إن المنتج القديم وصل ورجع سليم ('good'). منفصلة عن
// applyExchangeStockAdjustment فوق عشان متتنادوش تلقائيًا وقت الموافقة.
// ============================================================
const restoreOldVariantStock = async (exchangeRequest, userId) => {
  for (const item of exchangeRequest.items) {
    const oldStockItem = {
      productId: item.productId,
      variantId: item.oldVariant.variantId,
      size: item.oldVariant.size,
      quantity: item.quantity,
    };
    await restoreStockAtomic(oldStockItem);
    await logMovement(oldStockItem, 'stock_returned', {
      orderId: exchangeRequest.orderId,
      userId,
      note: `إرجاع مخزون الفاريانت القديم بعد معاينة الاستبدال - سليم (${exchangeRequest.requestId})`,
    });
  }
};

// يدوّر على فاريانت + مقاس داخل منتج، ويرجع { variant, sizeEntry } أو null
const findVariantAndSize = (product, variantId, size) => {
  if (!product || !Array.isArray(product.variants)) return null;
  const variant = product.variants.find(v => String(v._id) === String(variantId) || String(v.id) === String(variantId));
  if (!variant) return null;
  const sizeEntry = (variant.sizeStock || []).find(s => String(s.size) === String(size));
  if (!sizeEntry) return null;
  return { variant, sizeEntry };
};

// ============================================================
// POST /api/orders/:id/exchange-request  (عميل)
// ============================================================
const createExchangeRequest = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'الطلب مش موجود' });

    // ===== الأدمن/الكول سنتر يقدر يسجّل استبدال بنفسه نيابة عن العميل =====
    // (زي reviewReturnRequest action='create' بالظبط - مثلاً العميل كلّمه
    // تليفونيًا وطلب يستبدل منتج). لسه بيتم التحقق إن الطلب فعلاً بتاع نفس
    // العميل لو الطالب مش أدمن/كول سنتر.
    const isPrivilegedRequester = req.user && ['admin', 'call_center'].includes(req.user.role);
    if (!req.user || (!isPrivilegedRequester && String(order.customerId || '') !== String(req.user._id))) {
      return res.status(403).json({ message: 'الطلب ده مش تابع لحسابك' });
    }

    const existingActive = await ExchangeRequest.findOne({ orderId: order._id, status: { $in: ACTIVE_STATUSES } });
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

    // ===== الأهلية (Settings.enableExchanges + الطلب اتسلم + نافذة زمنية) =====
    const eligibility = checkEligibility({ order, type: 'exchange', reasonCode, settings: settingsDoc });
    if (!eligibility.eligible) {
      return res.status(400).json({ message: eligibility.message });
    }

    // ===== صور الإثبات (لو مطلوبة للسبب ده حسب الإعدادات) =====
    const evidenceImages = Array.isArray(req.body.evidenceImages)
      ? req.body.evidenceImages.filter((u) => typeof u === 'string' && u.trim()).slice(0, 10)
      : [];
    if (isEvidenceRequired({ type: 'exchange', reasonCode, settings: settingsDoc }) && evidenceImages.length === 0) {
      return res.status(400).json({ message: 'من فضلك ارفع صورة إثبات واحدة على الأقل لهذا السبب' });
    }

    // ===== تحقق من كل عنصر مقابل الطلب الأصلي + المخزون الجديد =====
    const validatedItems = [];
    for (const reqItem of requestedItems) {
      const quantity = Number(reqItem.quantity);
      if (!isValidQuantity(quantity)) {
        return res.status(400).json({ message: 'كمية غير صحيحة في أحد المنتجات' });
      }

      // العنصر لازم يكون فعلاً جزء من الطلب (نفس منتج/فاريانت/مقاس قديم)
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

      // المنتج نفسه لازم يكون موجود فعلاً (بيستخدم الـProducts الموجودة بالفعل)
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

    // ===== Snapshot الرسوم وقت إنشاء الطلب (بند 5 + 6) - Backend بس =====
    const feeSnapshot = computeFee({ type: 'exchange', reasonCode, settings: settingsDoc });

    const requestId = genRequestId();
    const exchangeRequest = new ExchangeRequest({
      requestId,
      orderId: order._id,
      // لو الأدمن هو اللي سجّل الطلب، الـuserId بيفضل بتاع العميل الحقيقي
      // (مالك الطلب) - مش الأدمن - عشان "طلباتي" عند العميل تعرضه صح.
      userId: isPrivilegedRequester ? order.customerId : req.user._id,
      requestedBy: isPrivilegedRequester ? 'admin' : 'customer',
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
    pushHistory(exchangeRequest, 'pending', req.user._id, isPrivilegedRequester ? 'الأدمن سجّل طلب استبدال بالنيابة عن العميل' : 'العميل قدّم طلب استبدال');

    // ===== الأدمن (زي الاسترجاع بالظبط): خطوة واحدة - بيتعمله approve فوري =====
    // مهم: نحفظ الطلب pending أولًا قبل لمس المخزون. كده لو طلبان إداريان
    // اتبعتوا في نفس اللحظة، الـunique active index يحسم السباق قبل أي خصم
    // مخزون، ومفيش احتمال إن الطلب الخاسر يخصم مخزون ثم يفشل في save.
    if (isPrivilegedRequester) {
      await exchangeRequest.save();

      const stockResult = await applyExchangeStockAdjustment(exchangeRequest, req.user._id);
      if (!stockResult.ok) {
        await ExchangeRequest.deleteOne({ _id: exchangeRequest._id, status: 'pending' }).catch((deleteErr) => {
          console.error('Failed to clean up exchange request after stock failure:', deleteErr.message);
        });
        return res.status(400).json({ message: stockResult.message });
      }
      exchangeRequest.status = 'approved';
      exchangeRequest.reviewedBy = req.user._id;
      exchangeRequest.reviewedAt = new Date();
      exchangeRequest.stockAdjusted = true;
      exchangeRequest.stockAdjustedAt = new Date();
      // مخزون الفاريانت القديم بيفضل معلّق لحد ما يوصل فعليًا ويتعاين
      exchangeRequest.oldVariantInspectionResult = 'pending';
      pushHistory(exchangeRequest, 'approved', req.user._id, 'تم تسجيله والموافقة عليه بواسطة الأدمن مباشرة');

      // ===== Phase 2C (تصحيح 2): نفس فكرة reviewExchangeRequest بالظبط - حالة
      // الأوردر تتغيّر لـ"مستبدل" فورًا هنا كمان لما الأدمن يسجّل الاستبدال
      // بنفسه بخطوة واحدة (مش بس لما العميل يطلب والأدمن يوافق بعدين). =====
      try {
        await Order.findByIdAndUpdate(order._id, { status: 'مستبدل' });
        require('../utils/cache').del('orders:all');
      } catch (orderErr) {
        console.error('Error updating order status to مستبدل:', orderErr);
      }
    }

    await exchangeRequest.save();
    res.status(201).json(isPrivilegedRequester ? exchangeRequest : toCustomerExchangeView(exchangeRequest));
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'فيه طلب استبدال لنفس الطلب ده لسه قيد المعالجة' });
    }
    console.error('Error creating exchange request:', err);
    res.status(500).json({ message: 'حصل خطأ في تسجيل طلب الاستبدال'});
  }
};

// ============================================================
// GET /api/exchange-requests/mine  (عميل)
// ============================================================
const getMyExchangeRequests = async (req, res) => {
  try {
    const requests = await ExchangeRequest.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json(toCustomerExchangeViews(requests));
  } catch (err) {
    console.error('Error fetching my exchange requests:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب طلبات الاستبدال'});
  }
};

// ============================================================
// GET /api/exchange-requests  (أدمن)
// ============================================================
const getExchangeRequests = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.orderId) filter.orderId = req.query.orderId;

    const { isPaginated, page, limit, skip } = parsePagination(req.query);
    const [items, total] = await Promise.all([
      ExchangeRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ExchangeRequest.countDocuments(filter),
    ]);

    // ===== إصلاح: رقم الأوردر (orderNumber القصير) مش متسجّل جوه
    // ExchangeRequest نفسه (بس فيه orderId اللي هو الـ Order._id الطويل)،
    // فبنجيب رقم الأوردر القصير لكل الأوردرات المطلوبة هنا بطلب واحد
    // بس ونربطهم ببعض، بدل ما يبان الكود الطويل في لوحة الأدمن.
    const orderIds = [...new Set(items.map((it) => String(it.orderId)).filter(Boolean))];
    const relatedOrders = orderIds.length
      ? await Order.find({ _id: { $in: orderIds } }, { orderNumber: 1 }).lean()
      : [];
    const orderNumberById = new Map(relatedOrders.map((o) => [String(o._id), o.orderNumber]));
    const itemsWithOrderNumber = items.map((it) => ({
      ...it,
      orderNumber: orderNumberById.get(String(it.orderId)),
    }));

    res.json(buildListResponse({ isPaginated, page, limit, items: itemsWithOrderNumber, total }));
  } catch (err) {
    console.error('Error fetching exchange requests:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب طلبات الاستبدال'});
  }
};

// ============================================================
// GET /api/exchange-requests/:id  (المالك أو الأدمن)
// ============================================================
const getExchangeRequestById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'طلب الاستبدال مش موجود' });
    }
    const exchangeRequest = await ExchangeRequest.findById(req.params.id);
    if (!exchangeRequest) return res.status(404).json({ message: 'طلب الاستبدال مش موجود' });

    const isOwner = String(exchangeRequest.userId) === String(req.user._id);
    const isPrivileged = req.user.role === 'admin' || req.user.role === 'call_center';
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ message: 'مالكش صلاحية تشوف الطلب ده' });
    }
    res.json(isPrivileged ? exchangeRequest : toCustomerExchangeView(exchangeRequest));
  } catch (err) {
    console.error('Error fetching exchange request:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب طلب الاستبدال'});
  }
};

// ============================================================
// PUT /api/exchange-requests/:id/review  (أدمن) - action: approve | reject
// ============================================================
const reviewExchangeRequest = async (req, res) => {
  try {
    const exchangeRequest = await ExchangeRequest.findById(req.params.id);
    if (!exchangeRequest) return res.status(404).json({ message: 'طلب الاستبدال مش موجود' });

    const action = req.body.action;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action غير معروف - المتاح: approve, reject' });
    }
    if (!['pending', 'under_review'].includes(exchangeRequest.status)) {
      return res.status(400).json({ message: 'الطلب ده مش قيد المراجعة حاليًا' });
    }

    if (action === 'reject') {
      exchangeRequest.status = 'rejected';
      exchangeRequest.reviewedBy = req.user._id;
      exchangeRequest.reviewedAt = new Date();
      if (typeof req.body.adminNote === 'string' && req.body.adminNote.trim()) {
        exchangeRequest.adminNote = req.body.adminNote.trim().slice(0, 500);
      }
      pushHistory(exchangeRequest, 'rejected', req.user._id, exchangeRequest.adminNote);
      await exchangeRequest.save();
      await queueExchangeStatusNotification(exchangeRequest, 'rejected');
      return res.json(exchangeRequest);
    }

    // ===== إعادة حساب الـFee لو الأدمن صحّح السبب وقت المراجعة (اختياري) =====
    // زي نفس فكرة reviewReturnRequest بالظبط - لو مفيش reasonCode جديد مبعوت،
    // بيستخدم الـSnapshot المحفوظ بالفعل من وقت ما العميل قدّم الطلب.
    const reviewSettingsDoc = await Settings.findOne().lean();
    if (isValidExchangeReasonCode(req.body.reasonCode, reviewSettingsDoc) && req.body.reasonCode !== exchangeRequest.reasonCode) {
      const settingsDoc = reviewSettingsDoc;
      const feeSnapshot = computeFee({ type: 'exchange', reasonCode: req.body.reasonCode, settings: settingsDoc });
      exchangeRequest.reasonCode = req.body.reasonCode;
      exchangeRequest.reason = req.body.reasonCode;
      exchangeRequest.fee = feeSnapshot.fee;
      exchangeRequest.currency = feeSnapshot.currency;
      exchangeRequest.feeType = feeSnapshot.feeType;
    }

    // ===== approve: تحقق نهائي من المخزون + خصم الفاريانت الجديد =====
    // (إرجاع الفاريانت القديم بقى معلّق للمعاينة - شوف inspectExchangeRequest)
    const stockResult = await applyExchangeStockAdjustment(exchangeRequest, req.user._id);
    if (!stockResult.ok) {
      return res.status(400).json({ message: stockResult.message });
    }

    exchangeRequest.status = 'approved';
    exchangeRequest.reviewedBy = req.user._id;
    exchangeRequest.reviewedAt = new Date();
    exchangeRequest.stockAdjusted = true;
    exchangeRequest.stockAdjustedAt = new Date();
    // مخزون الفاريانت القديم بيفضل معلّق لحد ما يوصل فعليًا ويتعاين
    exchangeRequest.oldVariantInspectionResult = 'pending';
    if (typeof req.body.adminNote === 'string' && req.body.adminNote.trim()) {
      exchangeRequest.adminNote = req.body.adminNote.trim().slice(0, 500);
    }
    pushHistory(exchangeRequest, 'approved', req.user._id, exchangeRequest.adminNote);
    await exchangeRequest.save();

    // ===== Phase 2C (تصحيح): حالة الأوردر الأصلي تتغيّر لـ"مستبدل" فورًا وقت
    // الموافقة - بالظبط زي "مرتجع" مع الاسترجاع (مش لازم تستنى لحد "مكتمل")،
    // عشان الأدمن يشوف التغيير فورًا في تبويب الطلبات. =====
    if (exchangeRequest.orderId) {
      try {
        await Order.findByIdAndUpdate(exchangeRequest.orderId, { status: 'مستبدل' });
        require('../utils/cache').del('orders:all');
      } catch (orderErr) {
        console.error('Error updating order status to مستبدل:', orderErr);
      }
    }

    await queueExchangeStatusNotification(exchangeRequest, 'approved');

    res.json(exchangeRequest);
  } catch (err) {
    console.error('Error reviewing exchange request:', err);
    res.status(500).json({ message: 'حصل خطأ في مراجعة طلب الاستبدال'});
  }
};

// ترتيب الحالات بعد الموافقة - أي تحديث لازم يكون "قدّام" في الترتيب ده (أو cancelled)
const WORKFLOW_ORDER = ['approved', 'carrier_picked_up', 'received_at_warehouse', 'inspecting', 'shipped_to_customer', 'completed'];

// ============================================================
// PUT /api/exchange-requests/:id/status  (أدمن) - تحديث حالة الـworkflow بعد الموافقة
// ============================================================
const updateExchangeStatus = async (req, res) => {
  try {
    const exchangeRequest = await ExchangeRequest.findById(req.params.id);
    if (!exchangeRequest) return res.status(404).json({ message: 'طلب الاستبدال مش موجود' });

    // ===== رقم تتبع شحنة الاستبدال - يدوي بواسطة الأدمن (زي Order.returnTrackingNumber بالظبط) =====
    // مستقل تمامًا عن تغيير الـstatus: ممكن الأدمن يحط رقم التتبع لوحده من
    // غير ما يغيّر حالة الطلب، أو يبعتهم مع بعض في نفس الطلب.
    if (Object.prototype.hasOwnProperty.call(req.body, 'trackingNumber')) {
      const trackingNumber = typeof req.body.trackingNumber === 'string' ? req.body.trackingNumber.trim().slice(0, 120) : '';
      exchangeRequest.trackingNumber = trackingNumber || null;
      // ===== Bosta Return/Exchange Integration: provider + محاولة مزامنة فورية =====
      // لو الأدمن بعت provider (أو سايبه فاضي وعايزين نفترض بوسطة لو موجودة
      // على الأوردر الأصلي)، وشركة الشحن دي supportsTracking، بنحاول نجيب
      // حالة الشحنة فورًا وقت إدخال الرقم - بدل ما الأدمن يستنى دورة الـworker
      // الدوري أو يدوس زرار "مزامنة" لوحده كل مرة.
      if (trackingNumber) {
        const { getCapabilities, getProvider, getConfig } = require('../services/shipping');
        const { applyReturnExchangeStatus, EXCHANGE_WORKFLOW_ADVANCE } = require('../services/shipping/returnExchangeSync');
        const providedKey = typeof req.body.provider === 'string' ? req.body.provider.toLowerCase() : '';
        let key = providedKey;
        if (!key) {
          const order = await Order.findById(exchangeRequest.orderId).select('shippingCompany').lean();
          key = String(order?.shippingCompany || '').toLowerCase();
        }
        exchangeRequest.provider = key || null;
        const caps = key ? getCapabilities(key) : null;
        exchangeRequest.trackingMode = (key && caps?.supportsTracking) ? 'auto' : 'manual';
        if (key && caps?.supportsTracking && exchangeRequest.trackingSyncEnabled) {
          try {
            const config = getConfig(key);
            const result = await getProvider(key).track(trackingNumber, config);
            await applyReturnExchangeStatus({
              doc: exchangeRequest, providerKey: key, rawStatus: result.status,
              statusField: 'trackingStatus', rawStatusField: 'trackingRawStatus',
              workflowField: null, workflowAdvanceMap: null, // الـworkflow (status) بيتحدث تحت لو الأدمن بعت status صراحة؛ منقدمهوش هنا تلقائيًا غير عن طريق الـwebhook/sync الدوري تفاديًا لتعارض مع تحديث الحالة اليدوي في نفس الطلب
              lastSyncField: 'lastTrackingSyncAt', lastEventField: 'lastProviderEvent', save: false,
            });
          } catch (trackErr) {
            exchangeRequest.lastProviderEvent = `sync_failed: ${trackErr.message}`.slice(0, 200);
          }
        }
      } else {
        exchangeRequest.provider = null;
        exchangeRequest.trackingMode = null;
      }
      if (!Object.prototype.hasOwnProperty.call(req.body, 'status')) {
        await exchangeRequest.save();
        return res.json(exchangeRequest);
      }
    }

    const nextStatus = req.body.status;
    const validNext = ['under_review', 'carrier_picked_up', 'received_at_warehouse', 'inspecting', 'shipped_to_customer', 'completed', 'cancelled'];
    if (!validNext.includes(nextStatus)) {
      return res.status(400).json({ message: 'حالة غير معروفة' });
    }

    if (nextStatus === 'under_review') {
      if (exchangeRequest.status !== 'pending') {
        return res.status(400).json({ message: 'الطلب لازم يكون pending عشان تحطه under review' });
      }
    } else if (nextStatus === 'cancelled') {
      if (['completed', 'cancelled', 'rejected'].includes(exchangeRequest.status)) {
        return res.status(400).json({ message: 'مينفعش تلغي الطلب ده في الحالة الحالية' });
      }
      // لو المخزون كان اتعدّل بالفعل (بعد الموافقة)، نرجّعه لأصله بالكامل.
      // ===== FIX: الفاريانت الجديد بيترجّع دايمًا لو stockAdjusted (اتخصم
      // وقت الموافقة زي ما هو دايمًا). لكن الفاريانت القديم منلمسوش (منخصموش
      // تاني) إلا لو كان فعلاً اترجع للمخزون قبل كده (oldVariantStockRestored
      // = true، يعني المعاينة كانت 'good') - لو لسه معلّق ('pending') أو
      // كانت المعاينة 'bad'، يبقى أصلاً مرجعش للمخزون فمفيش حاجة نلغيها. =====
      if (exchangeRequest.stockAdjusted) {
        for (const item of exchangeRequest.items) {
          await restoreStockAtomic({
            productId: item.productId,
            variantId: item.requestedNewVariant.variantId,
            size: item.requestedNewVariant.size,
            quantity: item.quantity,
          });
          await logMovement({
            productId: item.productId,
            variantId: item.requestedNewVariant.variantId,
            size: item.requestedNewVariant.size,
            quantity: item.quantity,
          }, 'stock_returned', {
            orderId: exchangeRequest.orderId,
            userId: req.user._id,
            note: `إلغاء استبدال بعد الموافقة - إرجاع الفاريانت الجديد (${exchangeRequest.requestId})`,
          });

          if (exchangeRequest.oldVariantStockRestored) {
            const oldStockResult = await decrementStockAtomic({
              productId: item.productId,
              variantId: item.oldVariant.variantId,
              size: item.oldVariant.size,
              quantity: item.quantity,
            });
            if (oldStockResult.ok) {
              await logMovement({
                productId: item.productId,
                variantId: item.oldVariant.variantId,
                size: item.oldVariant.size,
                quantity: item.quantity,
              }, 'stock_sold', {
                orderId: exchangeRequest.orderId,
                userId: req.user._id,
                note: `إلغاء استبدال بعد الموافقة - خصم الفاريانت القديم تاني (${exchangeRequest.requestId})`,
              });
            }
          }
        }
        exchangeRequest.stockAdjusted = false;
        if (exchangeRequest.oldVariantStockRestored) {
          exchangeRequest.oldVariantStockRestored = false;
        }
      }
      // ===== لو الطلب اتلغى بعد ما كان approved (حالة الأوردر بقت "مستبدل")،
      // نرجّع حالة الأوردر لـ"تم التسليم" تاني عشان متفضلش عالقة على "مستبدل"
      // لطلب اتلغى فعليًا. =====
      if (exchangeRequest.orderId) {
        try {
          const ord = await Order.findById(exchangeRequest.orderId);
          if (ord && ord.status === 'مستبدل') {
            ord.status = 'تم التسليم';
            await ord.save();
            require('../utils/cache').del('orders:all');
          }
        } catch (orderErr) {
          console.error('Error reverting order status after exchange cancel:', orderErr);
        }
      }
    } else {
      // carrier_picked_up / received_at_warehouse / inspecting / shipped_to_customer / completed - لازم الطلب يكون approved أو مرحلة سابقة في الـworkflow
      const currentIdx = WORKFLOW_ORDER.indexOf(exchangeRequest.status);
      const nextIdx = WORKFLOW_ORDER.indexOf(nextStatus);
      if (currentIdx === -1 || nextIdx === -1 || nextIdx < currentIdx) {
        return res.status(400).json({ message: 'مينفعش تنقل الطلب للحالة دي دلوقتي' });
      }
    }

    exchangeRequest.status = nextStatus;
    const note = typeof req.body.note === 'string' && req.body.note.trim() ? req.body.note.trim().slice(0, 500) : null;
    pushHistory(exchangeRequest, nextStatus, req.user._id, note);
    await exchangeRequest.save();
    await queueExchangeStatusNotification(exchangeRequest, nextStatus);

    res.json(exchangeRequest);
  } catch (err) {
    console.error('Error updating exchange status:', err);
    res.status(500).json({ message: 'حصل خطأ في تحديث حالة طلب الاستبدال'});
  }
};

// ============================================================================
// PUT /api/exchange-requests/:id/inspect  (أدمن)
// ------------------------------------------------------------------------
// "معاينة" الفاريانت القديم بعد ما يوصل فعليًا من العميل (بعد الموافقة على
// الاستبدال). ده اللي بيقرر هل مخزون الفاريانت القديم يرجع فعلاً ولا لأ:
//   - result='good'  -> المنتج سليم -> يرجع للمخزون (restoreOldVariantStock).
//   - result='bad'   -> المنتج تالف/مش سليم -> منرجعوش للمخزون خالص.
// لازم الطلب يكون approved (أو أي مرحلة بعدها) و oldVariantInspectionResult
// لسه 'pending' - عشان منرجعش المخزون مرتين لو اتنادى مرتين بالغلط.
// ============================================================================
const inspectExchangeRequest = async (req, res) => {
  try {
    const { result, note } = req.body;
    if (!['good', 'bad'].includes(result)) {
      return res.status(400).json({ message: "نتيجة المعاينة لازم تكون 'good' أو 'bad'" });
    }

    const exchangeRequest = await ExchangeRequest.findById(req.params.id);
    if (!exchangeRequest) return res.status(404).json({ message: 'طلب الاستبدال مش موجود' });

    if (!exchangeRequest.stockAdjusted) {
      return res.status(400).json({ message: 'لازم الاستبدال يكون approved الأول قبل المعاينة' });
    }
    if (exchangeRequest.oldVariantInspectionResult && exchangeRequest.oldVariantInspectionResult !== 'pending') {
      return res.status(400).json({ message: 'المنتج القديم اتعاين بالفعل' });
    }

    if (result === 'good') {
      await restoreOldVariantStock(exchangeRequest, req.user._id);
      exchangeRequest.oldVariantStockRestored = true;
      exchangeRequest.oldVariantStockRestoredAt = new Date();
    }
    // result === 'bad': منلمسش المخزون خالص - المنتج تالف/مش سليم.

    exchangeRequest.oldVariantInspectionResult = result;
    exchangeRequest.oldVariantInspectedAt = new Date();
    exchangeRequest.oldVariantInspectedBy = req.user._id;
    if (typeof note === 'string' && note.trim()) {
      exchangeRequest.oldVariantInspectionNote = note.trim().slice(0, 500);
    }

    pushHistory(
      exchangeRequest,
      exchangeRequest.status,
      req.user._id,
      result === 'good' ? 'معاينة المنتج القديم: سليم - رجع للمخزون' : 'معاينة المنتج القديم: تالف/مش سليم - مرجعش للمخزون',
    );

    await exchangeRequest.save();
    res.json(exchangeRequest);
  } catch (err) {
    console.error('Error inspecting exchange request:', err);
    res.status(500).json({ message: 'حصل خطأ في معاينة الاستبدال' });
  }
};

// ============================================================
// PUT /api/exchange-requests/:id/cancel  (عميل - قبل الموافقة بس)
// ============================================================
const cancelExchangeRequest = async (req, res) => {
  try {
    const exchangeRequest = await ExchangeRequest.findById(req.params.id);
    if (!exchangeRequest) return res.status(404).json({ message: 'طلب الاستبدال مش موجود' });

    if (String(exchangeRequest.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'الطلب ده مش تابع لحسابك' });
    }
    if (!['pending', 'under_review'].includes(exchangeRequest.status)) {
      return res.status(400).json({ message: 'مينفعش تلغي الطلب ده دلوقتي، تواصل مع خدمة العملاء' });
    }

    exchangeRequest.status = 'cancelled';
    pushHistory(exchangeRequest, 'cancelled', req.user._id, 'العميل ألغى الطلب');
    await exchangeRequest.save();
    await queueExchangeStatusNotification(exchangeRequest, 'cancelled');
    res.json(toCustomerExchangeView(exchangeRequest));
  } catch (err) {
    console.error('Error cancelling exchange request:', err);
    res.status(500).json({ message: 'حصل خطأ في إلغاء طلب الاستبدال'});
  }
};

// GET /api/orders/exchange-reasons  (عام - قايمة أسباب الاستبدال الموحّدة)
const getExchangeReasons = async (req, res) => {
  try {
    const settingsDoc = await Settings.findOne().lean();
    const effective = getEffectiveExchangeReasons(settingsDoc).filter((r) => r.enabled !== false);
    res.json(effective.map(({ code, ar, en }) => ({ code, ar, en })));
  } catch (err) {
    console.error('Error fetching exchange reasons:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب أسباب الاستبدال'});
  }
};

// GET /api/orders/:id/exchange-eligibility?reasonCode=...  (عميل مسجل)
const getExchangeEligibility = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'الطلب مش موجود' });

    if (!req.user || String(order.customerId || '') !== String(req.user._id)) {
      return res.status(403).json({ message: 'الطلب ده مش تابع لحسابك' });
    }

    const settingsDoc = await Settings.findOne().lean();
    const reasonCode = isValidExchangeReasonCode(req.query.reasonCode, settingsDoc) ? req.query.reasonCode : 'other';

    const existingActive = await ExchangeRequest.findOne({ orderId: order._id, status: { $in: ACTIVE_STATUSES } });
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
    console.error('Error checking exchange eligibility:', err);
    res.status(500).json({ message: 'حصل خطأ في التحقق من أهلية الاستبدال'});
  }
};


// ============================================================
// PUT /api/exchange-requests/:id/money  (أدمن) - Phase 2C
// تسجيل اتجاه/مبلغ تحويل فلوس الاستبدال (رسوم بتتحصل من العميل أو فرق سعر
// بيتحول للعميل) وتأكيد إن التحويل تم فعليًا (انستا باي / محفظة).
// ============================================================
const updateExchangeMoney = async (req, res) => {
  try {
    const exchangeRequest = await ExchangeRequest.findById(req.params.id);
    if (!exchangeRequest) return res.status(404).json({ message: 'طلب الاستبدال مش موجود' });

    if (req.body.direction !== undefined) {
      const direction = req.body.direction;
      if (!['none', 'collect_from_customer', 'refund_to_customer'].includes(direction)) {
        return res.status(400).json({ message: 'اتجاه التحويل غير معروف' });
      }
      exchangeRequest.moneyDirection = direction;
    }
    if (req.body.amount !== undefined && req.body.amount !== null && req.body.amount !== '') {
      const amount = Number(req.body.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ message: 'المبلغ غير صحيح' });
      }
      exchangeRequest.moneyAmount = Math.round(amount * 100) / 100;
    }
    if (req.body.method !== undefined) {
      const method = req.body.method;
      if (method !== null && method !== 'instapay' && method !== 'wallet') {
        return res.status(400).json({ message: 'طريقة التحويل غير معروفة' });
      }
      exchangeRequest.moneyMethod = method || null;
    }
    if (typeof req.body.reference === 'string') {
      exchangeRequest.moneyReference = req.body.reference.trim().slice(0, 200) || null;
    }

    let linkedOrder = null;

    if (req.body.transferred === true) {
      if (!exchangeRequest.moneyDirection || exchangeRequest.moneyDirection === 'none') {
        return res.status(400).json({ message: 'حدد اتجاه التحويل الأول' });
      }
      if (!exchangeRequest.moneyAmount) {
        return res.status(400).json({ message: 'حدد مبلغ التحويل الأول' });
      }
      if (!exchangeRequest.moneyMethod) {
        return res.status(400).json({ message: 'حدد طريقة التحويل (انستا باي / محفظة) الأول' });
      }
      exchangeRequest.moneyTransferredAt = new Date();
      exchangeRequest.moneyTransferredBy = req.user ? req.user._id : null;
      const dirLabel = exchangeRequest.moneyDirection === 'collect_from_customer' ? 'العميل حوّل لينا' : 'تم التحويل للعميل';
      pushHistory(
        exchangeRequest,
        exchangeRequest.status,
        req.user ? req.user._id : null,
        `${dirLabel} ${exchangeRequest.moneyAmount} ${exchangeRequest.moneyCurrency || 'EGP'} عبر ${exchangeRequest.moneyMethod === 'instapay' ? 'انستا باي' : 'المحفظة'}`,
      );

      // ===== ربط بالإيرادات - بيتطبّق مرة واحدة بس =====
      // لو كان متطبّق قبل كده (financialImpactApplied) منعملش حاجة تانية،
      // عشان لو "تأكيد التحويل" اتبعت مرتين لنفس الحالة (دبل كليك مثلاً)
      // منضيفش/منخصمش من الإيراد مرتين على نفس المبلغ.
      if (!exchangeRequest.financialImpactApplied) {
        linkedOrder = await Order.findById(exchangeRequest.orderId);
        // ===== FIX: 'amount' was declared with `const` inside the `if (linkedOrder)`
        // block below but used at "financialImpactAmount = amount" outside that
        // block (still inside this outer if) - guaranteed ReferenceError on every
        // single "confirm money transfer" action, regardless of whether linkedOrder
        // was found. Same class of bug as the sizeEntry/decrementOrderItems fixes
        // above (block-scoped const used outside its scope). Moved the declaration
        // up here so it's in scope for both the linkedOrder branch and the
        // financialImpactAmount assignment below. =====
        const amount = Number(exchangeRequest.moneyAmount) || 0;
        if (linkedOrder) {
          if (exchangeRequest.moneyDirection === 'refund_to_customer') {
            const current = Number(linkedOrder.refundedAmount || 0);
            const capped = Math.min(Number(linkedOrder.totalAmount || 0), Math.round((current + amount) * 100) / 100);
            linkedOrder.refundedAmount = capped;
          } else if (exchangeRequest.moneyDirection === 'collect_from_customer') {
            const current = Number(linkedOrder.exchangeExtraCollected || 0);
            linkedOrder.exchangeExtraCollected = Math.round((current + amount) * 100) / 100;
          }
          await linkedOrder.save();
        }
        exchangeRequest.financialImpactApplied = true;
        exchangeRequest.financialImpactAmount = amount;
        exchangeRequest.financialImpactDirection = exchangeRequest.moneyDirection;
      }
    } else if (req.body.transferred === false) {
      exchangeRequest.moneyTransferredAt = null;
      exchangeRequest.moneyTransferredBy = null;

      // ===== عكس الأثر المالي لو كان اتطبّق قبل كده =====
      // بنستخدم financialImpactAmount/Direction المحفوظين (مش
      // moneyAmount/moneyDirection الحاليين) عشان نعكس بالظبط نفس القيمة
      // اللي كانت اتضافت، حتى لو الأدمن غيّر المبلغ/الاتجاه في نفس الوقت.
      if (exchangeRequest.financialImpactApplied) {
        linkedOrder = await Order.findById(exchangeRequest.orderId);
        if (linkedOrder) {
          const amount = Number(exchangeRequest.financialImpactAmount) || 0;
          if (exchangeRequest.financialImpactDirection === 'refund_to_customer') {
            const current = Number(linkedOrder.refundedAmount || 0);
            linkedOrder.refundedAmount = Math.max(0, Math.round((current - amount) * 100) / 100);
          } else if (exchangeRequest.financialImpactDirection === 'collect_from_customer') {
            const current = Number(linkedOrder.exchangeExtraCollected || 0);
            linkedOrder.exchangeExtraCollected = Math.max(0, Math.round((current - amount) * 100) / 100);
          }
          await linkedOrder.save();
        }
        exchangeRequest.financialImpactApplied = false;
        exchangeRequest.financialImpactAmount = 0;
        exchangeRequest.financialImpactDirection = null;
      }
    }

    await exchangeRequest.save();
    res.json(exchangeRequest);
  } catch (err) {
    console.error('Error updating exchange money transfer:', err);
    res.status(500).json({ message: 'حصل خطأ في تحديث تحويل فلوس الاستبدال'});
  }
};

// ============================================================================
// POST /api/exchange-requests/:id/sync-tracking
// ------------------------------------------------------------------------
// زرار "مزامنة التتبع الآن" - نفس فكرة syncOrderReturnTracking/
// syncOrderExchangeTracking في shippingController.js لكن لـExchangeRequest
// المستقل. بيرجع خطأ واضح (MANUAL_TRACKING_ONLY) لو الشركة مش بتدعم تتبع
// آلي، عشان الفرونت يعرف يعرض "تحديث يدوي فقط" بدل ما يفضل يحاول.
// ============================================================================
const syncExchangeTracking = async (req, res) => {
  try {
    const exchangeRequest = await ExchangeRequest.findById(req.params.id);
    if (!exchangeRequest) return res.status(404).json({ message: 'طلب الاستبدال مش موجود' });
    if (!exchangeRequest.trackingNumber) return res.status(400).json({ ok: false, message: 'لا يوجد رقم تتبع لهذا الطلب' });

    const { getCapabilities, getProvider, getConfig } = require('../services/shipping');
    const { applyReturnExchangeStatus, EXCHANGE_WORKFLOW_ADVANCE } = require('../services/shipping/returnExchangeSync');
    const key = String(exchangeRequest.provider || '').toLowerCase();
    const caps = key ? getCapabilities(key) : null;
    if (!key || !caps?.supportsTracking) {
      return res.status(400).json({ ok: false, message: `شركة الشحن (${key || '?'}) لا تدعم التتبع الآلي - التحديث يدوي بالكامل`, code: 'MANUAL_TRACKING_ONLY' });
    }
    const config = getConfig(key);
    const result = await getProvider(key).track(exchangeRequest.trackingNumber, config);
    const outcome = await applyReturnExchangeStatus({
      doc: exchangeRequest, providerKey: key, rawStatus: result.status,
      statusField: 'trackingStatus', rawStatusField: 'trackingRawStatus',
      workflowField: 'status', workflowAdvanceMap: EXCHANGE_WORKFLOW_ADVANCE,
      lastSyncField: 'lastTrackingSyncAt', lastEventField: 'lastProviderEvent',
    });
    res.json({ ok: true, result, outcome, exchangeRequest });
  } catch (e) {
    console.error('Exchange tracking sync error:', e);
    const safeMessage = (e && e.data !== undefined) ? `فشل الاتصال بشركة الشحن (HTTP ${e.status || 'error'})` : ((e && e.message) || 'حصل خطأ غير متوقع');
    res.status(e.status || 400).json({ ok: false, message: safeMessage });
  }
};

module.exports = {
  createExchangeRequest,
  getMyExchangeRequests,
  getExchangeRequests,
  getExchangeRequestById,
  reviewExchangeRequest,
  updateExchangeStatus,
  inspectExchangeRequest,
  updateExchangeMoney,
  cancelExchangeRequest,
  syncExchangeTracking,
  // ===== Returns & Exchanges - Phase 2A =====
  getExchangeReasons,
  getExchangeEligibility,
};