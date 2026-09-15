const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');
const { uploadImageToCloudinary, deleteImageFromCloudinary, parseCloudinaryPublicId, uploadVideoToCloudinary, deleteVideoFromCloudinary } = require('../utils/uploadToCloudinary');
const { get, set, invalidateProductCaches, CACHE_TTL, CACHE_KEYS } = require('../utils/cache');
const { logActivity } = require('../utils/activityLogger');
const { parsePagination, buildListResponse } = require('../utils/pagination');
const { hasPermission } = require('../utils/permissions');
const { parseSafeJsonLike } = require('../utils/safeJsonLikeParser');
// ===== [Effective Price Filter Fix] محتاجين نجيب إعدادات المتجر (showCountdownBar
// وsaleEndDate) عشان نحسب isSaleActive ونستخدمها في aggregation فلتر السعر تحت.
// require متأخر (jit) مش لازم هنا لأن مفيش circular dependency: settingsController
// مش بيعمل require لـ productController.
const { getOrCreateSettings } = require('./settingsController');

// ===== [P0 Fix #3] هل الطالب أدمن/موظف له صلاحية شوف المنتجات؟ =====
// نفس منطق access('products','view') المستخدم في راوت /admin، لكن كدالة
// عادية عشان نستخدمها جوه getProductById (اللي لازم يفضل عام/بدون تسجيل
// دخول إجباري للزوار العاديين). req.user بييجي من optionalProtect - null
// للزوار، أو المستخدم الحقيقي لو معاه كوكي صحيحة.
const canViewUnpublishedProducts = (user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'staff' && hasPermission(user, 'products', 'view')) return true;
  return false;
};

// دالة صغيرة نقية (مفيش I/O) بترجع فلتر Mongo المناسب لـ GET /api/products/:id
// حسب المستخدم - مُصدَّرة عشان الاختبارات تتأكد من منطق الصلاحيات من غير
// ما تحتاج تشغّل داتابيز حقيقية.
const buildProductByIdFilter = (id, user) => (canViewUnpublishedProducts(user)
  ? { _id: id }
  : { _id: id, visibility: 'published' });

const getProductLabel = (p) => (p && p.name && (p.name.ar || p.name.en)) || '';

