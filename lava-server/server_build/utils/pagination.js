// ============================================================
// Helper موحّد للـ pagination — يُستخدم في كل الـ endpoints اللي بترجع لستة.
//
// الفكرة: أي endpoint بيقبل query params زي ?page=2&limit=50 اختياريًا.
// - لو الطلب فيه page أو limit → بيرجع { items, total, page, pageSize, totalPages }
// - لو الطلب من غير page/limit (زي الطلبات الحالية من الفرونت) → السلوك
//   القديم بيفضل زي ما هو (array كامل) لكن مع سقف أمان أقصى (hardCap) عشان
//   محدش يقدر يجيب ملايين الـ records دفعة واحدة حتى لو مبعتش limit.
// ده بيحافظ على التوافق مع الفرونت الحالي، وفي نفس الوقت بيوفر pagination
// حقيقية جاهزة لأي حد يستخدمها.
// ============================================================

const DEFAULT_MAX_LIMIT = 200; // سقف أقصى لأي limit يبعته المستخدم (منع limit=999999999)
const DEFAULT_HARD_CAP = 500;  // سقف أمان للاستدعاءات القديمة اللي مبتبعتش page/limit خالص

/**
 * @param {object} query - req.query
 * @param {object} opts - { defaultLimit, maxLimit, hardCap }
 * @returns {{ isPaginated: boolean, page: number, limit: number, skip: number }}
 */
const parsePagination = (query = {}, opts = {}) => {
  const maxLimit = opts.maxLimit || DEFAULT_MAX_LIMIT;
  const hardCap = opts.hardCap || DEFAULT_HARD_CAP;
  const defaultLimit = opts.defaultLimit || maxLimit;

  const hasPageParam = query.page !== undefined && query.page !== '';
  const hasLimitParam = query.limit !== undefined && query.limit !== '';
  const isPaginated = hasPageParam || hasLimitParam;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  let limit;
  if (isPaginated) {
    limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  } else {
    // مفيش pagination متطلوبة صراحة: نرجّع أكبر عدد ممكن لكن تحت سقف الأمان
    limit = hardCap;
  }

  const skip = (page - 1) * limit;
  return { isPaginated, page, limit, skip };
};

/**
 * يبني الـ response النهائي بحسب لو الطلب كان paginated صراحة أو لأ.
 */
const buildListResponse = ({ isPaginated, page, limit, items, total }) => {
  if (!isPaginated) {
    return items; // نفس الشكل القديم (array) — بدون كسر أي كود فرونت حالي
  }
  return {
    items,
    total,
    page,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
};

module.exports = { parsePagination, buildListResponse, DEFAULT_MAX_LIMIT, DEFAULT_HARD_CAP };