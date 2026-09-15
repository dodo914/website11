// قائمة أقسام لوحة التحكم اللي ممكن الأدمن يدي صلاحية عليها لموظف بصلاحيات مخصصة (role: 'staff')
// كل قسم ليه مستويين وصول: 'view' (يشوف بس) أو 'edit' (يشوف ويعدل)
//
// ملحوظة مهمة: الأقسام هنا مبنية على شكل الـ API الفعلي مش شكل تابات الفرونت بالظبط.
// "settings" مثلاً قسم واحد بيغطي كل حاجة بتتخزن في سجل الإعدادات العام (الفئات، الشحن،
// العروض، الخصومات، الولاء، المصاريف، الأسئلة الشائعة، التصميم، المحتوى، الصفحات المخصصة،
// إعدادات الدفع، مفاتيح الـ API، الإحصائيات) — عشان دي كلها بتتحفظ وتتقرا من نفس الـ endpoint
// في السيرفر، فمفيش طريقة تقنية تفصل "يعدل الفئات بس من غير الخصومات" من غير تعديل كبير
// في بنية السيرفر. باقي الأقسام (الطلبات، المنتجات، العملاء...) لها endpoints منفصلة فعلاً
// فصلاحياتها دقيقة قسم بقسم.
//
// ملحوظة أمان: قسم "إدارة الموظفين" مقصود عدم وجوده هنا — إدارة الموظفين
// (إضافة/حذف/تعديل صلاحيات) تفضل للأدمن بس، عشان موظف ميقدرش يدي نفسه أو غيره صلاحيات أعلى.

const SECTIONS = [
  { key: 'orders', label: 'الطلبات' },
  { key: 'products', label: 'المنتجات والمخزون' },
  { key: 'customers', label: 'العملاء' },
  { key: 'customer_segments', label: 'شرائح العملاء' },
  { key: 'brevo_marketing', label: 'التسويق والحملات' },
  { key: 'abandoned_carts', label: 'السلال المتروكة' },
  { key: 'payments_dashboard', label: 'لوحة المدفوعات' },
  { key: 'shipping_dashboard', label: 'لوحة الشحن' },
  { key: 'traffic', label: 'الزيارات والتحليلات' },
  { key: 'activity_log', label: 'سجل النشاط' },
  { key: 'messages', label: 'رسائل التواصل' },
  { key: 'reviews', label: 'تقييمات المنتجات' },
  { key: 'store_health', label: 'صحة المتجر' },
  { key: 'auth_settings', label: 'إعدادات تسجيل الدخول (عرض فقط)' },
  {
    key: 'settings',
    label: 'إعدادات المتجر العامة (الفئات، الشحن، العروض، الخصومات، الولاء، المصاريف، الأسئلة الشائعة، التصميم، المحتوى، الصفحات، مفاتيح الـ API، الإحصائيات)',
  },
];

const SECTION_KEYS = SECTIONS.map((s) => s.key);

// بيتأكد إن مصفوفة الصلاحيات الجاية من الأدمن شكلها صح، وبيرجعها منضفة
// بيرمي Error برسالة عربية واضحة لو فيه مشكلة
const sanitizePermissions = (permissions) => {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    throw new Error('لازم تحدد قسم واحد على الأقل للموظف');
  }

  const seen = new Set();
  const cleaned = [];

  for (const p of permissions) {
    const section = String(p?.section || '').trim();
    const access = String(p?.access || '').trim();

    if (!SECTION_KEYS.includes(section)) {
      throw new Error('في قسم غير معروف ضمن الصلاحيات المطلوبة');
    }
    if (!['view', 'edit'].includes(access)) {
      throw new Error('مستوى الصلاحية لازم يكون "عرض" أو "تعديل"');
    }
    if (seen.has(section)) continue; // تجاهل التكرار بدل ما نرمي خطأ
    seen.add(section);
    cleaned.push({ section, access });
  }

  if (cleaned.length === 0) {
    throw new Error('لازم تحدد قسم واحد على الأقل للموظف');
  }

  return cleaned;
};

// بيتأكد إن اليوزر عنده صلاحية على قسم معين بمستوى معين (level: 'view' أو 'edit')
// 'edit' بتغطي 'view' تلقائي (لو عنده تعديل يبقى طبعاً يقدر يشوف)
const hasPermission = (user, section, level = 'view') => {
  if (!user || !Array.isArray(user.permissions)) return false;
  const entry = user.permissions.find((p) => p.section === section);
  if (!entry) return false;
  if (level === 'view') return entry.access === 'view' || entry.access === 'edit';
  return entry.access === 'edit';
};

module.exports = { SECTIONS, SECTION_KEYS, sanitizePermissions, hasPermission };