const normalizeIncomingImage = (item) => {
  if (!item) return null;
  if (typeof item === 'string') {
    if (/^data:image\//i.test(item)) return null;
    const publicId = parseCloudinaryPublicId(item);
    return { url: item, publicId: publicId || undefined };
  }
  if (typeof item === 'object') {
    const url = typeof item.url === 'string' ? item.url : '';
    if (!url || /^data:image\//i.test(url)) return null;
    const publicId = item.publicId || parseCloudinaryPublicId(url);
    return {
      url,
      publicId: publicId || undefined,
      assetId: item.assetId || undefined,
      width: Number(item.width) || undefined,
      height: Number(item.height) || undefined,
      format: item.format || undefined,
    };
  }
  return null;
};

const normalizeImageArray = (images) => (Array.isArray(images) ? images.map(normalizeIncomingImage).filter(Boolean) : []);

// نفس مبدأ الصور بالظبط: بيرفض أي قيمة base64 (data:video/...) ولا يقبل غير رابط
// Cloudinary حقيقي جاي من مسار الرفع المخصص.
const normalizeIncomingVideo = (item) => {
  if (!item) return null;
  if (typeof item === 'string') {
    if (!item.trim() || /^data:video\//i.test(item)) return null;
    const publicId = parseCloudinaryPublicId(item);
    return { url: item, publicId: publicId || undefined };
  }
  if (typeof item === 'object') {
    const url = typeof item.url === 'string' ? item.url : '';
    if (!url || /^data:video\//i.test(url)) return null;
    const publicId = item.publicId || parseCloudinaryPublicId(url);
    return {
      url,
      publicId: publicId || undefined,
      assetId: item.assetId || undefined,
      width: Number(item.width) || undefined,
      height: Number(item.height) || undefined,
      format: item.format || undefined,
      duration: Number(item.duration) || undefined,
    };
  }
  return null;
};

const containsDataVideo = (value) => {
  if (typeof value === 'string') return /^data:video\//i.test(value);
  if (Array.isArray(value)) return value.some(containsDataVideo);
  if (value && typeof value === 'object') return Object.values(value).some(containsDataVideo);
  return false;
};

const normalizeVariantImageArray = (images) => (Array.isArray(images) ? images.map((img) => {
  if (!img) return null;
  if (typeof img === 'string') {
    if (/^data:image\//i.test(img)) return null;
    return { url: img, publicId: parseCloudinaryPublicId(img) || undefined };
  }
  if (typeof img === 'object' && /^data:image\//i.test(String(img.url || ''))) return null;
  return img;
}).filter(Boolean) : []);

const parseJsonLikeValue = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      return JSON.parse(trimmed);
    } catch (err) {
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const cleaned = trimmed
            .replace(/\s*\+\s*['"]?/g, '')
            .replace(/\r?\n/g, ' ')
            .replace(/([{,]\s*)([A-Za-z0-9_$]+)(\s*:)/g, '$1"$2"$3')
            .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
            .replace(/\s{2,}/g, ' ')
            .trim();

          if (cleaned && cleaned !== trimmed) {
            return JSON.parse(cleaned);
          }

          // [Security Hardening] كان هنا Function(`return (...)`) بيشغّل
          // أي كود JavaScript يبعته العميل (RCE). استبدلناه بـ parser آمن
          // صريح مبيعرفش ينفذ كود - بيبني بس objects/arrays/strings/
          // numbers/booleans/null. أي صيغة مش JSON5-like بترمي error
          // وبترجع القيمة الأصلية زي ما كان بيحصل قبل كده.
          return parseSafeJsonLike(trimmed);
        } catch (innerErr) {
          return value;
        }
      }

      return value;
    }
  }
  return value;
};

const normalizeOfferArray = (offers) => {
  if (!offers) return [];

  const rawList = Array.isArray(offers) ? offers : [offers];
  const normalized = rawList
    .filter(Boolean)
    .map((offer) => {
      if (typeof offer === 'string') {
        const parsed = parseJsonLikeValue(offer);
        if (!parsed || typeof parsed !== 'object') return null;
        return normalizeOfferArray([parsed])[0];
      }

      if (!offer || typeof offer !== 'object') return null;

      return {
        id: offer.id ?? null,
        name: offer.name ?? '',
        type: offer.type ?? 'percentage',
        minQty: Number(offer.minQty ?? 1) || 1,
        discountPercent: Number(offer.discountPercent ?? offer.percentage ?? 0) || 0,
        percentage: Number(offer.percentage ?? offer.discountPercent ?? 0) || 0,
        fixedAmount: Number(offer.fixedAmount ?? 0) || 0,
        buyQty: Number(offer.buyQty ?? 0) || 0,
        freeQty: Number(offer.freeQty ?? 0) || 0,
        active: offer.active !== false,
      };
    })
    .filter(Boolean);

  return normalized;
};

const normalizeBodyPayload = (reqBody) => {
  if (!reqBody) return {};

  if (typeof reqBody === 'string') {
    const parsed = parseJsonLikeValue(reqBody);
    return parsed && typeof parsed === 'object' ? parsed : {};
  }

  if (typeof reqBody === 'object') {
    const hasWrappedData = Object.prototype.hasOwnProperty.call(reqBody, 'data');
    if (hasWrappedData) {
      const parsed = parseJsonLikeValue(reqBody.data);
      if (parsed && typeof parsed === 'object') {
        const merged = { ...parsed, ...reqBody };
        delete merged.data;
        return merged;
      }
    }

    const normalized = { ...reqBody };
    ['images', 'variants', 'offers', 'bundle', 'recommendedIds', 'colors', 'sizes'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(normalized, key) && typeof normalized[key] === 'string') {
        const candidate = normalized[key].trim();
        if (candidate.startsWith('{') || candidate.startsWith('[')) {
          const parsed = parseJsonLikeValue(normalized[key]);
          if (parsed !== normalized[key]) {
            normalized[key] = parsed;
          }
        }
      }
    });

    return normalized;
  }

  return reqBody;
};

// ============================================================
// Canonical sizeStock format: Array of { size, sku, stock }
//   [{ size: "S", sku: "...", stock: 10 }, ...]
//
// Legacy data may be stored as Object: { "S": { sku, stock } }
// We safely convert Object → Array. Valid Arrays are preserved.
// Never convert valid data to [].
// ============================================================
const normalizeSizeStock = (sizeStock) => {
  if (Array.isArray(sizeStock)) {
    return sizeStock
      .map((s) => ({
        size: s && s.size != null ? String(s.size) : null,
        sku: s && s.sku != null ? String(s.sku) : '',
        stock: Math.max(0, Number(s && s.stock) || 0),
      }))
      .filter((s) => s.size);
  }
  if (sizeStock && typeof sizeStock === 'object') {
    // Legacy Object format: { "S": { sku, stock } }
    return Object.entries(sizeStock)
      .map(([size, entry]) => ({
        size: String(size),
        sku: entry && entry.sku != null ? String(entry.sku) : '',
        stock: Math.max(0, Number(entry && entry.stock) || 0),
      }))
      .filter((s) => s.size);
  }
  return [];
};

const normalizeVariantsArray = (variants) => (Array.isArray(variants) ? variants.map((v) => ({
  ...v,
  images: normalizeVariantImageArray(v.images),
  sizeStock: normalizeSizeStock(v.sizeStock),
})) : []);

const normalizeObjectIdValue = (value) => {
  if (value === undefined || value === null) return value;
  if (typeof value === 'string') return value;
  if (typeof value.toString === 'function') return value.toString();
  return value;
};

const normalizeProductResponse = (product) => {
  if (!product) return product;
  const normalized = { ...product, id: product.id || normalizeObjectIdValue(product._id) };
  if (Array.isArray(normalized.images)) {
    normalized.images = normalized.images.map((img) => {
      if (!img) return null;
      if (typeof img === 'string') return img;
      return img.url || null;
    }).filter(Boolean);
  }
  if (Array.isArray(normalized.variants)) {
    normalized.variants = normalized.variants.map((variant) => ({
      ...variant,
      // Canonical variant id: prefer custom `id`, fall back to Mongo `_id`
      id: variant.id || normalizeObjectIdValue(variant._id),
      images: Array.isArray(variant.images)
        ? variant.images.map((img) => (typeof img === 'string' ? img : img?.url)).filter(Boolean)
        : [],
      sizeStock: normalizeSizeStock(variant.sizeStock),
    }));
  }
  if (Array.isArray(normalized.recommendedIds)) {
    normalized.recommendedIds = normalized.recommendedIds.map(normalizeObjectIdValue);
  }
  if (normalized.bundle && Array.isArray(normalized.bundle.productIds)) {
    normalized.bundle.productIds = normalized.bundle.productIds.map(normalizeObjectIdValue);
  }
  return normalized;
};

const normalizeProductArrayResponse = (products) => Array.isArray(products) ? products.map(normalizeProductResponse) : [];

// ============================================================
// ===== [P0 Fix #2] تصفية استجابة المنتج العامة (Public API) =====
// المشكلة: normalizeProductResponse بتعمل "...product" (spread) لكل حقول
// الموديل زي ما هي، يعني أي endpoint عام (بدون تسجيل دخول) بيرجّع
// costPrice (سعر التكلفة/التوريد الداخلي) وlowStockThreshold (حد تنبيه
// المخزون الداخلي) وأرقام المخزون بالتفصيل لكل مقاس (variants.sizeStock[].stock
// وsku) - ده كله بيانات إدارية/تسعير داخلية متسربة لأي زائر أو منافس.
//
// الحل: whitelist صريح (مش blacklist) لحقول آمنة بس تتحط في استجابة أي
// عميل/زائر (قائمة المنتجات، تفاصيل المنتج، البحث، isFeatured/onSale،
// أي فلتر تاني بيمر بنفس الدالتين). أرقام المخزون التفصيلية بتتحول لتمثيل
// عام حسب قاعدة الـ5 قطع (شوف toPublicStockValue تحت) بدل الرقم الحقيقي -
// الفرونت العام بيقارن الرقم العام ده بالـthreshold عشان يقرر يعرض رسالة
// "باقي كذا قطع" أو لأ (مش بيعرض الرقم الحقيقي للمخزون الكبير للعميل).
// endpoints الأدمن (getAllProductsAdmin, createProduct, updateProduct)
// لسه بتستخدم normalizeProductResponse زي ما هي بكل الحقول.
// ============================================================
// ============================================================
// ===== [Stock/Inventory Fix] قاعدة عرض المخزون العامة (Public API) =====
// المشكلة الحقيقية اللي كانت موجودة هنا: toPublicVariant كانت بتحوّل رقم
// المخزون الحقيقي (26, 15, 30...) إلى مؤشر boolean بسيط (0 لو خلص، وإلا 1)
// دايمًا - بغض النظر عن الكمية الفعلية. ده كان بيكسر قاعدة العمل المطلوبة
// (اظهار الرقم الحقيقي للعميل لو <=5، وعدم اظهار أي رقم/رسالة لو >5) وكمان
// كان بيفسد فحص المخزون في الفرونت قبل الـcheckout (اللي بيقارن الكمية
// المطلوبة في السلة بـ getVariantStock() القادمة من نفس الـpublic API) -
// فكان أي عميل حابب يشتري أكتر من قطعة واحدة من منتج مخزونه الحقيقي كبير
// (زي 26) بيتفاجئ برسالة "الكمية المطلوبة غير متوفرة" وقت الـcheckout رغم
// إن المنتج متاح فعليًا وبكمية كبيرة - المخزون الحقيقي في MongoDB (اللي
// بيستخدمه POST /api/orders و decrementStockAtomic) كان سليم طول الوقت،
// المشكلة كانت بس في التمثيل العام (public representation) اللي بيوصل
// للفرونت.
//
// الحل: ثابت واحد (PUBLIC_STOCK_REVEAL_THRESHOLD = 5) بيحدد قاعدة العرض
// دي بشكل صريح ومستقل تمامًا عن أي حاجة تانية (زي lowStockThreshold
// القابل للتعديل من الأدمن لكل منتج - ده feature منفصل تمامًا خاص بشارة
// "مخزون منخفض" في لوحة التحكم ومتجر الواجهة، ومش له علاقة بقاعدة "هل
// نكشف الرقم الحقيقي وللا لأ" المطلوبة هنا):
//   - المخزون الحقيقي <= 0   → 0  (العميل يشوف "غير متوفر")
//   - المخزون الحقيقي 1..5   → نفس الرقم الحقيقي بالظبط
//   - المخزون الحقيقي > 5    → 6  (رقم ثابت أكبر من الحد، عشان أي منطق
//     فرونت بيقارن بالـthreshold (اللي افتراضيًا = 5 برضه في الإعدادات)
//     يعتبره "متوفر بكفاية" ومايعرضش أي رسالة عن الكمية - من غير ما يسرّب
//     الرقم الحقيقي 26/15/30 في استجابة الـAPI. اخترنا 6 (مش 0/1) عشان
//     برضه العميل يقدر يضيف للسلة أكتر من قطعة واحدة براحة قبل ما يوصل
//     لأي حد اصطناعي - المصدر الحقيقي اللي بيمنع الـoverselling فعليًا هو
//     الخصم الـatomic وقت إنشاء الـorder (utils/inventory.js) مش هنا.
// ============================================================
const PUBLIC_STOCK_REVEAL_THRESHOLD = 5;
const toPublicStockValue = (realStock) => {
  const n = Math.max(0, Number(realStock) || 0);
  if (n <= 0) return 0;
  if (n <= PUBLIC_STOCK_REVEAL_THRESHOLD) return n;
  return PUBLIC_STOCK_REVEAL_THRESHOLD + 1;
};

const toPublicVariant = (variant) => ({
  id: variant.id,
  color: variant.color,
  hex: variant.hex,
  images: variant.images,
  // رقم مخزون "عام" مبني على قاعدة الـ5 قطع (شوف toPublicStockValue فوق) -
  // مش الرقم الحقيقي، ومش مؤشر 0/1 بسيط زي ما كان قبل الإصلاح.
  sizeStock: Array.isArray(variant.sizeStock)
    ? variant.sizeStock.map((s) => ({ size: s.size, stock: toPublicStockValue(s.stock) }))
    : [],
});

const toPublicProduct = (product) => {
  const normalized = normalizeProductResponse(product);
  if (!normalized) return normalized;
  return {
    id: normalized.id,
    name: normalized.name,
    description: normalized.description,
    price: normalized.price,
    onSale: normalized.onSale,
    salePrice: normalized.salePrice,
    permanentSalePrice: normalized.permanentSalePrice,
    isFeatured: normalized.isFeatured,
    images: normalized.images,
    video: normalized.video,
    sizes: normalized.sizes,
    colors: normalized.colors,
    variants: Array.isArray(normalized.variants) ? normalized.variants.map(toPublicVariant) : [],
    category: normalized.category,
    slug: normalized.slug,
    metaTitle: normalized.metaTitle,
    metaDescription: normalized.metaDescription,
    metaKeywords: normalized.metaKeywords,
    recommendedIds: normalized.recommendedIds,
    bundle: normalized.bundle,
    offers: normalized.offers,
    enableRecommendations: normalized.enableRecommendations,
    enableBundle: normalized.enableBundle,
    enableReviews: normalized.enableReviews,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    // ملحوظة: costPrice وlowStockThreshold وsizeStock[].sku وأي حقل إداري
    // تاني متضافش هنا عمدًا - العميل/الزائر مايشوفهاش خالص.
  };
};

const toPublicProductArray = (products) => Array.isArray(products) ? products.map(toPublicProduct) : [];

const findRemovedImages = (existing = [], incoming = []) => {
  const incomingUrls = new Set((incoming || []).map(img => img.url));
  return (existing || []).filter(img => img.url && !incomingUrls.has(img.url));
};

const getVariantKey = (variant) => variant.id || variant._id?.toString();

const findRemovedVariantImages = (existingVariants = [], incomingVariants = []) => {
  const incomingByKey = new Map((incomingVariants || []).map(v => [getVariantKey(v), v]));
  return (existingVariants || []).flatMap((existingVariant, index) => {
    const key = getVariantKey(existingVariant) || String(index);
    const incomingVariant = incomingByKey.get(key) || incomingVariants[index] || { images: [] };
    const incomingUrls = new Set((incomingVariant.images || []).map(img => img.url));
    return (existingVariant.images || []).filter(img => img.url && !incomingUrls.has(img.url));
  });
};

// ===== [Effective Price Filter Fix] بيقرأ minPrice/maxPrice من الـ query
// ويرجعهم كأرقام (أو null لو مش موجودين/غير صالحين) - نفس المنطق اللي كان
// جوه buildProductFilter بالظبط، لكن مستخرج في دالة منفصلة عشان نقدر
// نستخدمه في مرحلة الـ $match بتاعة effectivePrice في الـ aggregation
// (شوف buildEffectivePriceMatch تحت) من غير ما نكرر نفس الكود.
const parsePriceRangeFromQuery = (query = {}) => {
  const minPrice = query.minPrice !== undefined && query.minPrice !== '' ? Number(query.minPrice) : null;
  const maxPrice = query.maxPrice !== undefined && query.maxPrice !== '' ? Number(query.maxPrice) : null;
  return {
    minPrice: minPrice !== null && !Number.isNaN(minPrice) ? minPrice : null,
    maxPrice: maxPrice !== null && !Number.isNaN(maxPrice) ? maxPrice : null,
  };
};

// يبني فلتر Mongo من query params الاختيارية (بحث/تصنيف/حالة العرض...)
// كل الفلترة server-side — الفرونت مش محتاج يحمّل كل المنتجات ويبحث في المتصفح.
// ===== [Effective Price Filter Fix] =====
// options.excludePriceFilter: لو true، فلتر minPrice/maxPrice ماينضافش هنا
// على حقل price الخام خالص - بيتفلتر بعدين في مرحلة $match منفصلة في
// الـ aggregation على effectivePrice (شوف runProductAggregation تحت).
// من غير الخيار ده (الافتراضي false) السلوك القديم فاضل زي ما هو تمامًا.
const buildProductFilter = (query = {}, baseFilter = {}, options = {}) => {
  const { excludePriceFilter = false } = options;
  const filter = { ...baseFilter };

  if (query.category) {
    filter.$or = [{ 'category.ar': query.category }, { 'category.en': query.category }];
  }

  if (query.onSale === 'true') filter.onSale = true;
  if (query.isFeatured === 'true') filter.isFeatured = true;

  // ===== فلتر نطاق السعر (بيقارن على السعر الأصلي price، مش سعر العرض) =====
  if (!excludePriceFilter) {
    const { minPrice, maxPrice } = parsePriceRangeFromQuery(query);
    if (minPrice !== null || maxPrice !== null) {
      filter.price = {};
      if (minPrice !== null) filter.price.$gte = minPrice;
      if (maxPrice !== null) filter.price.$lte = maxPrice;
    }
  }

  // ===== فلتر المقاسات (sizes=S,M,L) =====
  if (query.sizes) {
    const sizesList = String(query.sizes).split(',').map(s => s.trim()).filter(Boolean);
    if (sizesList.length > 0) filter.sizes = { $in: sizesList };
  }

  // ===== فلتر اللون (اللون الواحد المختار في صفحة المتجر) =====
  if (query.color) {
    filter.colors = query.color;
  }

  if (query.search) {
    const term = String(query.search).trim();
    if (term) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchOr = [{ 'name.ar': regex }, { 'name.en': regex }, { slug: regex }];
      // لو كان فيه فلتر category قبل كده (بيستخدم $or)، لازم ندمجهم بـ $and
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }
  }

  return filter;
};

// ===== [Effective Price Filter Fix] =====
// options.useEffectivePrice: لو true وsortBy=price، الترتيب بيبقى على
// effectivePrice (الحقل المحسوب في الـ aggregation) بدل price الخام - عشان
// لو المنتج عليه خصم كبير يترتب صح مع باقي المنتجات حسب السعر الفعلي.
const buildProductSort = (query = {}, options = {}) => {
  const { useEffectivePrice = false } = options;
  const allowedSortFields = ['createdAt', 'price', 'name.ar'];
  const sortField = allowedSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
  const sortDir = query.sortDir === 'asc' ? 1 : -1;
  const resolvedField = (useEffectivePrice && sortField === 'price') ? 'effectivePrice' : sortField;
  return { [resolvedField]: sortDir };
};

// ============================================================
// ===== [Effective Price Filter Fix] =====
// المشكلة: minPrice/maxPrice كانوا بيتفلتروا على `price` الخام في الداتابيز
// مباشرة، فمنتج عليه خصم (سعره الفعلي بعد الخصم واقع جوه النطاق المطلوب)
// كان بيتستبعد ظلمًا لو `price` الأصلي (قبل الخصم) برا النطاق - والعكس:
// منتج مش عليه خصم فعلي دلوقتي (العداد العام خلص مثلاً) كان ممكن يظهر غلط
// لو الفلتر افترض إن السعر الفعلي هو salePrice. الحل: نحسب effectivePrice
// جوه الداتابيز نفسها (aggregation) بنفس منطق getEffectivePrice في الفرونت
// (App.jsx) بالظبط، ونفلتر/نرتب عليه هو - مش على price الخام.
// ============================================================

// بيحسب isSaleActive (boolean) من مستند الإعدادات العام - نفس isSaleActive()
// في App.jsx بالظبط: لازم showCountdownBar شغال وsaleEndDate موجود وفي
// المستقبل. القيمة دي بتتحسب مرة واحدة في الكود (مش جوه الـaggregation)
// وتتبعت كـ constant جاهز للمقارنة في $addFields تحت.
const getIsSaleActive = (settings) => !!(
  settings
  && settings.showCountdownBar
  && settings.saleEndDate
  && new Date(settings.saleEndDate).getTime() > Date.now()
);

// بيبني تعبير Mongo aggregation ($switch) اللي بيحسب effectivePrice لكل
// منتج - نفس الترتيب والشروط بالظبط اللي في getEffectivePrice (App.jsx):
//   1) لو العداد شغال (isSaleActive) والمنتج onSale وعنده salePrice > 0 → salePrice
//   2) وإلا لو عنده permanentSalePrice > 0 → permanentSalePrice
//   3) وإلا → price الأصلي (أو 0 لو مش موجود، احتياطًا فقط)
// isSaleActive بييجي جاهز (boolean literal) من getIsSaleActive فوق، مش
// بيتحسب هنا - عشان مايتحسبش تاريخ/وقت لكل مستند لوحده.
const buildEffectivePriceExpr = (isSaleActive) => ({
  $switch: {
    branches: [
      {
        case: {
          $and: [
            isSaleActive === true,
            { $eq: ['$onSale', true] },
            { $gt: [{ $ifNull: ['$salePrice', 0] }, 0] },
          ],
        },
        then: '$salePrice',
      },
      {
        case: { $gt: [{ $ifNull: ['$permanentSalePrice', 0] }, 0] },
        then: '$permanentSalePrice',
      },
    ],
    default: { $ifNull: ['$price', 0] },
  },
});

// بيبني مرحلة $match على effectivePrice (بعد ما يتحسب بـ $addFields) - نفس
// منطق minPrice/maxPrice القديم لكن على effectivePrice مش price الخام.
// بيرجع null لو مفيش minPrice/maxPrice خالص (يعني منضيفش $match فاضية).
const buildEffectivePriceMatch = ({ minPrice, maxPrice }) => {
  if (minPrice === null && maxPrice === null) return null;
  const range = {};
  if (minPrice !== null) range.$gte = minPrice;
  if (maxPrice !== null) range.$lte = maxPrice;
  return { effectivePrice: range };
};

// ===== [Effective Price Filter Fix] المسار الموحّد للفلترة/الترتيب/الـpagination =====
// بيستخدم Product.aggregate بدل Product.find(filter).sort(sort).skip().limit()
// عشان يقدر يحسب effectivePrice جوه الداتابيز نفسها ويفلتر/يرتب عليه، مع
// فضل باقي الفلاتر (category, search, onSale, isFeatured, sizes, color,
// visibility...) زي ما هي بالظبط في $match الأول. بيرجع lean plain objects
// (زي .lean()) عشان toPublicProduct/normalizeProductResponse يشتغلوا صح -
// نفس الحاجة اللي كانت بترجع من .lean() قبل كده.
const runFilteredProductAggregation = async ({ query, baseFilter, skip, limit }) => {
  const matchFilter = buildProductFilter(query, baseFilter, { excludePriceFilter: true });
  const { minPrice, maxPrice } = parsePriceRangeFromQuery(query);

  const settings = await getOrCreateSettings();
  const isSaleActive = getIsSaleActive(settings);

  const sort = buildProductSort(query, { useEffectivePrice: true });

  const pipeline = [
    { $match: matchFilter },
    { $addFields: { effectivePrice: buildEffectivePriceExpr(isSaleActive) } },
  ];

  const priceMatch = buildEffectivePriceMatch({ minPrice, maxPrice });
  if (priceMatch) pipeline.push({ $match: priceMatch });

  pipeline.push({
    $facet: {
      items: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
      totalCount: [{ $count: 'count' }],
    },
  });

  const [result] = await Product.aggregate(pipeline);
  const items = (result && result.items) || [];
  const total = (result && result.totalCount && result.totalCount[0] && result.totalCount[0].count) || 0;
  return { items, total };
};

// GET /api/products  (عام - لكل الزوار) - مع caching + pagination/filtering اختيارية
const getProducts = async (req, res) => {
  try {
    const { isPaginated, page, limit, skip } = parsePagination(req.query, { maxLimit: 100, defaultLimit: 24 });
    const hasFilters = !!(req.query.category || req.query.search || req.query.onSale || req.query.isFeatured || req.query.sortBy || req.query.minPrice || req.query.maxPrice || req.query.sizes || req.query.color);

    // المسار السريع (بدون فلاتر/pagination صريحة): نستخدم كاش القائمة الكاملة زي ما كان
    if (!isPaginated && !hasFilters) {
      const cached = get(CACHE_KEYS.PRODUCTS);
      if (cached) {
        return res.json(cached);
      }

      const products = await Product.find({ visibility: 'published' })
        .sort({ createdAt: -1 })
        .limit(500) // سقف أمان حتى في المسار القديم
        .lean();

      const publicProducts = toPublicProductArray(products);
      set(CACHE_KEYS.PRODUCTS, publicProducts, CACHE_TTL.PRODUCTS);
      return res.json(publicProducts);
    }

    // مسار الفلترة/الـ pagination الحقيقية (server-side بالكامل)
    // ===== [Effective Price Filter Fix] بدل Product.find + countDocuments،
    // بنستخدم aggregation عشان minPrice/maxPrice (وترتيب sortBy=price) يبقوا
    // على effectivePrice (بعد الخصم) مش على price الخام - شوف
    // runFilteredProductAggregation فوق.
    const { items: products, total } = await runFilteredProductAggregation({
      query: req.query,
      baseFilter: { visibility: 'published' },
      skip,
      limit,
    });

    const publicProducts = toPublicProductArray(products);
    res.json(buildListResponse({ isPaginated: true, page, limit, items: publicProducts, total }));
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب المنتجات'});
  }
};

// GET /api/products/admin  (كل المنتجات حتى المخفية - أدمن بس) - مع caching + pagination/filtering اختيارية
const getAllProductsAdmin = async (req, res) => {
  try {
    const { isPaginated, page, limit, skip } = parsePagination(req.query, { maxLimit: 100, defaultLimit: 24 });
    // ===== [Effective Price Filter Fix] minPrice/maxPrice ناقصين من الشرط ده
    // أصلاً (باگ قديم قبل أي تعديل تاني هنا) - لو الأدمن بعت minPrice/maxPrice
    // بس من غير أي فلتر تاني ومن غير page/limit، كان بيدخل المسار السريع
    // (الكاش) واللي مابيطبقش فلتر السعر خالص. ضفناهم هنا عشان أي طلب فيه
    // minPrice/maxPrice يدخل مسار الفلترة الحقيقي (aggregation) زي أي فلتر تاني.
    const hasFilters = !!(req.query.category || req.query.search || req.query.visibility || req.query.sortBy || req.query.minPrice || req.query.maxPrice);

    if (!isPaginated && !hasFilters) {
      const cached = get(CACHE_KEYS.PRODUCT_ADMIN);
      if (cached) {
        return res.json(cached);
      }

      const products = await Product.find()
        .sort({ createdAt: -1 })
        .lean();

      const normalizedProducts = normalizeProductArrayResponse(products);
      set(CACHE_KEYS.PRODUCT_ADMIN, normalizedProducts, CACHE_TTL.PRODUCTS);
      return res.json(normalizedProducts);
    }

    const baseFilter = req.query.visibility ? { visibility: req.query.visibility } : {};
    // ===== [Effective Price Filter Fix] نفس التحسين المطبّق في getProducts
    // العامة - minPrice/maxPrice وsortBy=price بيبقوا على effectivePrice.
    const { items: products, total } = await runFilteredProductAggregation({
      query: req.query,
      baseFilter,
      skip,
      limit,
    });

    const normalizedProducts = normalizeProductArrayResponse(products);
    res.json(buildListResponse({ isPaginated: true, page, limit, items: normalizedProducts, total }));
  } catch (err) {
    console.error('Error fetching admin products:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب المنتجات'});
  }
};

