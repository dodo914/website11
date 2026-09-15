const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Settings = require('../models/Settings');
const { invalidateSettingsCaches } = require('../utils/cache');
const EmailOtp = require('../models/EmailOtp');
const PasswordResetOtp = require('../models/PasswordResetOtp');
const AdminSecurityOtp = require('../models/AdminSecurityOtp');
const generateToken = require('../utils/generateToken');
const { AUTH_COOKIE_NAME, setAuthCookie, clearAuthCookie, setCsrfCookie, clearCsrfCookie } = require('../utils/cookieAuth');
const { isValidEmail, isValidPhone, isValidOtp, validatePasswordStrength, validateName } = require('../utils/validators');
const { validateEgyptianPhone } = require('../utils/addressValidation');
const { getEmailBrandSettings, wrapEmailHtml } = require('../utils/emailTemplate');
const brevoService = require('../services/brevoService');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const hasResendApiKey = () => Boolean(String(process.env.RESEND_API_KEY || '').trim());
const hasBrevoApiKey = () => brevoService.configured();

const getAuthSettings = async () => {
  const settings = await Settings.findOne().select('customerLoginMethod resendFromEmail otpEmailProvider').lean();
  return {
    customerLoginMethod: settings?.customerLoginMethod === 'email_code' ? 'email_code' : 'email_password',
    resendFromEmail: String(settings?.resendFromEmail || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev').trim(),
    otpEmailProvider: settings?.otpEmailProvider === 'brevo' ? 'brevo' : 'resend',
  };
};

const safeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || '',
  role: user.role,
  permissions: user.role === 'staff' ? (user.permissions || []) : undefined,
  savedShipping: user.savedShipping || null,
  firstOrderDiscountUsed: user.firstOrderDiscountUsed || false,
  wishlist: Array.isArray(user.wishlist) ? user.wishlist : [],
  cart: Array.isArray(user.cart) ? user.cart : [],
  marketingConsent: user.marketingConsent !== false,
});

const isAdmin = (user) => user?.role === 'admin';

const sendEmailWithResend = async ({ to, subject, html, text }) => {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    const error = new Error('Resend API key is not configured');
    error.code = 'RESEND_NOT_CONFIGURED';
    throw error;
  }

  const { resendFromEmail } = await getAuthSettings();
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.message || 'Resend rejected the email');
    error.status = response.status;
    error.details = body;
    throw error;
  }

  return body;
};

// بيبعت رسايل الـ OTP (كود الدخول / إعادة تعيين الباسورد / تأكيد الأدمن) بالشركة
// اللي الأدمن اختارها من لوحة التحكم (Resend أو Brevo) — رسايل تأكيد الطلب
// والماركتينج فضلت زي ما هي بتتبعت بـ Brevo دايماً (marketingWorker.js).
const sendOtpEmailWithProvider = async ({ to, subject, html, text }) => {
  const { otpEmailProvider } = await getAuthSettings();

  if (otpEmailProvider === 'brevo') {
    if (!hasBrevoApiKey()) {
      const error = new Error('Brevo API key is not configured');
      error.code = 'BREVO_NOT_CONFIGURED';
      throw error;
    }
    return brevoService.sendEmail({ to, subject, html, text });
  }

  return sendEmailWithResend({ to, subject, html, text });
};

const createOtpCode = () => String(crypto.randomInt(100000, 1000000));
const hashOtp = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

const consumeOtpAtomically = async (Model, { id, email, codeHash, now }) => {
  return Model.findOneAndDelete({
    _id: id,
    email,
    codeHash,
    expiresAt: { $gt: now },
    attempts: { $lt: 5 },
  });
};

const incrementOtpAttemptAtomically = async (Model, id) => {
  return Model.findOneAndUpdate(
    { _id: id, attempts: { $lt: 5 } },
    { $inc: { attempts: 1 } },
    { new: true }
  );
};

const otpCardHtml = ({ title, description, code, footNote }) => `
  <div style="background:#fff;border-radius:16px;padding:32px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <h2 style="margin:0 0 10px;color:#111827">${title}</h2>
    <p style="color:#555;margin:0 0 6px">${description}</p>
    <div style="font-size:36px;font-weight:800;letter-spacing:10px;padding:18px;background:#f3f4f6;border-radius:12px;margin:24px 0;color:#111827">${code}</div>
    <p style="font-size:13px;color:#777;margin:0">${footNote}</p>
  </div>
`;

const buildOtpEmail = async (code) => {
  const settings = await getEmailBrandSettings();
  return {
    subject: 'رمز تسجيل الدخول إلى متجرك',
    text: `رمز تسجيل الدخول الخاص بك هو: ${code}. الرمز صالح لمدة 10 دقائق ولا تشاركه مع أي شخص.`,
    html: wrapEmailHtml(otpCardHtml({
      title: 'رمز تسجيل الدخول',
      description: 'استخدم الرمز التالي لتسجيل الدخول إلى حسابك:',
      code,
      footNote: 'الرمز صالح لمدة 10 دقائق ويُستخدم مرة واحدة فقط.',
    }), settings),
  };
};

