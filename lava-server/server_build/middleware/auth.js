const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AUTH_COOKIE_NAME } = require('../utils/cookieAuth');
const { hasPermission } = require('../utils/permissions');

// بيقرأ التوكن من الـ HttpOnly Cookie بدل ما ياخده من Authorization header
// (اللي كان معتمد على إن الفرونت يخزنه في localStorage)
const getTokenFromRequest = (req) => {
  return req.cookies?.[AUTH_COOKIE_NAME] || null;
};

// بيتأكد إن فيه توكن صحيح جوه الـ Cookie
const protect = async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ message: 'لازم تسجل دخول الأول' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ message: 'المستخدم غير موجود' });
    }
    // ===== P1-5 (Part B): تحقق من tokenVersion — لو اتعمل logout أو تغيير
    // باسورد/بيانات أمان بعد ما التوكن ده اتولد، الرقم في الداتابيز بيبقى
    // مختلف عن اللي جوه التوكن، فالتوكن ده يترفض فورًا حتى لو توقيعه صحيح
    // ولسه مش منتهي (بيمنع استخدام توكن مسروق بعد logout/تغيير الباسورد). =====
    if (Number(decoded.tokenVersion || 0) !== Number(req.user.tokenVersion || 0)) {
      return res.status(401).json({ message: 'انتهت صلاحية الجلسة، سجل دخول تاني' });
    }
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'التوكن غير صالح أو منتهي' });
  }
};

// بيتأكد إن دور المستخدم مسموح له بالعملية دي
// استخدام: authorize('admin') أو authorize('admin', 'call_center')
// ملحوظة أمان: الدور بيتقرا دايماً من req.user اللي جاي من الـ DB بعد التحقق من
// التوكن في middleware "protect" — مفيش أي اعتماد على role قادم من الـ frontend.
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'مالكش صلاحية تعمل العملية دي' });
    }
    next();
  };
};

// بيتأكد إن اليوزر أدمن، أو عنده دور "قديم" مسموح له صراحة (legacyRoles)،
// أو عنده صلاحية مخصصة (role: 'staff') على القسم ده بالمستوى المطلوب.
// ده بيتضاف فوق نظام authorize() الحالي من غير ما يغيّر سلوك أي دور موجود:
// - admin: يعدي دايماً زي ما هو.
// - call_center / packer: يعدوا بس لو مذكورين في legacyRoles (زي ما كانوا بالظبط قبل كده).
// - staff: يعدي بس لو الأدمن دّاله صلاحية على القسم ده بنفس المستوى أو أعلى.
// استخدام: access('orders', 'view', ['call_center', 'packer'])
const access = (section, level = 'view', legacyRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'لازم تسجل دخول الأول' });
    }
    const { role } = req.user;
    if (role === 'admin') return next();
    if (legacyRoles.includes(role)) return next();
    if (role === 'staff' && hasPermission(req.user, section, level)) return next();
    return res.status(403).json({ message: 'مالكش صلاحية تعمل العملية دي' });
  };
};

// بيحط req.user لو في توكن صحيح جوه الكوكي، وبيكمل عادي لو مفيش (للـ guests)
const optionalProtect = async (req, res, next) => {
  const token = getTokenFromRequest(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    // نفس تحقق tokenVersion بتاع protect() - توكن ملغي هنا لازم يتعامل زي
    // ما مفيش توكن أصلاً (guest)، مش يفضل يمرر req.user باطل.
    if (user && Number(decoded.tokenVersion || 0) === Number(user.tokenVersion || 0)) {
      req.user = user;
    }
  } catch (err) {
    // توكن غلط أو منتهي - نكمل كـ guest بدون خطأ
  }
  next();
};

module.exports = { protect, authorize, optionalProtect, access };