// GET /api/products/:id  (عام - لكل الزوار، لكن مقصور على المنتجات المنشورة فقط)
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const isPrivilegedViewer = canViewUnpublishedProducts(req.user);

    // ===== [P0 Fix #3] الكاش هنا بيخزن نسخة الزوار العاديين بس (منتجات
    // منشورة). لو الطالب أدمن/موظف بنعدّي على الكاش ونجيب من الداتابيز
    // مباشرة عشان يقدر يشوف منتج مخفي/مسودة (وده مش موقف شائع بيتكرر كل
    // شوية زي الزوار، فمفيش أي تأثير أداء حقيقي).
    if (!isPrivilegedViewer) {
      const cacheKey = CACHE_KEYS.PRODUCT_DETAIL(id);
      const cached = get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // طلب مباشر بمعرف منتج مخفي/مسودة/أدمن-فقط لازم يترفض هنا بالظبط
      // زي أي منتج مش موجود - مفيش أي فرق في الاستجابة يفضح إن المنتج موجود
      // لكنه مخفي عن اللي مش أدمن/موظف.
      const product = await Product.findOne(buildProductByIdFilter(id, req.user)).lean();
      if (!product) {
        return res.status(404).json({ message: 'المنتج مش موجود' });
      }

      const publicProduct = toPublicProduct(product);
      set(cacheKey, publicProduct, CACHE_TTL.PRODUCT_DETAIL);
      return res.json(publicProduct);
    }

    // أدمن/موظف عنده صلاحية شوف المنتجات: يقدر يشوف أي منتج بأي حالة ظهور
    // (نفس buildProductByIdFilter بترجع { _id: id } بس هنا، من غير قيد visibility).
    const product = await Product.findOne(buildProductByIdFilter(id, req.user)).lean();
    if (!product) {
      return res.status(404).json({ message: 'المنتج مش موجود' });
    }

    res.json(toPublicProduct(product));
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب المنتج'});
  }
};