const buildPasswordResetEmail = async (code) => {
  const settings = await getEmailBrandSettings();
  return {
    subject: 'رمز إعادة تعيين كلمة المرور',
    text: `رمز إعادة تعيين كلمة المرور الخاص بك هو: ${code}. الرمز صالح لمدة 10 دقائق ولا تشاركه مع أي شخص. لو مطلبتش إعادة تعيين كلمة المرور، تجاهل هذه الرسالة.`,
    html: wrapEmailHtml(otpCardHtml({
      title: 'إعادة تعيين كلمة المرور',
      description: 'استخدم الرمز التالي لإعادة تعيين كلمة المرور الخاصة بحسابك:',
      code,
      footNote: 'الرمز صالح لمدة 10 دقائق ويُستخدم مرة واحدة فقط. لو مطلبتش ده، تجاهل الرسالة ولن يتغير شيء في حسابك.',
    }), settings),
  };
};

const buildAdminSecurityEmail = async (code) => {
  const settings = await getEmailBrandSettings();
  return {
    subject: 'رمز تأكيد تعديل بيانات حساب الأدمن',
    text: `فيه محاولة لتعديل بيانات حساب الأدمن (الإيميل/الباسورد/رقم الهاتف). رمز التأكيد الخاص بك هو: ${code}. الرمز صالح لمدة 10 دقائق. لو مطلبتش التعديل ده، تجاهل هذه الرسالة ولا تشارك الرمز مع أي شخص.`,
    html: wrapEmailHtml(otpCardHtml({
      title: 'تأكيد تعديل بيانات الحساب',
      description: 'فيه محاولة لتعديل بيانات حساب الأدمن (الإيميل/الباسورد/رقم الهاتف). استخدم الرمز التالي لتأكيد العملية:',
      code,
      footNote: 'الرمز صالح لمدة 10 دقائق ويُستخدم مرة واحدة فقط. لو مطلبتش التعديل ده، تجاهل هذه الرسالة — بياناتك لن تتغير.',
    }), settings),
  };
};

// POST /api/auth/register — النظام القديم: Email + Password
const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    // ===== موافقة الماركتنج وقت التسجيل - checkbox بيبان متحدد افتراضيًا في
    // الفرونت (زي شوبيفاي)، فلو العميل ملغهاش بييجي true. لو مبعوتش أصلاً
    // (نداء قديم) بردو true عشان الافتراضي يفضل "موافق". =====
    const marketingConsent = req.body.marketingConsent !== false;
    const normalizedEmail = normalizeEmail(email);
    if (!name || !normalizedEmail || !phone || !password) {
      return res.status(400).json({ message: 'كل البيانات مطلوبة' });
    }
    const nameError = validateName(name);
    if (nameError) return res.status(400).json({ message: nameError });
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'البريد الإلكتروني غير صحيح' });
    }
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'رقم الهاتف غير صحيح' });
    }
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ message: 'البريد الإلكتروني مستخدم بالفعل' });

    const authSettings = await getAuthSettings();
    if (authSettings.customerLoginMethod !== 'email_password') {
      return res.status(409).json({ message: 'التسجيل بالباسورد غير مفعّل حالياً. استخدم تسجيل الدخول بالكود.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: String(phone).trim(),
      password: hashedPassword,
      role: 'customer',
      marketingConsent,
    });

    const token = generateToken(user);
    setAuthCookie(res, token);
    const csrfToken = setCsrfCookie(res);
    return res.status(201).json({ user: safeUser(user), csrfToken });
  } catch (err) {
    console.error('Auth register error:', err);
    return res.status(500).json({ message: 'حصل خطأ في التسجيل' });
  }
};

// POST /api/auth/login — كلمة مرور للعملاء أو الموظفين/الأدمن دائماً
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: 'البريد وكلمة المرور مطلوبين' });
    }
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'البريد الإلكتروني غير صحيح' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.password) return res.status(401).json({ message: 'بيانات الدخول غلط' });

    // الأدمن/الموظفين دائماً Password. العملاء كذلك في النظام الأول فقط.
    if (!isAdmin(user)) {
      const authSettings = await getAuthSettings();
      if (authSettings.customerLoginMethod === 'email_code' && user.role === 'customer') {
        return res.status(409).json({ message: 'تسجيل دخول العملاء حالياً بالكود المرسل إلى البريد.' });
      }
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'بيانات الدخول غلط' });

    const token = generateToken(user);
    setAuthCookie(res, token);
    const csrfToken = setCsrfCookie(res);
    return res.json({ user: safeUser(user), csrfToken });
  } catch (err) {
    console.error('Auth login error:', err);
    return res.status(500).json({ message: 'حصل خطأ في تسجيل الدخول' });
  }
};

