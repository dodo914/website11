// شغل السكريبت ده مرة واحدة بس: npm run seed:admin
// بيقرأ بيانات الأدمن من ملف .env وبيعمل حساب أدمن حقيقي بباسورد مشفّر في الداتا بيز
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

dotenv.config();

(async () => {
  await connectDB();

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const phone = process.env.SEED_ADMIN_PHONE;

  if (!email || !password || !phone) {
    console.error('❌ لازم تحط SEED_ADMIN_EMAIL و SEED_ADMIN_PASSWORD و SEED_ADMIN_PHONE في ملف .env الأول');
    process.exit(1);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.log('⚠️ فيه حساب بالإيميل ده بالفعل، مفيش حاجة اتعملت.');
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({
    name: 'Store Admin',
    email,
    phone,
    password: hashedPassword,
    role: 'admin',
  });

  console.log('✅ اتعمل حساب الأدمن بنجاح. سجل دخول بالإيميل والباسورد اللي حطيتهم في .env');
  process.exit(0);
})();
