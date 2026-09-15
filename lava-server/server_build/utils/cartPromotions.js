// ============================================================================
// utils/cartPromotions.js
// ----------------------------------------------------------------------------
// P0 Fix #4: Promotions/Bundles must be calculated server-side.
//
// قبل الإصلاح: الفرونت (calculateCartPromotions/computePromotionForLine في
// App.jsx) كان بيحسب قيمة الخصم النهائية وبيبعتها كرقم (orderData.discount)،
// والباك اند كان "بيصدّق" الرقم ده مباشرة (مع سقف أقصى 70% كإجراء وقائي
// بسيط - شوف orderController.js القديم). كمان bundleDiscount بتاع كل عنصر
// كان بيتاخد زي ما هو من العميل (مع سقف 0-80% بس، من غير أي تحقق إنه فعلاً
// مطابق لإعدادات الـbundle الحقيقية بتاعة المنتج في قاعدة البيانات).
//
// الإصلاح: نفس بالظبط منطق الفرونت (نفس الأنواع: bxgy / quantity_discount /
// percentage / fixed، ونفس أولوية الاختيار: عرض المنتج نفسه Multi-tier أولاً،
// بعدين حملة مستهدفة نفس المنتج، بعدين القسم، بعدين الكل - من غير أي تراكم)
// بيتعاد حسابه هنا من غير أي ثقة في رقم العميل، باستخدام بيانات المنتجات
// والإعدادات المخزّنة فعليًا في قاعدة البيانات (Product.offers,
// Settings.campaigns, Settings.categories, Product.bundle).
//
// الموديول ده pure functions بالكامل (مفيش أي استدعاء لقاعدة بيانات جواه)
// عشان يبقى قابل للاختبار من غير أي DB حقيقي - نفس أسلوب باقي ملفات
// utils/services التانية في المشروع (shipping/statusMap.js مثلاً).
// ============================================================================

const roundTwo = (value) => Math.round((Number(value) || 0) * 100) / 100;

// ===== هل الحملة شغالة فعليًا دلوقتي (نفس isPromotionCurrentlyActive في الفرونت) =====
const isPromotionCurrentlyActive = (promo) => {
  if (!promo || !promo.active) return false;
  const now = Date.now();
  if (promo.startDate && new Date(promo.startDate).getTime() > now) return false;
  if (promo.endDate && new Date(promo.endDate).getTime() < now) return false;
  return true;
};

// ===== إيجاد الـ id بتاع قسم المنتج بمطابقة الاسم (ar/en) - نفس getProductCategoryId =====
const getProductCategoryId = (product, categories) => {
  if (!product) return null;
  const cats = Array.isArray(categories) ? categories : [];
  const productCategory = product.category || {};
  const cat = cats.find((c) => {
    const cName = c?.name || {};
    return (
      (productCategory.ar && cName.ar && cName.ar === productCategory.ar) ||
      (productCategory.en && cName.en && cName.en === productCategory.en)
    );
  });
  if (!cat) return null;
  return cat.id != null ? String(cat.id) : (cat._id != null ? String(cat._id) : null);
};

// ===== عدد القطع المجانية بشكل حتمي - نفس computeBxGyFreeUnits بالظبط =====
const computeBxGyFreeUnits = (qty, buyQty, freeQty) => {
  const b = Math.max(0, Number(buyQty) || 0);
  const f = Math.max(0, Number(freeQty) || 0);
  const groupSize = b + f;
  if (b <= 0 || f <= 0 || groupSize <= 0 || qty <= 0) return 0;
  const fullGroups = Math.floor(qty / groupSize);
  const remainder = qty % groupSize;
  const freeInRemainder = Math.max(0, remainder - b);
  return fullGroups * f + freeInRemainder;
};

// ===== عتبة الكمية اللي بيبدأ عندها العرض ينطبق - نفس getProductOfferThreshold =====
const getProductOfferThreshold = (offer) => {
  if (!offer) return Infinity;
  return offer.type === 'bxgy' ? Math.max(0, Number(offer.buyQty) || 0) : Math.max(1, Number(offer.minQty) || 1);
};

// ===== كل عروض المنتج المفعّلة مرتبة تصاعديًا حسب العتبة - نفس getActiveProductOffers =====
const getActiveProductOffers = (product) => {
  if (!product || !Array.isArray(product.offers)) return [];
  return product.offers
    .filter((o) => o && o.active)
    .slice()
    .sort((a, b) => getProductOfferThreshold(a) - getProductOfferThreshold(b));
};