const containsDataImage = (value) => {
  if (typeof value === 'string') return /^data:image\//i.test(value);
  if (Array.isArray(value)) return value.some(containsDataImage);
  if (value && typeof value === 'object') return Object.values(value).some(containsDataImage);
  return false;
};

const uploadProductFiles = async (files, folder = 'products') => {
  const uploaded = [];
  try {
    for (const file of files || []) {
      uploaded.push(await uploadImageToCloudinary(
        file.buffer,
        file.safeOriginalName || file.originalname,
        file.detectedMime || file.mimetype,
        { folder },
      ));
    }
    return uploaded;
  } catch (err) {
    // Best-effort rollback of assets uploaded earlier in this request.
    await Promise.allSettled(uploaded.map((image) => deleteImageFromCloudinary(image)));
    throw err;
  }
};

const safeUploadErrorResponse = (res, err, fallbackMessage) => {
  if (err?.code === 'CLOUDINARY_UPLOAD_FAILED') {
    return res.status(err.statusCode || 502).json({
      message: 'تعذر رفع الصورة إلى التخزين. لم يتم حفظ التغييرات.',
    });
  }
  return res.status(err?.statusCode || 500).json({
    message: fallbackMessage,
  });
};

// POST /api/products  (أدمن بس) - بيانات المنتج + صور (multipart/form-data)
const createProduct = async (req, res) => {
  try {
    const body = normalizeBodyPayload(req.body);
    if (containsDataImage(body) || containsDataVideo(body)) {
      return res.status(400).json({ message: 'الصورة/الفيديو يجب رفعهم عبر مسار الرفع المخصص، وليس داخل بيانات المنتج.' });
    }
    // حماية: لو الطلب فيه _id (زي وقت نسخ منتج من الفرونت)، لازم نتجاهله عشان
    // Mongo يولّد _id جديد بنفسه بدل ما يحاول يستخدم _id بتاع منتج موجود بالفعل
    // (وده كان بيسبب "duplicate key error" ويفشل إنشاء/نسخ المنتج).
    delete body._id;
    delete body.id;
    delete body.__v;
    delete body.createdAt;
    delete body.updatedAt;
    const files = req.files || [];

    const uploadedImages = await uploadProductFiles(files, 'products');

    const options = {
      ...body,
      images: [...normalizeImageArray(body.images), ...uploadedImages],
      video: normalizeIncomingVideo(body.video) || undefined,
      variants: normalizeVariantsArray(body.variants),
      offers: normalizeOfferArray(body.offers),
    };

    if (!Array.isArray(options.offers) && Array.isArray(body.offers)) {
      options.offers = body.offers.map((offer) => normalizeOfferArray([offer])[0]).filter(Boolean);
    }

    const product = await Product.create(options);

    // Invalidate caches
    invalidateProductCaches();

    const normalizedProduct = normalizeProductResponse(product.toObject ? product.toObject() : product);

    logActivity(req, {
      action: 'create',
      entityType: 'product',
      entityId: product._id,
      entityLabel: getProductLabel(normalizedProduct),
    });

    res.status(201).json({ success: true, data: normalizedProduct });
  } catch (err) {
    console.error('Error creating product:', err);
    return safeUploadErrorResponse(res, err, 'حصل خطأ في إضافة المنتج');
  }
};

