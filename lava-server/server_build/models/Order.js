const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: mongoose.Schema.Types.Mixed, default: null },
  variantId: String,
  size: String,
  color: { type: mongoose.Schema.Types.Mixed, default: null },
  colorHex: { type: String, default: null },
  productImage: { type: String, default: null },
  price: Number,          // السعر الفعلي اللي دفعه العميل (بعد أي خصم باندل)
  originalPrice: Number,  // السعر الأصلي للمنتج قبل خصم الباندل
  costPrice: Number,
  quantity: { type: Number, default: 1 },  // ===== حقول الباندل =====
  isBundleItem: { type: Boolean, default: false },
  bundleDiscount: { type: Number, default: 0 },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  // ===== رقم الأوردر المتسلسل (1001، 1002، 1003...) =====
  // بيتولد أوتوماتيك وقت إنشاء الأوردر عن طريق utils/orderNumber.js (Counter
  // بيبدأ من 1000). sparse: true عشان الأوردرات القديمة (قبل إضافة الحقل ده)
  // مفيهاش القيمة دي أصلاً ومنعرفش نحط لها unique index عادي غير sparse.
  orderNumber: { type: Number, default: null, unique: true, sparse: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerPhone2: String,
  customerEmail: String,
  emailConfirmation: {
    enabled: { type: Boolean, default: false },
    confirmed: { type: Boolean, default: false },
    confirmedAt: { type: Date, default: null },
    // ===== إلغاء الطلب من طرف العميل من زرار "إلغاء الطلب" في الإيميل =====
    cancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: null },
    // ===== P1-5: منع إعادة استخدام نفس رابط الإلغاء أكتر من مرة =====
    // بنخزن hash (مش التوكن الخام) لأول توكن نجح في تنفيذ الإلغاء فعليًا،
    // عشان أي محاولة POST تانية (حتى بتوكن مختلف صالح لنفس الطلب) تتعامل
    // كـ"already cancelled" بدل ما تنفّذ أي منطق تاني أو تسرّب فرق في الرسالة.
    cancelTokenHash: { type: String, default: null },
    messageId: { type: String, default: null },
    // ===== حالة إرسال رسالة/واتساب تأكيد الطلب في الخلفية =====
    // not_sent: مفيش رسالة اتجدولت أصلاً. pending: اتجدولت ولسه مبعتتش.
    // sent: اتبعتت بنجاح. failed: فشلت بعد استنفاد كل محاولات الـ retry.
    status: { type: String, enum: ['not_sent', 'pending', 'sent', 'failed'], default: 'not_sent' },
  },
  items: [orderItemSchema],
  subtotal: Number,
  discount: Number,
  discountType: String,
  discountCode: String,
  // ===== إصلاح باج: كود ولاء ممكن يتستخدم مرات لا نهائية مع الدفع الأونلاين =====
  // بيتسجل هنا بس لما كود الولاء يتطبق فعليًا وقت إنشاء الطلب (loyaltyCodeApplied).
  // للطلبات cod/wallet: الكود بيتحجز atomically فورًا وقت الإنشاء (مش محتاج الحقل ده أصلاً).
  // للطلبات kashier/paymob: الحجز بيتأجل لحد ما الدفع ينجح فعليًا (markPaid في
  // paymentController.js) - الحقل ده هو اللي بيوصّل للـ webhook أي كود يفضّي يحجزه
  // بعد نجاح الدفع، عشان الكود ميتسجلش "مستخدم" لو الدفع فشل أو اتلغى.
  usedLoyaltyCode: { type: String, default: null },
  promoLabel: String,
  shippingCost: Number,
  totalAmount: Number,
  governorate: String,
  country: String,
  address: String,
  zipCode: String,

  // ===== العنوان المنظّم (Phase 2 - عام لكل شركات الشحن) =====
  // ملحوظة توافق: الحقول القديمة فوق (address / governorate / country /
  // zipCode / customerName / customerPhone) فضلت زي ما هي بالظبط ومتغيّرتش،
  // وكل الكود الحالي (الأدمن، التصدير، Aramex/DHL/Bosta) لسه بيقرأها عادي.
  // shippingAddress ده إضافة جديدة بس (subdocument اختياري)، بيحتوي على نفس
  // البيانات لكن بشكل منظم لعناصر العنوان (منطقة/رقم عمارة/دور/شقة/علامة
  // مميزة) - مطلوب لبوسطة تحديدًا لاحقًا (Phase 3) لكنه مش خاص بيها، أي
  // شركة شحن تانية ممكن تستخدم منه اللي محتاجاه بس.
  // الطلبات القديمة (قبل Phase 2) مفيهاش الحقل ده أصلاً - وده طبيعي وسليم،
  // أي كود بيقرأه لازم يعمل fallback للحقول القديمة (address/governorate)
  // لو مش موجود، بالظبط زي ما بيحصل في orderController حاليًا.
  shippingAddress: {
    fullName: { type: String, default: null },
    phone: { type: String, default: null },
    phone2: { type: String, default: null },
    email: { type: String, default: null },
    governorate: { type: String, default: null },
    district: { type: String, default: null },      // الحي / المنطقة / الزون
    detailedAddress: { type: String, default: null }, // الشارع وتفاصيل العنوان
    buildingNumber: { type: String, default: null },
    floor: { type: String, default: null },
    apartment: { type: String, default: null },
    landmark: { type: String, default: null },       // علامة مميزة قريبة من العنوان
    country: { type: String, default: null },
    zipCode: { type: String, default: null },
  },

  notes: String,
  status: { type: String, default: 'جديد' },
  packerStatus: { type: String, default: 'لم يتم التجهيز' },

  // ===== الدفع =====
  paymentMethod: { type: String, default: 'cod', enum: ['cod', 'wallet', 'kashier', 'paymob'] }, // 'cod' | 'wallet' | 'kashier' | 'paymob'
  paymentStatus: { type: String, default: 'pending', enum: ['pending', 'paid', 'failed', 'refunded'] },
  walletPayment: {
    methodId: { type: String, default: null },
    methodName: { type: String, default: null },
    walletPhoneNumber: { type: String, default: null },
    senderPhone: { type: String, default: null },
    transferDate: { type: String, default: null },
    screenshotUrl: { type: String, default: null },
    screenshotPublicId: { type: String, default: null },
    confirmed: { type: Boolean, default: false },
    confirmedAt: { type: Date, default: null },
  },

  // ===== الشحن =====
  shippingStatus: {
    type: String,
    default: 'pending',
    // القيم القديمة اتسابت زي ما هي بالظبط عشان منكسرش أي Order/Filter قديم.
    // اتضاف عليها الحالات الداخلية الموحدة (Internal Statuses) اللي بيرجعها
    // نظام الشحن الجديد بعد ما يعمل Normalize لاستجابة Bosta/Aramex/DHL.
    enum: [
      'pending', 'preparing', 'shipped', 'delivered', 'failed_delivery', 'returned',
      'created', 'picked_up', 'in_transit', 'out_for_delivery', 'cancelled', 'failed',
    ]
  },
  shippingCompany: { type: String, default: null },
  shippingProviderId: { type: String, default: null },
  shippingLabelUrl: { type: String, default: null },   // اسم شركة الشحن (Aramex, Bosta, J&T...)
  trackingNumber: { type: String, default: null },    // رقم التتبع
  shippingNotes: { type: String, default: null },     // ملاحظات الشحن / مشاكل
  // رسالة الخطأ لو فشل إنشاء/تحديث الشحنة مع شركة الشحن (بدون أي Secrets).
  // الطلب (Order) نفسه بيفضل موجود دايمًا حتى لو فشلت الشحنة.
  shippingError: { type: String, default: null },
  // كود الخطأ المهيكل (structured error code) زي BOSTA_SUBSCRIPTION_REQUIRED
  // أو BOSTA_ADDRESS_INCOMPLETE - إضافة Phase 3 اختيارية (بند 13)، مش بديل
  // عن shippingError (الرسالة القابلة للعرض) لكن بتساعد الأدمن/الفرونت يميز
  // نوع المشكلة برمجيًا (زرار "تعديل العنوان" مثلاً لو الكود BOSTA_ADDRESS_INCOMPLETE).
  shippingErrorCode: { type: String, default: null },
  shippingCreatedAt: { type: Date, default: null },   // وقت أول محاولة ناجحة لإنشاء الشحنة
  shippingUpdatedAt: { type: Date, default: null },   // آخر تحديث لحالة الشحنة (إنشاء/تتبع/فشل)
  shippedAt: { type: Date, default: null },           // تاريخ الشحن الفعلي
  deliveredAt: { type: Date, default: null },         // تاريخ الاستلام الفعلي
  // الحالة الخام (raw) زي ما رجعت بالظبط من شركة الشحن، بالإضافة لـ
  // shippingStatus (الحالة الداخلية الموحّدة بعد الـnormalize). بتتحفظ
  // عشان أي تفصيل من الشركة ميضيعش حتى لو مالوش مقابل داخلي معروف.
  shippingRawStatus: { type: String, default: null },

  // ===== الإرجاع (Return) =====
  // ملحوظة: بتتحفظ بس لو فعليًا اتعمل return شحنة عبر official API لشركة
  // الشحن (شوف services/shipping/capabilities.js - supportsReturns). حاليًا
  // مفيش شركة من الأربعة بتدعم Return عبر API موثّق في المشروع ده.
  returnShipmentId: { type: String, default: null },
  returnTrackingNumber: { type: String, default: null },
  returnStatus: { type: String, default: null },
  // ===== Bosta Return/Exchange Integration - حقول مزامنة التتبع اليدوي =====
  // لحد ما شركة شحن تدعم إنشاء Return عبر API رسمي (شوف capabilities.js)،
  // الأدمن بيعمل العملية يدويًا على موقع/تطبيق الشركة وبعدين يدخّل رقم
  // التتبع هنا (returnTrackingNumber فوق) + الشركة (returnTrackingProvider) -
  // لو الشركة بتدعم supportsTracking، بنحاول نجيب حالة الشحنة تلقائيًا
  // (فورًا وقت الإدخال + كل فترة عن طريق shippingSyncWorker) بدل ما الأدمن
  // يحدّث الحالة يدويًا كل مرة. لو مش مدعومة أو المزامنة اتقفلت يدويًا
  // (returnTrackingSyncEnabled=false)، الأدمن بيحدّث returnRequestStatus
  // يدويًا زي ما هو النظام الحالي بالظبط - مفيش أي كسر لأي سلوك قديم.
  returnTrackingProvider: { type: String, default: null }, // 'bosta' مثلاً - ممكن يختلف عن shippingCompany بتاع شحنة الذهاب
  returnTrackingRawStatus: { type: String, default: null },
  returnTrackingSyncEnabled: { type: Boolean, default: true },
  returnLastTrackingSyncAt: { type: Date, default: null },
  returnLastProviderEvent: { type: String, default: null },
  // ===== الاستبدال (Exchange) =====
  // نفس الملحوظة أعلاه - بتتحفظ بس لو الشركة بتدعم Exchange رسميًا.
  exchangeShipmentId: { type: String, default: null },
  exchangeTrackingNumber: { type: String, default: null },
  exchangeStatus: { type: String, default: null },
  // نفس فكرة حقول return التتبع فوق، لكن للاستبدال على مستوى الأوردر نفسه
  // (النظام القديم قبل ExchangeRequest المستقل - شوف models/ExchangeRequest.js
  // اللي هو نفس الفكرة بالظبط لكن بحقوله الخاصة).
  exchangeTrackingProvider: { type: String, default: null },
  exchangeTrackingRawStatus: { type: String, default: null },
  exchangeTrackingSyncEnabled: { type: Boolean, default: true },
  exchangeLastTrackingSyncAt: { type: Date, default: null },
  exchangeLastProviderEvent: { type: String, default: null },

  // ===== حماية المخزون من الاسترجاع المكرر =====
  // stockRestored: بيبقى true أول ما يتم إرجاع المخزون بسبب إلغاء/رفض/ارتجاع،
  // عشان لو حد نادى على endpoint الإلغاء أكتر من مرة، المخزون ميترجعش مرتين.
  stockRestored: { type: Boolean, default: false },
  stockRestoredAt: { type: Date, default: null },
  // Prevent duplicate coupon-usage release when multiple payment-failure handlers race.
  discountUsageReleased: { type: Boolean, default: false },

  // ===== مراجع بوابة الدفع (Kashier / Paymob) — بتتسجل لما الطلب يتدفع =====
  // لازمة عشان نقدر نعمل refund (استرجاع فلوس) من خلال الـ API بتاع البوابة،
  // لأن الاسترجاع محتاج رقم عملية البوابة نفسها، مش رقم الأوردر عندنا.
  paymentGateway: {
    kashierOrderId: { type: String, default: null }, // رقم أوردر Kashier الداخلي (مختلف عن merchantOrderId)
    transactionId: { type: String, default: null },  // رقم العملية (Kashier transactionId أو Paymob transaction id)
  },

  // ===== سجل عمليات الاسترجاع (استرجاع كامل أو جزئي) =====
  refunds: [{
    amount: { type: Number, required: true },
    reason: { type: String, default: null },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: null },
  }],
  // إجمالي المبلغ اللي اترجع لحد دلوقتي (بيسمح بعمل استرجاع جزئي أكتر من مرة)
  refundedAmount: { type: Number, default: 0 },
  // ===== فلوس الاستبدال (Exchange) اللي اتحصّلت فعليًا من العميل =====
  // (فرق سعر بيدفعه العميل وقت الاستبدال - مش الرسوم الثابتة). بيتزوّد هنا
  // بس لما الأدمن يأكّد إن التحويل تم فعليًا (controllers/exchangeController.js
  // -> updateExchangeMoney)، وبيتضاف على الإيراد في لوحة البيانات
  // (getPaymentsDashboard). فلوس الاستبدال اللي بترجع للعميل (refund_to_customer)
  // بتتسجل في refundedAmount نفسه فوق - مش حقل منفصل - عشان تتخصم من
  // الإيراد بنفس منطق الاسترجاع العادي بالظبط.
  exchangeExtraCollected: { type: Number, default: 0 },
  // ===== FIX: منع تنفيذ استرجاعين في نفس الوقت على نفس الطلب =====
  // لو الأدمن دوس "استرجاع" مرتين بسرعة (أو ضغط دبل كليك)، كان ممكن الطلبين
  // يتنفذوا مع بعض قبل ما أي واحد فيهم يخلص ويحفظ في قاعدة البيانات — فكل
  // واحد فيهم بيحسب "الباقي المتاح للاسترجاع" من نفس النسخة القديمة للطلب
  // (مثلاً 700 كامل)، وبينادي بوابة الدفع بمبلغ 100 لكل واحد بشكل منفصل.
  // بعض بوابات الدفع (زي Kashier) بترجع "نجاح" حتى لو الاسترجاع التاني كان
  // مكرر فعليًا (idempotent) من غير ما تسحب فلوس تانية فعليًا — فعندنا محليًا
  // بيتسجل 200 (100+100) بينما البوابة فعليًا سحبت 100 بس. هذا الحقل بيقفل
  // الطلب أثناء تنفيذ عملية استرجاع، فمينفعش يتنفذ استرجاع تاني عليه إلا لما
  // الأول يخلص (نجح أو فشل) ويفتح القفل تاني.
  refundInProgress: { type: Boolean, default: false },
  refundInProgressAt: { type: Date, default: null },

  // ===== تفاصيل الإرجاع (Return) لأغراض تحليل الربح =====
  // returnShippingCost: تكلفة شحن الإرجاع الفعلية (رحلة الرجوع بس، منفصلة عن
  // shippingCost الأصلي بتاع الذهاب) - بتتسجل يدويًا من الأدمن وقت ما يوصله
  // فاتورة شركة الشحن، أو ممكن تتحسب تلقائيًا لاحقًا لو الشركة بترجع الرقم
  // ده في الـ webhook. لو مش موجودة، حسابات الربح بترجع لتقدير تقريبي.
  returnShippingCost: { type: Number, default: null },
  // سبب الإرجاع - بيتسجل وقت ما حالة الطلب تتغير لـ"مرتجع" عشان نعرف مصدر
  // المشكلة (منتج مش مطابق، تأخير شحن، العميل غيّر رأيه...الخ).
  returnReason: { type: String, default: null },

  // ===== طلب استرجاع منتج/منتجات محددة من الطلب (مش الطلب كله بالضرورة) =====
  // ده منفصل عن returnReason/returnStatus فوق (اللي خاصين بشحنة الإرجاع مع
  // شركة الشحن نفسها). الحقول دي بتسجل *أنهي منتج بالظبط* اترجع وبكام قطعة،
  // سواء العميل هو اللي طلب الاسترجاع من صفحة طلباته، أو الأدمن هو اللي
  // بدأه بنفسه من لوحة التحكم واختار المنتج. الأدمن دايمًا هو اللي بيوافق
  // نهائيًا حتى لو العميل هو اللي بدأ الطلب.
  returnItems: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    variantId: String,
    size: String,
    quantity: { type: Number, default: 1 },
    reason: { type: String, default: null },
  }],
  returnRequestedBy: { type: String, enum: ['customer', 'admin', null], default: null },
  // ===== نفس فكرة ExchangeRequest.submittedAsGuest - علامة إضافية بس للعرض
  // في الأدمن، تدل إن طلب الاسترجاع ده اتقدّم من صفحة "بدون تسجيل دخول"
  // (تحقق برقم الأوردر + رقم الهاتف). مبتأثرش على أي منطق موجود
  // (default: false، الطلبات القديمة تفضل زي ما هي).
  returnRequestedAsGuest: { type: Boolean, default: false },
  // ===== Phase 2C: مراحل أدق لسير عمل الاسترجاع بعد الموافقة =====
  // (شركة الشحن استلمت المنتج من العميل -> وصل المخزن -> جاري المعاينة ->
  // مكتمل بعد تحويل الفلوس). القيم القديمة (none/pending/approved/rejected)
  // متسابتش عشان التوافق مع أي طلبات قديمة.
  returnRequestStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected', 'carrier_picked_up', 'received_at_warehouse', 'inspecting', 'completed', 'cancelled'],
    default: 'none',
  },
  returnRequestReason: { type: String, default: null }, // سبب عام كتبه العميل/الأدمن وقت الطلب (نص حر)
  // كود سبب موحّد من قايمة ثابتة (شوف utils/returnReasons.js) - ده اللي بيتحدد
  // بيه هل رسوم شحن الاسترجاع تتطبق على العميل ولا لأ (returnFeeCharged تحت).
  returnRequestReasonCode: { type: String, default: null },
  returnRequestedAt: { type: Date, default: null },
  returnReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  returnReviewedAt: { type: Date, default: null },
  returnAdminNote: { type: String, default: null },
  // ===== رسوم شحن الاسترجاع اللي اتخصمت من مبلغ الاسترجاع =====
  // بتتحسب تلقائيًا وقت موافقة الأدمن (approve/create) بناءً على returnRequestReasonCode:
  // لو السبب "عيب في المنتج/غلط منا" تفضل صفر (المتجر بيتحمل)، غير كده بتتخصم
  // قيمتها من Settings.returnFeeAmount. الأدمن يقدر يعدلها يدويًا وقت المراجعة.
  returnFeeCharged: { type: Number, default: 0 },
  // ===== Snapshot الرسوم (Phase 2A - بند 6) =====
  // بتتحفظ وقت إنشاء طلب الاسترجاع (Settings الحالية وقتها) ومتتأثرش لو
  // الأدمن غيّر Settings.returnFeeAmount بعد كده - نفس منطق returnFeeCharged
  // (اللي فضل موجود للتوافق مع الكود القديم) لكن بإضافة العملة ونوع الرسوم.
  returnFeeCurrency: { type: String, default: 'EGP' },
  returnFeeType: { type: String, default: null }, // 'return' | 'free_store_error' | 'free'
  // صور إثبات (لو Settings.requireEvidenceImages مفعّلة والسبب يستوجبها -
  // شوف utils/returnExchangeFees.js). روابط Cloudinary مرفوعة مسبقًا
  // عن طريق نفس File Upload الموجود بالفعل في المشروع (middleware/upload.js).
  returnEvidenceImages: { type: [String], default: [] },
  // ===== Returns & Exchanges - Phase 2B: تاريخ الحالة (زي ExchangeRequest.statusHistory) =====
  // إضافي وغير مؤثر على أي كود قديم (default: []) - بيتسجل فيه كل تغيير في
  // returnRequestStatus عشان يتعرض في Admin/Customer Request Details.
  returnStatusHistory: [{
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: null },
    _id: false,
  }],

  // ===== معاينة المنتج المرتجع بعد ما يوصل فعليًا (مش وقت الموافقة) =====
  // قبل كده كان المخزون بيرجع تلقائيًا فور موافقة الأدمن على الاسترجاع
  // (قبل ما المنتج يوصل أو حد يعاينه أصلاً) - ده غلط لأن المنتج ممكن يكون
  // تالف/منقوص ومنفعش يترجع للمخزون كأنه سليم. دلوقتي المخزون منرجعوش إلا
  // بعد "معاينة" صريحة من الأدمن (لما المنتج يوصل فعليًا) - شوف
  // inspectReturnRequest في controllers/orderController.js.
  // returnInspectionResult: null لحد ما الاسترجاع يتوافق عليه، بعدين 'pending'
  // (في انتظار المعاينة)، وبعد المعاينة 'good' (كويس - يرجع للمخزون) أو
  // 'bad' (مش كويس/تالف - منرجعوش للمخزون خالص).
  returnInspectionResult: { type: String, enum: ['pending', 'good', 'bad', null], default: null },
  returnInspectedAt: { type: Date, default: null },
  returnInspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  returnInspectionNote: { type: String, default: null },
  // returnStockRestored: بتبقى true بس لو المعاينة كانت 'good' والمخزون
  // اترجع فعليًا. منفصل عن الحقل العام stockRestored (المستخدم لسيناريوهات
  // تانية زي إلغاء/رفض الطلب كله) عشان منخلطش بين الاتنين.
  returnStockRestored: { type: Boolean, default: false },
  returnStockRestoredAt: { type: Date, default: null },

  // ===== Phase 2C: تحويل فلوس الاسترجاع (انستا باي / محفظة) للعميل =====
  // returnRefundAmount: المبلغ اللي هيتحول فعليًا للعميل - القيمة المقترحة
  // تلقائيًا = order.refundedAmount (اللي بيتحسب بالفعل وقت الموافقة، بعد
  // خصم returnFeeCharged)، والأدمن يقدر يعدّلها يدويًا قبل التحويل.
  returnRefundAmount: { type: Number, default: null },
  returnRefundMethod: { type: String, enum: ['instapay', 'wallet', null], default: null },
  returnRefundTransferredAt: { type: Date, default: null },
  returnRefundTransferredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  returnRefundReference: { type: String, default: null },
}, {
  timestamps: true,
  toJSON: { virtuals: false },
  toObject: { virtuals: false },
});