// ===== أعلى تير من عروض المنتج المتعددة ينطبق فعليًا على كمية معينة - نفس getBestProductOfferForQty =====
const getBestProductOfferForQty = (product, qty) => {
  const offers = getActiveProductOffers(product);
  if (offers.length === 0) return null;
  const applicable = offers.filter((o) => qty >= getProductOfferThreshold(o));
  if (applicable.length === 0) return null;
  return applicable.reduce(
    (best, o) => (getProductOfferThreshold(o) > getProductOfferThreshold(best) ? o : best),
    applicable[0]
  );
};

// ===== أعلى عرض ينطبق على منتج معيّن حسب نفس أولوية الفرونت بالظبط =====
// 1) عرض خاص بالمنتج نفسه (Multi-tier)
// 2) حملة مستهدفة نفس المنتج بالتحديد
// 3) حملة مستهدفة قسم المنتج
// 4) حملة مستهدفة كل المنتجات
// مفيش تراكم عروض على نفس المنتج أبدًا - العرض الأعلى بيمنع اللي بعده تمامًا.
const resolveActivePromotionForProduct = (product, qty, campaigns, categories) => {
  if (!product) return null;

  const bestOffer = getBestProductOfferForQty(product, qty);
  if (bestOffer) {
    return {
      source: 'productOffer',
      type: bestOffer.type,
      buyQty: bestOffer.buyQty,
      freeQty: bestOffer.freeQty,
      minQty: bestOffer.minQty,
      discountPercent: bestOffer.discountPercent,
      percentage: bestOffer.percentage,
      fixedAmount: bestOffer.fixedAmount,
    };
  }

  const activePromos = (Array.isArray(campaigns) ? campaigns : []).filter(isPromotionCurrentlyActive);
  if (activePromos.length === 0) return null;

  const productId = String(product._id || product.id || '');
  const productTargeted = activePromos.find((p) => p.target === 'product' && String(p.productId) === productId);
  if (productTargeted) return productTargeted;

  const categoryId = getProductCategoryId(product, categories);
  const categoryTargeted = categoryId
    ? activePromos.find((p) => p.target === 'category' && String(p.categoryId) === String(categoryId))
    : null;
  if (categoryTargeted) return categoryTargeted;

  const allTargeted = activePromos.find((p) => p.target === 'all');
  if (allTargeted) return allTargeted;

  return null;
};

// ===== تطبيق عرض معيّن على مجموعة وحدات من نفس المنتج - نفس computePromotionForLine =====
// lineItems: [{ price, unitIndex }] وحدة واحدة لكل قطعة فعلية (مش سطر مجمّع بالكمية)
const computePromotionForLine = (promo, lineItems) => {
  if (!promo || !lineItems || lineItems.length === 0) {
    return { discountAmount: 0, freeUnitIndexes: [] };
  }
  const qty = lineItems.length;

  if (promo.type === 'bxgy') {
    const freeCount = Math.min(computeBxGyFreeUnits(qty, promo.buyQty, promo.freeQty), qty);
    if (freeCount <= 0) return { discountAmount: 0, freeUnitIndexes: [] };
    // أرخص القطع هي اللي بتبقى مجانية (نفس منطق الفرونت)
    const sorted = [...lineItems].sort((a, b) => a.price - b.price);
    const freeItems = sorted.slice(0, freeCount);
    const discountAmount = freeItems.reduce((s, it) => s + it.price, 0);
    return { discountAmount: roundTwo(discountAmount), freeUnitIndexes: freeItems.map((it) => it.unitIndex) };
  }

  if (promo.type === 'quantity_discount') {
    if (qty < Math.max(1, Number(promo.minQty) || 0)) return { discountAmount: 0, freeUnitIndexes: [] };
    const lineSubtotal = lineItems.reduce((s, it) => s + it.price, 0);
    const discountAmount = lineSubtotal * (Math.max(0, Number(promo.discountPercent) || 0) / 100);
    return { discountAmount: roundTwo(discountAmount), freeUnitIndexes: [] };
  }

  if (promo.type === 'percentage') {
    const pct = Number(promo.percentage) || Number(promo.discountPercent) || 0;
    const lineSubtotal = lineItems.reduce((s, it) => s + it.price, 0);
    const discountAmount = lineSubtotal * (Math.max(0, pct) / 100);
    return { discountAmount: roundTwo(discountAmount), freeUnitIndexes: [] };
  }

  if (promo.type === 'fixed') {
    const lineSubtotal = lineItems.reduce((s, it) => s + it.price, 0);
    const discountAmount = Math.min(Math.max(0, Number(promo.fixedAmount) || 0), lineSubtotal);
    return { discountAmount: roundTwo(discountAmount), freeUnitIndexes: [] };
  }

  return { discountAmount: 0, freeUnitIndexes: [] };
};

