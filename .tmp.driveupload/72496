// ===== قائمة أسباب طلب الاسترجاع (نفس الأكواد بالظبط اللي في السيرفر -
// server_build/utils/returnReasons.js). feeApplies بيحدد هل رسوم شحن
// الاسترجاع (adminSettings.current.returnFeeAmount) هتتخصم من مبلغ
// الاسترجاع ولا لأ. لو ضفت سبب جديد هنا، ضيفه بنفس الـcode في السيرفر. =====
export const RETURN_REASONS = [
  { code: 'defective', ar: 'المنتج فيه عيب / وصل تالف', en: 'Item is defective / arrived damaged', feeApplies: false },
  { code: 'wrong_item', ar: 'استلمت منتج مختلف عن اللي طلبته', en: 'Received a different item than ordered', feeApplies: false },
  { code: 'wrong_size', ar: 'المقاس مش مظبوط', en: 'Wrong size', feeApplies: true },
  { code: 'changed_mind', ar: 'غيرت رأيي / مش عاجبني المنتج', en: 'Changed my mind / not what I expected', feeApplies: true },
  { code: 'other', ar: 'سبب تاني', en: 'Other reason', feeApplies: true },
];

// ===== قائمة أسباب طلب الاستبدال (نفس الأكواد بالظبط اللي في السيرفر -
// server_build/utils/exchangeReasons.js). لو ضفت سبب جديد هنا، ضيفه بنفس
// الـcode في السيرفر. =====
export const EXCHANGE_REASONS = [
  { code: 'wrong_size', ar: 'المقاس مش مظبوط', en: 'Wrong Size', feeApplies: true },
  { code: 'wrong_color', ar: 'اللون مش اللي عايزه', en: 'Wrong Color', feeApplies: true },
  { code: 'changed_mind', ar: 'غيرت رأيي', en: 'Changed My Mind', feeApplies: true },
  { code: 'defective', ar: 'المنتج فيه عيب', en: 'Product Defective', feeApplies: false },
  { code: 'wrong_item', ar: 'استلمت منتج غلط', en: 'Wrong Product Received', feeApplies: false },
  { code: 'mismatch', ar: 'المنتج مش مطابق للطلب', en: "Product Doesn't Match Order", feeApplies: false },
  { code: 'other', ar: 'سبب تاني', en: 'Other', feeApplies: true },
];

export const EXCHANGE_STATUS_LABELS = {
  pending: { ar: 'طلب الاستبدال قيد المراجعة', en: 'Your exchange request is under review', cls: 'amber' },
  under_review: { ar: 'طلب الاستبدال قيد المراجعة', en: 'Your exchange request is under review', cls: 'amber' },
  approved: { ar: 'تمت الموافقة على طلب الاستبدال', en: 'Your exchange request was approved', cls: 'green' },
  rejected: { ar: 'تم رفض طلب الاستبدال', en: 'Your exchange request was rejected', cls: 'red' },
  pickup_scheduled: { ar: 'تم جدولة استلام المنتج القديم', en: 'Pickup scheduled', cls: 'green' },
  received: { ar: 'تم استلام المنتج القديم', en: 'Old item received', cls: 'green' },
  processing: { ar: 'جاري تجهيز المنتج الجديد', en: 'Preparing your new item', cls: 'green' },
  completed: { ar: 'اكتمل الاستبدال', en: 'Exchange completed', cls: 'green' },
  cancelled: { ar: 'تم إلغاء طلب الاستبدال', en: 'Exchange request cancelled', cls: 'red' },
  // ===== Phase 2C =====
  carrier_picked_up: { ar: 'شركة الشحن استلمت المنتج القديم منك', en: 'Old item picked up by carrier', cls: 'green' },
  received_at_warehouse: { ar: 'وصل المنتج القديم للمخزن', en: 'Old item arrived at warehouse', cls: 'green' },
  inspecting: { ar: 'جاري معاينة المنتج القديم', en: 'Inspecting your old item', cls: 'green' },
  shipped_to_customer: { ar: 'المنتج الجديد في الطريق إليك', en: 'Your new item is on the way', cls: 'green' },
};

// ===== نفس ترتيب WORKFLOW_ORDER الموجود في exchangeController.js بالسيرفر بالظبط -
// أي تحديث حالة لازم يكون "قدّام" في الترتيب ده (أو cancelled) =====
export const EXCHANGE_WORKFLOW_ORDER = ['approved', 'carrier_picked_up', 'received_at_warehouse', 'inspecting', 'shipped_to_customer', 'completed'];