// PUT /api/products/:id  (أدمن بس)
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'المنتج مش موجود' });
    }

    const body = normalizeBodyPayload(req.body);
    if (containsDataImage(body) || containsDataVideo(body)) {
      return res.status(400).json({ message: 'الصورة/الفيديو يجب رفعهم عبر مسار الرفع المخصص، وليس داخل بيانات المنتج.' });
    }
    const files = req.files || [];

    const uploadedImages = await uploadProductFiles(files, 'products');

    const incomingImages = [...normalizeImageArray(body.images), ...uploadedImages];
    const incomingVariants = normalizeVariantsArray(body.variants);
    const incomingOffers = normalizeOfferArray(body.offers);
    const incomingVideo = body.video !== undefined ? normalizeIncomingVideo(body.video) : (product.video || null);
    const oldVideo = product.video && product.video.url ? product.video : null;
    const videoChanged = (oldVideo?.url || null) !== (incomingVideo?.url || null);

    if (!Array.isArray(incomingOffers) || incomingOffers.length === 0) {
      const parsedOffers = Array.isArray(body.offers) ? body.offers : [];
      const rebuiltOffers = parsedOffers
        .map((offer) => normalizeOfferArray([offer])[0])
        .filter(Boolean);
      if (rebuiltOffers.length > 0) {
        incomingOffers.push(...rebuiltOffers);
      }
    }

    const removedProductImages = findRemovedImages(product.images, incomingImages);
    const removedVariantImages = findRemovedVariantImages(product.variants, incomingVariants);

    const safeBody = { ...body };
    delete safeBody.data;
    delete safeBody.images;
    delete safeBody.video;
    delete safeBody.variants;
    delete safeBody.offers;
    delete safeBody.recommendedIds;
    delete safeBody.bundle;
    // ===== إزالة الحقول المحمية التي تسبب VersionError في Mongoose =====
    // الفرونت بيبعت أحياناً كائن المنتج الكامل (بما فيه _id و __v و createdAt و updatedAt)
    // لو اتحطت __v بقيمة قديمة، Mongoose بيعمل optimistic concurrency check ويفشل الحفظ.
    delete safeBody._id;
    delete safeBody.id;
    delete safeBody.__v;
    delete safeBody.createdAt;
    delete safeBody.updatedAt;

    const finalOffers = body.offers !== undefined
      ? normalizeOfferArray(body.offers)
      : Array.isArray(product.offers)
        ? product.offers
        : [];

    const normalizedOfferPayload = Array.isArray(finalOffers) && finalOffers.length > 0
      ? finalOffers
      : (Array.isArray(incomingOffers) ? incomingOffers : []);


    // ===== معالجة recommendedIds و bundle صراحةً =====
    const incomingRecommendedIds = body.recommendedIds !== undefined
      ? (Array.isArray(body.recommendedIds) ? body.recommendedIds : [])
      : (Array.isArray(product.recommendedIds) ? product.recommendedIds.map(normalizeObjectIdValue) : []);

    const incomingBundle = body.bundle !== undefined
      ? {
          productIds: Array.isArray(body.bundle && body.bundle.productIds) ? body.bundle.productIds : [],
          discountPercent: Number((body.bundle && body.bundle.discountPercent) || 0),
        }
      : {
          productIds: Array.isArray(product.bundle && product.bundle.productIds) ? product.bundle.productIds.map(normalizeObjectIdValue) : [],
          discountPercent: Number((product.bundle && product.bundle.discountPercent) || 0),
        };

    product.images = incomingImages;
    product.video = incomingVideo || undefined;
    product.variants = incomingVariants;
    product.offers = normalizedOfferPayload;
    product.recommendedIds = incomingRecommendedIds;
    product.bundle = incomingBundle;
    product.markModified('images');
    product.markModified('video');
    product.markModified('variants');
    product.markModified('offers');
    product.markModified('recommendedIds');
    product.markModified('bundle');

    Object.keys(safeBody).forEach((key) => {
      if (key === 'offers') return;
      product.set(key, safeBody[key]);
    });
    product.set({
      images: product.images,
      video: product.video,
      variants: product.variants,
      offers: product.offers,
      recommendedIds: product.recommendedIds,
      bundle: product.bundle,
    });

    try {
      await product.save();
    } catch (saveError) {
      await Promise.allSettled(uploadedImages.map((image) => deleteImageFromCloudinary(image)));
      throw saveError;
    }

    // Only remove old assets after MongoDB has successfully committed the new references.
    await Promise.allSettled([
      ...removedProductImages.map((img) => deleteProductImageIfOrphaned(img, req.params.id)),
      ...removedVariantImages.map((img) => deleteProductImageIfOrphaned(img, req.params.id)),
      ...(videoChanged && oldVideo ? [deleteVideoFromCloudinary(oldVideo)] : []),
    ]);

    const reloadedProduct = await Product.findById(req.params.id).lean();

    // Data loss check removed - was causing false positives when offers normalize to empty

    invalidateProductCaches();

    const normalized = normalizeProductResponse(reloadedProduct || (product.toObject ? product.toObject() : product));

    const priceChanged = safeBody.price !== undefined && Number(safeBody.price) !== Number(reloadedProduct?.price);
    logActivity(req, {
      action: 'update',
      entityType: 'product',
      entityId: req.params.id,
      entityLabel: getProductLabel(normalized),
      description: priceChanged
        ? `${req.user?.name || 'أدمن'} غيّر سعر المنتج "${getProductLabel(normalized)}"`
        : undefined,
    });

    res.json(normalized);
  } catch (err) {
    console.error('Error updating product:', err);
    return safeUploadErrorResponse(res, err, 'حصل خطأ في تعديل المنتج');
  }
};