// ============================================================================
// نقطة الدخول الرئيسية: حساب خصم العروض الترويجية بالكامل من بيانات السيرفر
// ============================================================================
// units: [{ productId, price }] وحدة واحدة (قطعة فعلية) لكل عنصر في السلة -
//        (سطر بالكمية N لازم يتحوّل لـ N وحدات قبل ما توصل هنا، نفس ما
//        السلة نفسها في الفرونت بتحتفظ بسطر منفصل لكل قطعة فعلية)
// productsById: Map<string, ProductDoc> منتجات موجودة فعليًا في الداتابيز
// campaigns: settings.campaigns (Array)
// categories: settings.categories (Array)
const calculateCartPromotions = ({ units, productsById, campaigns, categories }) => {
  const byProduct = new Map();
  (units || []).forEach((u, idx) => {
    const key = String(u.productId);
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key).push({ price: roundTwo(u.price), unitIndex: idx });
  });

  let totalDiscount = 0;
  const appliedLines = [];

  byProduct.forEach((lineItems, pid) => {
    const product = productsById.get(pid);
    if (!product) return;
    const promo = resolveActivePromotionForProduct(product, lineItems.length, campaigns, categories);
    if (!promo) return;
    const result = computePromotionForLine(promo, lineItems);
    if (result.discountAmount > 0) {
      totalDiscount += result.discountAmount;
      appliedLines.push({ productId: pid, discountAmount: result.discountAmount, type: promo.type });
    }
  });

  return { totalDiscount: roundTwo(totalDiscount), appliedLines };
};

// ============================================================================
// التحقق من صحة عناصر الـ Bundle (باقة المنتجات) - نفس منطق addBundleToCart
// في الفرونت: الخصم = product.bundle.discountPercent بتاع "المنتج الأساسي"،
// وبينطبق فقط على المنتج الأساسي نفسه + أي منتج من ضمن bundle.productIds
// بتاعته. العميل بيبعت فلاج isBundleItem + bundleDiscount لكل عنصر، لكن ده
// مجرد "ادّعاء" - إحنا مش بنصدّقه إلا لو فعلاً في المنتجات المرسلة عنصر
// "أساسي" حقيقي (enableBundle=true, bundle.discountPercent>0) بيطابق نفس
// النسبة المُدّعاة، وكل عنصر تاني مُدّعى إنه جزء من الباقة ده فعلاً productId
// بتاعه موجود ضمن bundle.productIds لنفس المنتج الأساسي ده (أو هو نفسه).
// أي ادّعاء مايتحققش من الشرطين ده بيترفض تمامًا (isBundleItem=false,
// bundleDiscount=0) وبيرجع السعر العادي (effectivePrice) بدل ما يتصدّق.
// ============================================================================
// rawItems: [{ productId, product, isBundleItemClaim, bundleDiscountClaim }]
// بيرجع array بنفس الترتيب: [{ isBundleItem, bundleDiscount }]
const validateBundleItems = (rawItems) => {
  const items = Array.isArray(rawItems) ? rawItems : [];

  // كل عنصر ممكن يكون "منتج أساسي" حقيقي لباقة لو: ادّعى إنه bundle item،
  // ومنتجه فعليًا عنده enableBundle + bundle.discountPercent > 0، والنسبة
  // اللي ادّعاها مطابقة تمامًا للنسبة المُعدّة فعليًا في قاعدة البيانات.
  const mainCandidates = items.filter((it) => {
    if (!it.isBundleItemClaim) return false;
    const product = it.product;
    if (!product || product.enableBundle === false) return false;
    const bundle = product.bundle;
    const discountPercent = Number(bundle && bundle.discountPercent);
    if (!bundle || !Number.isFinite(discountPercent) || discountPercent <= 0) return false;
    return Number(it.bundleDiscountClaim) === discountPercent;
  });

  return items.map((it) => {
    for (const main of mainCandidates) {
      const bundle = main.product.bundle;
      const discountPercent = Number(bundle.discountPercent);
      const allowedIds = new Set([
        String(main.product._id || main.productId),
        ...((bundle.productIds || []).map((x) => String(x))),
      ]);
      if (
        it.isBundleItemClaim &&
        allowedIds.has(String(it.productId)) &&
        Number(it.bundleDiscountClaim) === discountPercent
      ) {
        return { isBundleItem: true, bundleDiscount: Math.min(Math.max(discountPercent, 0), 100) };
      }
    }
    return { isBundleItem: false, bundleDiscount: 0 };
  });
};

module.exports = {
  roundTwo,
  isPromotionCurrentlyActive,
  getProductCategoryId,
  computeBxGyFreeUnits,
  getProductOfferThreshold,
  getActiveProductOffers,
  getBestProductOfferForQty,
  resolveActivePromotionForProduct,
  computePromotionForLine,
  calculateCartPromotions,
  validateBundleItems,
};