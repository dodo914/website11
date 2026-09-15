const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  fullName: String,
  phone: String,
  governorate: String,
  country: String,
  address: String,
  zipCode: String,
  phone2: String,
  // ===== حقول إضافية (Phase 2 - عنوان منظّم) =====
  // اختيارية بالكامل، مضافة فوق الحقول القديمة من غير ما تمسها - أي حساب
  // قديم متسجل بعنوان قبل كده لسه شغال عادي (الحقول دي هتبقى undefined بس).
  email: String,
  district: String,
  detailedAddress: String,
  buildingNumber: String,
  floor: String,
  apartment: String,
  landmark: String,
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  // Password is optional because Email + Code customers do not need one.
  password: { type: String, default: null, select: true },
  phone: { type: String, default: '', trim: true },
  role: {
    type: String,
    // 'staff' = موظف بصلاحيات مخصصة يحددها الأدمن قسم قسم (شوف permissions تحت)
    enum: ['customer', 'admin', 'call_center', 'packer', 'staff'],
    default: 'customer',
  },
  // بتتعبى بس لما role يكون 'staff' — كل عنصر بيحدد قسم من لوحة التحكم
  // ومستوى الوصول عليه: 'view' (يشوف بس) أو 'edit' (يشوف ويعدل)
  permissions: [{
    _id: false,
    section: { type: String, required: true },
    access: { type: String, enum: ['view', 'edit'], required: true },
  }],
  savedShipping: addressSchema,
  firstOrderDiscountUsed: { type: Boolean, default: false },

  // ===== موافقة العميل على استقبال رسائل الماركتنج (إيميل) - زي checkbox
  // Shopify وقت التسجيل. لو false، مفيش أي رسالة ماركتنج (بيرفو) تتبعت له
  // حتى لو الأدمن مفعّل statusNotifications/abandonedCart... إلخ. مفعّلة
  // افتراضيًا وقت التسجيل (زي شوبيفاي)، والعميل يقدر يلغيها من صفحة حسابه. =====
  marketingConsent: { type: Boolean, default: true },

  // ===== المفضلة (Wishlist) — معرّفات المنتجات اللي العميل ضافها للمفضلة =====
  // بتتخزن هنا عشان تفضل موجودة حتى لو عمل ريفريش أو دخل من جهاز تاني
  wishlist: [{ type: mongoose.Schema.Types.Mixed }],

  // ===== سلة التسوق (Cart) — نفس فكرة المفضلة بالظبط =====
  // بتتخزن هنا (بدل ما تفضل بس في localStorage) عشان لو العميل ضاف منتجات للسلة
  // وقفل المتصفح أو دخل من جهاز/متصفح تاني، يلاقي نفس السلة موجودة زي ما سايبها،
  // ولو مسحها من جهاز، تتمسح في كل مكان معاه.
  cart: [{ type: mongoose.Schema.Types.Mixed }],

  // ===== نظام الولاء =====
  loyaltyOrderCount: { type: Number, default: 0 },
  loyaltyCodes: [{ type: String }],
  loyaltyCodesUsed: [{ type: String }],

  // ===== P1-5 (Part B) — JWT Revocation =====
  // بيتزاد رقمها في أي لحظة لازم كل الـJWT القديمة الصادرة قبل اللحظة دي
  // تبقى مرفوضة فورًا (مش لازم تستنى الـexpiry الطبيعي بتاعها): تسجيل خروج،
  // تغيير كلمة السر، أو تعديل بيانات أمان الأدمن الحساسة. كل توكن بيتولد
  // بقيمة tokenVersion الحالية جوّاه، وmiddleware التحقق بيقارنها بالقيمة
  // الحالية على المستخدم في الداتابيز - أي فرق يعني التوكن اتلغى.
  tokenVersion: { type: Number, default: 0 },
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ phone: 1 });

module.exports = mongoose.model('User', userSchema);