// POST /api/auth/send-code — للعملاء فقط عندما يكون النظام Email + Code
const sendLoginCode = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: 'اكتب البريد الإلكتروني أولاً' });
    if (!isValidEmail(email)) return res.status(400).json({ message: 'البريد الإلكتروني غير صحيح' });

    const authSettings = await getAuthSettings();
    if (authSettings.customerLoginMethod !== 'email_code') {
      return res.status(409).json({ message: 'تسجيل الدخول بالكود غير مفعّل حالياً.' });
    }

    const existingUser = await User.findOne({ email }).select('role');
    if (existingUser?.role && existingUser.role !== 'customer') {
      return res.status(403).json({ message: 'حساب الإدارة والموظفين يستخدم كلمة المرور.' });
    }

    const now = Date.now();
    const existingOtp = await EmailOtp.findOne({ email }).sort({ createdAt: -1 });
    if (existingOtp && now - new Date(existingOtp.lastSentAt).getTime() < 60 * 1000) {
      return res.status(429).json({ message: 'استنى دقيقة قبل إرسال كود جديد.' });
    }

    const code = createOtpCode();
    const otp = await EmailOtp.findOneAndUpdate(
      { email },
      {
        email,
        codeHash: hashOtp(code),
        expiresAt: new Date(now + 10 * 60 * 1000),
        attempts: 0,
        lastSentAt: new Date(now),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    try {
      const mail = await buildOtpEmail(code);
      await sendOtpEmailWithProvider({ to: email, ...mail });
    } catch (mailError) {
      await EmailOtp.deleteOne({ _id: otp._id });
      if (mailError.code === 'RESEND_NOT_CONFIGURED') {
        return res.status(503).json({ message: 'خدمة إرسال البريد غير مهيأة. أضف RESEND_API_KEY في .env.' });
      }
      if (mailError.code === 'BREVO_NOT_CONFIGURED') {
        return res.status(503).json({ message: 'خدمة إرسال البريد غير مهيأة. أضف بيانات Brevo في .env.' });
      }
      console.error('OTP send error:', mailError.details || mailError.message);
      return res.status(502).json({ message: 'تعذر إرسال الكود إلى البريد الإلكتروني.' });
    }

    return res.json({ success: true, expiresInSeconds: 600, retryAfterSeconds: 60 });
  } catch (err) {
    console.error('Auth send code error:', err);
    return res.status(500).json({ message: 'حصل خطأ أثناء إرسال الكود' });
  }
};

// POST /api/auth/verify-code — ينشئ حساب العميل تلقائياً لو الإيميل جديد
const verifyLoginCode = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    if (!email || !isValidEmail(email) || !isValidOtp(code)) {
      return res.status(400).json({ message: 'الإيميل والكود المكون من 6 أرقام مطلوبين' });
    }

    const authSettings = await getAuthSettings();
    if (authSettings.customerLoginMethod !== 'email_code') {
      return res.status(409).json({ message: 'تسجيل الدخول بالكود غير مفعّل حالياً.' });
    }

    const user = await User.findOne({ email });
    if (user && user.role !== 'customer') {
      return res.status(403).json({ message: 'حساب الإدارة والموظفين يستخدم كلمة المرور.' });
    }

    const otp = await EmailOtp.findOne({ email });
    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      if (otp) await EmailOtp.deleteOne({ _id: otp._id });
      return res.status(400).json({ message: 'الكود منتهي أو غير موجود. اطلب كوداً جديداً.' });
    }

    if (otp.attempts >= 5) {
      await EmailOtp.deleteOne({ _id: otp._id });
      return res.status(429).json({ message: 'تم تجاوز عدد المحاولات. اطلب كوداً جديداً.' });
    }

    const valid = crypto.timingSafeEqual(
      Buffer.from(hashOtp(code), 'hex'),
      Buffer.from(otp.codeHash, 'hex')
    );
    if (!valid) {
      await incrementOtpAttemptAtomically(EmailOtp, otp._id);
      return res.status(401).json({ message: 'الكود غير صحيح.' });
    }

    const consumedOtp = await consumeOtpAtomically(EmailOtp, {
      id: otp._id,
      email,
      codeHash: otp.codeHash,
      now: new Date(),
    });
    if (!consumedOtp) {
      return res.status(409).json({ message: 'الكود اتستخدم بالفعل أو لم يعد صالحًا. اطلب كوداً جديداً.' });
    }

    let customer = user;
    if (!customer) {
      const generatedName = email.split('@')[0].replace(/[._-]+/g, ' ').trim() || 'Customer';
      customer = await User.create({
        name: generatedName.slice(0, 80),
        email,
        phone: '',
        password: null,
        role: 'customer',
      });
    }

    const token = generateToken(customer);
    setAuthCookie(res, token);
    const csrfToken = setCsrfCookie(res);
    return res.json({ user: safeUser(customer), created: !user, csrfToken });
  } catch (err) {
    console.error('Auth verify code error:', err);
    return res.status(500).json({ message: 'حصل خطأ أثناء التحقق من الكود' });
  }
};