const deleteProductImageIfOrphaned = async (imageRef, currentProductId) => {
  const publicId = imageRef?.publicId || parseCloudinaryPublicId(
    typeof imageRef === 'string' ? imageRef : imageRef?.url,
  );
  if (!publicId) return;

  const referenced = await Product.exists({
    _id: { $ne: currentProductId },
    $or: [
      { 'images.publicId': publicId },
      { 'variants.images.publicId': publicId },
    ],
  });

  if (!referenced) {
    await deleteImageFromCloudinary({ publicId });
  }
};

// DELETE /api/products/:id  (أدمن بس)
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'المنتج مش موجود' });
    }

    const imagesToCleanup = [
      ...(product.images || []),
      ...(product.variants || []).flatMap((v) => v.images || []),
    ];
    const videoToCleanup = product.video && product.video.url ? product.video : null;

    const deletedLabel = getProductLabel(product);
    await product.deleteOne();

    // DB deletion succeeded; now remove assets only if no other product references them.
    await Promise.allSettled([
      ...imagesToCleanup.map((img) => deleteProductImageIfOrphaned(img, req.params.id)),
      ...(videoToCleanup ? [deleteVideoFromCloudinary(videoToCleanup)] : []),
    ]);

    // Invalidate caches
    invalidateProductCaches();

    logActivity(req, {
      action: 'delete',
      entityType: 'product',
      entityId: req.params.id,
      entityLabel: deletedLabel,
    });

    res.json({ success: true, data: { id: req.params.id, deleted: true } });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ message: 'حصل خطأ في حذف المنتج'});
  }
};

