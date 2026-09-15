const jwt = require('jsonwebtoken');

// ===== P1-5 (Part B) — بنحط tokenVersion الحالي بتاع اليوزر جوه التوكن نفسه.
// middleware/auth.js بيقارنها بالقيمة الحالية في الداتابيز على كل طلب؛ أي
// عملية تلغي التوكنات القديمة (logout / تغيير باسورد / تغيير بيانات أمان
// الأدمن) بتزوّد tokenVersion في الداتابيز، فالتوكن القديم (اللي لسه شايل
// الرقم القديم) يبقى مرفوض فورًا حتى لو توقيعه ومدته لسه صحيحين. =====
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = generateToken;