// POST /api/auth/forgot-password — بيبعت كود OTP على الإيميل لإعادة تعيين كلمة المرور.
// شغالة لأي حساب عنده باسورد (عميل، أدمن، موظف)، مش مرتبطة بنظام تسجيل الدخول
// بالكود (customerLoginMethod) — دي مستقلة تمامًا وبتستخدم موديل منفصل (PasswordResetOtp).
const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: 'اكتب البريد الإلكتروني أولاً' });
    if (!isValidEmail(email)) return res.status(400).json({ message: 'البريد الإلكتروني غير صحيح' });

    const now = Date.now();
    const existingOtp = await PasswordResetOtp.findOne({ email }).sort({ createdAt: -1 });
    if (existingOtp && now - new Date(existingOtp.lastSentAt).getTime() < 60 * 1000) {
      return res.status(429).json({ message: 'استنى دقيقة قبل إرسال كود جديد.' });
    }

    // منمنعش نكشف هل الإيميل موجود ولا لأ (عشان محدش يعرف إيميلات العملاء المسجلين).
    // لو الحساب مش موجود أصلاً، بنرجّع نفس الرد الناجح من غير ما نبعت أي إيميل فعليًا.
    // لو الحساب موجود بس معندوش باسورد (عميل اتسجل بالكود/OTP)، لسه بنبعتله الكود عادي —
    // هنا الطلب بقى معناه "تعيين كلمة مرور لأول مرة" مش بس "استرجاع" باسورد قديم.
    const user = await User.findOne({ email }).select('_id password');

    if (!user) {
      console.log(`[forgot-password] no account found for ${email} — skipping send (expected behaviour)`);
      return res.json({ success: true, expiresInSeconds: 600, retryAfterSeconds: 60 });
    }

    const code = createOtpCode();
    const otp = await PasswordResetOtp.findOneAndUpdate(
      { email },
      {
        email,
        codeHash: hashOtp(code),
        expiresAt: new Date(now + 10 * 60 * 1000),
        attempts: 0,
        lastSentAt: new Date(now),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    try {
      console.log(`[forgot-password] account found for ${email}, sending OTP now...`);
      const mail = await buildPasswordResetEmail(code);
      await sendOtpEmailWithProvider({ to: email, ...mail });
      console.log(`[forgot-password] OTP email accepted for ${email}`);
    } catch (mailError) {
      await PasswordResetOtp.deleteOne({ _id: otp._id });
      if (mailError.code === 'RESEND_NOT_CONFIGURED') {
        console.error('[forgot-password] RESEND_API_KEY missing in .env');
        return res.status(503).json({ message: 'خدمة إرسال البريد غير مهيأة. أضف RESEND_API_KEY في .env.' });
      }
      if (mailError.code === 'BREVO_NOT_CONFIGURED') {
        console.error('[forgot-password] Brevo credentials missing in .env');
        return res.status(503).json({ message: 'خدمة إرسال البريد غير مهيأة. أضف بيانات Brevo في .env.' });
      }
      console.error('[forgot-password] OTP send error:', mailError.details || mailError.message);
      return res.status(502).json({ message: 'تعذر إرسال الكود إلى البريد الإلكتروني.' });
    }

    return res.json({ success: true, expiresInSeconds: 600, retryAfterSeconds: 60 });
  } catch (err) {
    console.error('Auth forgot password error:', err);
    return res.status(500).json({ message: 'حصل خطأ أثناء إرسال كود إعادة التعيين' });
  }
};