// POST /api/products/:id/variants/:variantIndex/images  (أدمن بس)
// بيرفع صور إضافية لفاريانت (لون) معين ويضيفها لصوره الموجودة
const uploadVariantImages = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'المنتج مش موجود' });
    }

    const idx = Number(req.params.variantIndex);
    if (!product.variants[idx]) {
      return res.status(404).json({ message: 'الفاريانت مش موجود' });
    }

    const files = req.files || [];
    const uploadedImages = await uploadProductFiles(files, 'products');
    product.variants[idx].images = [...(product.variants[idx].images || []), ...uploadedImages];

    try {
      await product.save();
    } catch (saveError) {
      await Promise.allSettled(uploadedImages.map((image) => deleteImageFromCloudinary(image)));
      throw saveError;
    }

    // Invalidate caches
    invalidateProductCaches();

    res.json(normalizeProductResponse(product.toObject ? product.toObject() : product));
  } catch (err) {
    console.error('Error uploading variant images:', err);
    return safeUploadErrorResponse(res, err, 'حصل خطأ في رفع صور الفاريانت');
  }
};

// POST /api/products/video  (أدمن بس) — رفع فيديو مستقل (قبل ما المنتج يتحفظ)
// بيرجع بيانات الفيديو على Cloudinary عشان الفرونت يرفقها لما يحفظ المنتج.
// لو الرفع فشل (مشكلة في Cloudinary مثلاً) بيرفض بخطأ واضح ومفيش أي مسار بديل للتخزين.
const uploadProductVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'لم يتم إرسال فيديو' });
    }

    const uploaded = await uploadVideoToCloudinary(
      req.file.buffer,
      req.file.safeOriginalName || req.file.originalname,
      req.file.detectedMime || req.file.mimetype,
      { folder: 'products/video' },
    );

    res.status(201).json({
      success: true,
      data: {
        url: uploaded.secureUrl || uploaded.url,
        publicId: uploaded.publicId,
        width: uploaded.width,
        height: uploaded.height,
        format: uploaded.format,
        duration: uploaded.duration,
      },
    });
  } catch (err) {
    console.error('Product video upload failed:', err);
    if (err?.code === 'CLOUDINARY_UPLOAD_FAILED') {
      return res.status(502).json({ message: 'حصل خطأ في رفع الفيديو. حاول مرة أخرى.' });
    }
    return res.status(err?.statusCode || 500).json({ message: 'حصل خطأ في رفع الفيديو' });
  }
};