orderSchema.index({ createdAt: -1 });
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentMethod: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });
orderSchema.index({ shippingStatus: 1, createdAt: -1 });
orderSchema.index({ shippingCompany: 1 });
orderSchema.index({ trackingNumber: 1 });
orderSchema.index({ customerEmail: 1 });
orderSchema.index({ customerPhone: 1 });
// ===== إضافة: index مركّب لتحسين أداء getCustomerStats (تحديد "عميل متكرر"
// للطلبات اللي معرّفة بالتليفون/الإيميل بدل customerId - Guest checkout)
// عند حجم بيانات كبير (مليون طلب فأكتر). الـ index المفرد الموجود فوق
// (customerEmail/customerPhone بمفرده) بيفيد في بحث/فلترة بسيطة، لكن
// الاستعلام في getCustomerStats بيبحث بمعيارين مع بعض (نفس القيمة + قبل
// تاريخ معين)، فمحتاج index مركّب زي customerId+createdAt بالظبط عشان
// المطابقة في $lookup تستخدم index حقيقي بدل ما تفحص كل السجلات المطابقة
// للقيمة الأولى وتفلتر التاريخ يدويًا. =====
orderSchema.index({ customerPhone: 1, createdAt: -1 });
orderSchema.index({ customerEmail: 1, createdAt: -1 });
orderSchema.index({ 'items.productId': 1 });