// POST /api/auth/reset-password — بيتحقق من كود الـOTP، يغيّر كلمة المرور، وبيسجّل
// دخول المستخدم فورًا بعدها (نفس سلوك verifyLoginCode: كوكي JWT + CSRF token).
const resetPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!email || !isValidEmail(email) || !isValidOtp(code)) {
      return res.status(400).json({ message: 'الإيميل والكود المكون من 6 أرقام مطلوبين' });
    }
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const otp = await PasswordResetOtp.findOne({ email });
    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      if (otp) await PasswordResetOtp.deleteOne({ _id: otp._id });
      return res.status(400).json({ message: 'الكود منتهي أو غير موجود. اطلب كوداً جديداً.' });
    }

    if (otp.attempts >= 5) {
      await PasswordResetOtp.deleteOne({ _id: otp._id });
      return res.status(429).json({ message: 'تم تجاوز عدد المحاولات. اطلب كوداً جديداً.' });
    }

    const valid = crypto.timingSafeEqual(
      Buffer.from(hashOtp(code), 'hex'),
      Buffer.from(otp.codeHash, 'hex')
    );
    if (!valid) {
      await incrementOtpAttemptAtomically(PasswordResetOtp, otp._id);
      return res.status(401).json({ message: 'الكود غير صحيح.' });
    }

    const consumedOtp = await consumeOtpAtomically(PasswordResetOtp, {
      id: otp._id,
      email,
      codeHash: otp.codeHash,
      now: new Date(),
    });
    if (!consumedOtp) {
      return res.status(409).json({ message: 'الكود اتستخدم بالفعل أو لم يعد صالحًا. اطلب كوداً جديداً.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // الكود اتحقق بنجاح لكن الحساب اتمسح بعد ما اتبعت له الكود (حالة نادرة) — امسح
      // الكود ورجّع رسالة عامة من غير ما نكشف تفاصيل إضافية.
      return res.status(404).json({ message: 'تعذر إعادة تعيين كلمة المرور لهذا الحساب.' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    // ===== P1-5 (Part B): تغيير الباسورد لازم يلغي أي توكن قديم صادر قبل
    // كده (لو كان متسرّب/متخزن عند حد تاني) - بنزود tokenVersion قبل ما
    // نولّد التوكن الجديد، فالتوكن الجديد بس هو اللي هيبقى شغال. =====
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    const token = generateToken(user);
    setAuthCookie(res, token);
    const csrfToken = setCsrfCookie(res);
    return res.json({ user: safeUser(user), csrfToken });
  } catch (err) {
    console.error('Auth reset password error:', err);
    return res.status(500).json({ message: 'حصل خطأ أثناء إعادة تعيين كلمة المرور' });
  }
};

// POST /api/auth/check-email — بيحدد هل الإيميل ده يدخل بباسورد ولا بكود (خطوة واحدة موحدة للعميل والإدارة)
const checkEmailLoginMethod = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: 'اكتب البريد الإلكتروني أولاً' });

    const authSettings = await getAuthSettings();
    const existingUser = await User.findOne({ email }).select('role');

    // أي حساب مش "customer" (أدمن، كول سنتر، باكر... إلخ) بيدخل بالباسورد دايماً
    if (existingUser && existingUser.role !== 'customer') {
      return res.json({ method: 'password' });
    }

    // عميل موجود أو إيميل جديد: حسب إعداد تسجيل دخول العملاء
    return res.json({ method: authSettings.customerLoginMethod === 'email_code' ? 'code' : 'password' });
  } catch (err) {
    console.error('Check email login method error:', err);
    return res.status(500).json({ message: 'تعذر التحقق من البريد الإلكتروني' });
  }
};

// GET /api/auth/config — إعدادات تسجيل دخول العملاء العامة
const getPublicAuthConfig = async (req, res) => {
  try {
    const authSettings = await getAuthSettings();
    return res.json({ customerLoginMethod: authSettings.customerLoginMethod });
  } catch (err) {
    console.error('Auth config error:', err);
    return res.status(500).json({ message: 'تعذر تحميل إعدادات تسجيل الدخول' });
  }
};

// GET /api/auth/admin-config — للأدمن فقط
const getAdminAuthConfig = async (req, res) => {
  try {
    const authSettings = await getAuthSettings();
    const admin = await User.findOne({ role: 'admin' }).select('email phone name').sort({ createdAt: 1 }).lean();
    return res.json({
      customerLoginMethod: authSettings.customerLoginMethod,
      resendFromEmail: authSettings.resendFromEmail,
      otpEmailProvider: authSettings.otpEmailProvider,
      admin: admin ? { email: admin.email, phone: admin.phone || '', name: admin.name } : null,
      resendConfigured: hasResendApiKey(),
      brevoConfigured: hasBrevoApiKey(),
    });
  } catch (err) {
    console.error('Admin auth config error:', err);
    return res.status(500).json({ message: 'تعذر تحميل إعدادات الأمان' });
  }
};

// POST /api/auth/admin-config/send-otp — للأدمن فقط. بيبعت كود تأكيد على إيميل
// الأدمن *الحالي* (من الداتابيز، مش من أي إيميل جديد المستخدم كاتبه في الفورم)،
// عشان تعديل البيانات الحساسة (الإيميل/الباسورد/الهاتف) يحتاج تأكيد دايماً.
const requestAdminConfigOtp = async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' }).select('email').sort({ createdAt: 1 });
    if (!admin || !admin.email) return res.status(404).json({ message: 'حساب الأدمن غير موجود.' });

    const email = normalizeEmail(admin.email);
    const now = Date.now();
    const existingOtp = await AdminSecurityOtp.findOne({ email }).sort({ createdAt: -1 });
    if (existingOtp && now - new Date(existingOtp.lastSentAt).getTime() < 60 * 1000) {
      return res.status(429).json({ message: 'استنى دقيقة قبل إرسال كود جديد.' });
    }

    const code = createOtpCode();
    const otp = await AdminSecurityOtp.findOneAndUpdate(
      { email },
      {
        email,
        codeHash: hashOtp(code),
        expiresAt: new Date(now + 10 * 60 * 1000),
        attempts: 0,
        lastSentAt: new Date(now),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    try {
      const mail = await buildAdminSecurityEmail(code);
      await sendOtpEmailWithProvider({ to: email, ...mail });
    } catch (mailError) {
      await AdminSecurityOtp.deleteOne({ _id: otp._id });
      if (mailError.code === 'RESEND_NOT_CONFIGURED') {
        return res.status(503).json({ message: 'خدمة إرسال البريد غير مهيأة. أضف RESEND_API_KEY في .env.' });
      }
      if (mailError.code === 'BREVO_NOT_CONFIGURED') {
        return res.status(503).json({ message: 'خدمة إرسال البريد غير مهيأة. أضف بيانات Brevo في .env.' });
      }
      console.error('OTP send error (admin security):', mailError.details || mailError.message);
      return res.status(502).json({ message: 'تعذر إرسال الكود إلى البريد الإلكتروني.' });
    }

    // منرجعش الإيميل بالكامل في الرد عشان مايظهرش لحد بيبص على الشاشة، بس نرجّع
    // آخر جزء بسيط يساعد الأدمن يتأكد إنه فتح الإيميل الصح.
    const maskedEmail = email.replace(/^(.{2}).+(@.+)$/, '$1***$2');
    return res.json({ success: true, expiresInSeconds: 600, retryAfterSeconds: 60, sentTo: maskedEmail });
  } catch (err) {
    console.error('Request admin config OTP error:', err);
    return res.status(500).json({ message: 'حصل خطأ أثناء إرسال كود التأكيد' });
  }
};