// GET /api/products/inventory/movements  (أدمن بس) — سجل حركة المخزون، paginated دائمًا
// فلاتر اختيارية: ?productId=...&reason=stock_sold&page=1&limit=50
const getInventoryMovements = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { maxLimit: 200, defaultLimit: 50 });

    const filter = {};
    if (req.query.productId) filter.product = req.query.productId;
    if (req.query.reason) filter.reason = req.query.reason;
    if (req.query.orderId) filter.order = req.query.orderId;

    const [movements, total] = await Promise.all([
      InventoryMovement.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('product', 'name slug')
        .lean(),
      InventoryMovement.countDocuments(filter),
    ]);

    res.json(buildListResponse({ isPaginated: true, page, limit, items: movements, total }));
  } catch (err) {
    console.error('Error fetching inventory movements:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب سجل حركة المخزون'});
  }
};

module.exports = {
  getProducts, getAllProductsAdmin, getProductById,
  createProduct, updateProduct, deleteProduct,
  uploadVariantImages, uploadProductVideo, getInventoryMovements,
  // ===== [P0 Fix #2] مُصدَّرة للاختبار =====
  toPublicProduct, toPublicProductArray, normalizeProductResponse,
  // ===== [Stock/Inventory Fix] مُصدَّرة للاختبار =====
  toPublicStockValue, toPublicVariant, PUBLIC_STOCK_REVEAL_THRESHOLD,
  // ===== [P0 Fix #3] مُصدَّرة للاختبار =====
  canViewUnpublishedProducts, buildProductByIdFilter,
  // ===== [Effective Price Filter Fix] مُصدَّرة للاختبار =====
  buildProductFilter, buildProductSort, parsePriceRangeFromQuery,
  getIsSaleActive, buildEffectivePriceExpr, buildEffectivePriceMatch,
  runFilteredProductAggregation,
};