// ============================================================
// ===== إشعار الأدمن بطلب جديد (Web Push) =====
// بنسجل هنا (Model level) مش جوه أي controller لوحده، عشان أي طريقة
// إنشاء أوردر (دفع عند الاستلام / محفظة / كاشير / أي بوابة تانية تتضاف
// لاحقًا) تولّد نفس الإشعار تلقائيًا من غير ما نكرر الكود في كل مكان.
//
// pre('save') بيسجل هل الطلب ده جديد فعلاً ولا مجرد تحديث لطلب موجود
// (isNew بيتصفّر بعد الحفظ، فلازم نلقطه قبل كده).
//
// post('save') بيبعت الإشعار بس لو كان طلب جديد، وعن قصد من غير await
// ولا return للـPromise - عشان لو حصل أي تأخير أو فشل في إرسال
// الإشعارات (مثلاً مشكلة مؤقتة مع خدمة البوش)، ده أبدًا ميأثرش على سرعة
// أو نجاح رد إنشاء الطلب نفسه للعميل. حتى لو جالك 100 طلب في نفس
// اللحظة، كل طلب بيبعت إشعاره المستقل بمجرد ما يتحفظ - مفيش طابور أو
// انتظار لطلب تاني.
// ============================================================
orderSchema.pre('save', function (next) {
  this.$locals.wasNew = this.isNew;
  next();
});

orderSchema.post('save', function (doc) {
  if (!doc.$locals.wasNew) return;
  try {
    const { sendPushToAdmins } = require('../utils/webPush');
    sendPushToAdmins({
      title: '🛒 طلب جديد',
      body: `طلب رقم #${doc.orderNumber || ''} من ${doc.customerName || 'عميل'} - ${doc.totalAmount ? doc.totalAmount + ' ج.م' : ''}`,
      orderId: String(doc._id),
    }).catch((err) => console.error('فشل إرسال إشعار الأدمن بطلب جديد:', err.message));
  } catch (err) {
    console.error('فشل تجهيز إشعار الأدمن بطلب جديد:', err.message);
  }
});

module.exports = mongoose.model('Order', orderSchema);