// PUT /api/auth/admin-config — للأدمن فقط
const updateAdminAuthConfig = async (req, res) => {
  try {
    const method = req.body?.customerLoginMethod === 'email_code' ? 'email_code' : 'email_password';
    const resendFromEmail = String(req.body?.resendFromEmail || '').trim().toLowerCase();
    const otpEmailProvider = req.body?.otpEmailProvider === 'brevo' ? 'brevo' : 'resend';
    const adminEmail = normalizeEmail(req.body?.adminEmail);
    const adminPassword = String(req.body?.adminPassword || '');
    const adminPhone = String(req.body?.adminPhone || '').trim();
    const otpCode = String(req.body?.otpCode || '').trim();

    if (!resendFromEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resendFromEmail)) {
      return res.status(400).json({ message: 'إيميل الإرسال من Resend غير صحيح.' });
    }

    if (method === 'email_code') {
      if (otpEmailProvider === 'brevo' && !hasBrevoApiKey()) {
        return res.status(400).json({ message: 'لا يمكن تفعيل الدخول بالكود عبر Brevo قبل إضافة بيانات Brevo في .env.' });
      }
      if (otpEmailProvider === 'resend' && !hasResendApiKey()) {
        return res.status(400).json({ message: 'لا يمكن تفعيل الدخول بالكود قبل إضافة RESEND_API_KEY في .env.' });
      }
    }

    const admin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
    if (!admin) return res.status(404).json({ message: 'حساب الأدمن غير موجود.' });

    // أي تعديل في البيانات الحساسة (إيميل/باسورد/هاتف) لازم يتأكد بكود OTP اتبعت
    // على إيميل الأدمن الحالي أولاً — عن طريق POST /api/auth/admin-config/send-otp.
    const wantsEmailChange = adminEmail && adminEmail !== normalizeEmail(admin.email);
    const wantsPasswordChange = Boolean(adminPassword);
    const wantsPhoneChange = req.body?.adminPhone !== undefined && adminPhone !== String(admin.phone || '').trim();
    const requiresOtp = wantsEmailChange || wantsPasswordChange || wantsPhoneChange;

    if (requiresOtp) {
      if (!isValidOtp(otpCode)) {
        return res.status(400).json({ message: 'لازم تدخل كود التأكيد المكون من 6 أرقام المرسل على إيميلك أولاً.' });
      }

      const currentAdminEmail = normalizeEmail(admin.email);
      const otp = await AdminSecurityOtp.findOne({ email: currentAdminEmail });
      if (!otp || otp.expiresAt.getTime() < Date.now()) {
        if (otp) await AdminSecurityOtp.deleteOne({ _id: otp._id });
        return res.status(400).json({ message: 'كود التأكيد منتهي أو غير موجود. اطلب كوداً جديداً.' });
      }
      if (otp.attempts >= 5) {
        await AdminSecurityOtp.deleteOne({ _id: otp._id });
        return res.status(429).json({ message: 'تم تجاوز عدد المحاولات. اطلب كوداً جديداً.' });
      }
      const validOtp = crypto.timingSafeEqual(
        Buffer.from(hashOtp(otpCode), 'hex'),
        Buffer.from(otp.codeHash, 'hex')
      );
      if (!validOtp) {
        await incrementOtpAttemptAtomically(AdminSecurityOtp, otp._id);
        return res.status(401).json({ message: 'كود التأكيد غير صحيح.' });
      }
      const consumedOtp = await consumeOtpAtomically(AdminSecurityOtp, {
        id: otp._id,
        email: currentAdminEmail,
        codeHash: otp.codeHash,
        now: new Date(),
      });
      if (!consumedOtp) {
        return res.status(409).json({ message: 'كود التأكيد اتستخدم بالفعل أو لم يعد صالحًا. اطلب كوداً جديداً.' });
      }
    }

    if (adminEmail) {
      const emailOwner = await User.findOne({ email: adminEmail, _id: { $ne: admin._id } }).select('_id');
      if (emailOwner) return res.status(409).json({ message: 'إيميل الأدمن مستخدم في حساب آخر.' });
      admin.email = adminEmail;
    }
    if (adminPassword) {
      const passwordError = validatePasswordStrength(adminPassword);
      if (passwordError) return res.status(400).json({ message: passwordError });
      admin.password = await bcrypt.hash(adminPassword, 12);
      // ===== P1-5 (Part B): تغيير باسورد الأدمن (حساب حساس) لازم يلغي أي
      // جلسة/توكن قديم فورًا، حتى لو كان اللي بيغيّر الباسورد هو نفسه لسه
      // مسجل دخول بنفس الجلسة القديمة - هيحتاج يسجل دخول تاني بعد كده. =====
      admin.tokenVersion = (admin.tokenVersion || 0) + 1;
    }
    if (req.body?.adminPhone !== undefined) admin.phone = adminPhone;
    await admin.save();

    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: { customerLoginMethod: method, resendFromEmail, otpEmailProvider } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).select('customerLoginMethod resendFromEmail otpEmailProvider').lean();

    invalidateSettingsCaches();

    return res.json({
      success: true,
      customerLoginMethod: settings.customerLoginMethod,
      resendFromEmail: settings.resendFromEmail,
      otpEmailProvider: settings.otpEmailProvider,
      admin: { email: admin.email, phone: admin.phone || '', name: admin.name },
      resendConfigured: hasResendApiKey(),
      brevoConfigured: hasBrevoApiKey(),
    });
  } catch (err) {
    console.error('Update admin auth config error:', err);
    return res.status(500).json({ message: 'حصل خطأ أثناء حفظ إعدادات تسجيل الدخول' });
  }
};

const getMe = async (req, res) => {
  return res.json({ user: safeUser(req.user) });
};

// PUT /api/auth/marketing-consent — العميل بيفعّل/يلغي موافقته على استقبال
// رسائل الماركتنج (إيميل) من صفحة حسابه - زي checkbox Shopify بالظبط.
const updateMarketingConsent = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'لازم تسجل دخول الأول' });
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    user.marketingConsent = Boolean(req.body?.marketingConsent);
    await user.save();
    return res.json({ user: safeUser(user) });
  } catch (err) {
    console.error('Update marketing consent error:', err);
    return res.status(500).json({ message: 'حصل خطأ أثناء حفظ الإعداد' });
  }
};

// PUT /api/auth/saved-shipping — العميل بيحفظ/يحدّث بيانات الشحن المفضلة لحسابه
// عشان تفضل موجودة في الداتا بيز وترجع تاني حتى لو عمل ريفريش أو دخل من جهاز تاني
const updateSavedShipping = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'customer') {
      return res.status(403).json({ message: 'غير مسموح' });
    }

    const {
      fullName, phone, phone2, address, governorate, country, zipCode,
      // ===== حقول إضافية اختيارية (Phase 2 - عنوان منظّم) =====
      email, district, detailedAddress, buildingNumber, floor, apartment, landmark,
    } = req.body || {};

    if (!String(fullName || '').trim() || !String(address || '').trim() || !String(phone || '').trim()) {
      return res.status(400).json({ message: 'من فضلك أكمل بيانات الشحن' });
    }

    const phoneCheck = validateEgyptianPhone(phone, { label: 'رقم الهاتف' });
    if (!phoneCheck.ok) {
      return res.status(400).json({ message: phoneCheck.message });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    user.savedShipping = {
      fullName: String(fullName).trim(),
      phone: String(phone || '').trim(),
      phone2: String(phone2 || '').trim(),
      address: String(address).trim(),
      governorate: String(governorate || '').trim(),
      country: String(country || '').trim(),
      zipCode: String(zipCode || '').trim(),
      // الحقول دي اختيارية بالكامل - بتتحفظ لو اتبعتت، وإلا بتفضل فاضية
      // من غير ما تمنع حفظ باقي بيانات الشحن (backward compatible).
      email: String(email || '').trim() || undefined,
      district: String(district || '').trim() || undefined,
      detailedAddress: String(detailedAddress || '').trim() || undefined,
      buildingNumber: String(buildingNumber || '').trim() || undefined,
      floor: String(floor || '').trim() || undefined,
      apartment: String(apartment || '').trim() || undefined,
      landmark: String(landmark || '').trim() || undefined,
    };
    await user.save();

    return res.json({ user: safeUser(user) });
  } catch (err) {
    console.error('Update saved shipping error:', err);
    return res.status(500).json({ message: 'حصل خطأ أثناء حفظ بيانات الشحن' });
  }
};

// PUT /api/auth/wishlist — العميل بيحفظ/يحدّث قائمة المفضلة بتاعته
// بيستبدل القائمة بالكامل بالقائمة الجديدة المرسلة من الفرونت (بعد الدمج مع أي عناصر
// كانت محفوظة محلياً كـ guest قبل تسجيل الدخول)، عشان تفضل موجودة في الداتا بيز
// وترجع تاني حتى لو عمل ريفريش أو دخل من جهاز تاني.
const updateWishlist = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'لازم تسجل دخول الأول' });
    }

    const { wishlist } = req.body || {};
    if (!Array.isArray(wishlist)) {
      return res.status(400).json({ message: 'صيغة المفضلة غير صحيحة' });
    }

    // تنظيف القائمة: إزالة القيم الفاضية والتكرار
    const cleaned = [...new Set(wishlist.filter((id) => id !== null && id !== undefined && String(id).trim() !== ''))];

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    user.wishlist = cleaned;
    await user.save();

    return res.json({ user: safeUser(user) });
  } catch (err) {
    console.error('Update wishlist error:', err);
    return res.status(500).json({ message: 'حصل خطأ أثناء حفظ المفضلة' });
  }
};

// PUT /api/auth/cart — العميل بيحفظ/يحدّث سلة التسوق بتاعته
// بيستبدل السلة بالكامل بالسلة الجديدة المرسلة من الفرونت (بعد الدمج مع أي منتجات
// كانت محفوظة محلياً كـ guest قبل تسجيل الدخول)، عشان تفضل موجودة في الداتا بيز
// وترجع تاني حتى لو قفل المتصفح أو دخل من جهاز تاني — ولو مسحها من جهاز، تتمسح معاه
// في كل مكان تاني كمان.
const updateCart = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'لازم تسجل دخول الأول' });
    }

    const { cart } = req.body || {};
    if (!Array.isArray(cart)) {
      return res.status(400).json({ message: 'صيغة السلة غير صحيحة' });
    }

    // تنظيف السلة: عناصر فعلية بس، وسقف أمان لعدد العناصر عشان منمنعش إساءة استخدام
    const cleaned = cart
      .filter((item) => item && typeof item === 'object')
      .slice(0, 200);

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    user.cart = cleaned;
    await user.save();

    return res.json({ user: safeUser(user) });
  } catch (err) {
    console.error('Update cart error:', err);
    return res.status(500).json({ message: 'حصل خطأ أثناء حفظ السلة' });
  }
};

// POST /api/auth/logout — بيمسح كوكي الـ JWT وكوكي الـ CSRF من السيرفر
// ===== P1-5 (Part B): مجرد مسح الكوكي مايكفيش ضد توكن اتسرق (اتنسخ من
// الكوكي قبل الـlogout) - هيفضل شغال لحد ما ينتهي طبيعيًا (لحد 7 أيام
// افتراضيًا). عشان كده بنزوّد tokenVersion بتاع اليوزر هنا كمان، فأي توكن
// (بما فيه الكوكي اللي دلوقتي بنمسحه، أو أي نسخة مسروقة منه) يترفض فورًا.
// ملحوظة: المشروع مفيهوش تتبع جلسات لكل جهاز/متصفح على حدة (مفيش session id
// مخزّن)، فده معناه الـlogout بيلغي كل التوكنات الصادرة لليوزر ده (على أي
// جهاز) - مش بس التوكن الحالي. ده أوسع من "الجلسة الحالية بس"، لكنه الخيار
// الأأمن والوحيد المتاح من غير إضافة نظام session-per-device كامل (مش
// مطلوب في النطاق ده). =====
const logout = async (req, res) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.id) {
        await User.updateOne({ _id: decoded.id }, { $inc: { tokenVersion: 1 } });
      }
    } catch (err) {
      // توكن أصلاً غلط/منتهي - مفيش حاجة نلغيها، هنكمل نمسح الكوكيز عادي
    }
  }
  clearAuthCookie(res);
  clearCsrfCookie(res);
  return res.json({ success: true });
};

// GET /api/auth/csrf-token — بيديك CSRF token جديد (لازم يتنادى أول ما الصفحة تفتح
// قبل أي طلب POST/PUT/PATCH/DELETE، حتى لو المستخدم لسه مش مسجل دخول)
const getCsrfToken = async (req, res) => {
  const csrfToken = setCsrfCookie(res);
  return res.json({ csrfToken });
};

module.exports = {
  register,
  login,
  sendLoginCode,
  verifyLoginCode,
  forgotPassword,
  resetPassword,
  checkEmailLoginMethod,
  getPublicAuthConfig,
  getAdminAuthConfig,
  requestAdminConfigOtp,
  updateAdminAuthConfig,
  getMe,
  updateSavedShipping,
  updateWishlist,
  updateMarketingConsent,
  updateCart,
  logout,
  getCsrfToken,
};