const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { logActivity } = require('../utils/activityLogger');
const { validatePasswordStrength, isValidEmail, isValidPhone, validateName } = require('../utils/validators');
const { SECTIONS, sanitizePermissions } = require('../utils/permissions');

const STAFF_ROLES = ['call_center', 'packer', 'staff'];

const staffLabel = (role) => {
  if (role === 'packer') return 'باكر';
  if (role === 'staff') return 'صلاحيات مخصصة';
  return 'كول سنتر';
};

// GET /api/staff  (أدمن بس)
const getStaff = async (req, res) => {
  const staff = await User.find({ role: { $in: STAFF_ROLES } }).select('-password');
  res.json(staff);
};

// GET /api/staff/sections  (أدمن بس) — قائمة الأقسام المتاحة عشان الأدمن يختار منها وقت إضافة/تعديل موظف
const getSections = async (req, res) => {
  res.json(SECTIONS);
};

// POST /api/staff  (أدمن بس)
const addStaff = async (req, res) => {
  try {
    const { name, email, phone, password, role, permissions } = req.body;
    if (!name || !email || !password || !STAFF_ROLES.includes(role)) {
      return res.status(400).json({ message: 'بيانات ناقصة أو الدور غلط' });
    }

    const nameError = validateName(name);
    if (nameError) return res.status(400).json({ message: nameError });

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'البريد الإلكتروني غير صحيح' });
    }

    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ message: 'رقم الهاتف غير صحيح' });
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    let cleanPermissions = [];
    if (role === 'staff') {
      try {
        cleanPermissions = sanitizePermissions(permissions);
      } catch (permErr) {
        return res.status(400).json({ message: permErr.message });
      }
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'البريد مستخدم بالفعل' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const staff = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      permissions: role === 'staff' ? cleanPermissions : [],
    });

    logActivity(req, {
      action: 'create',
      entityType: 'staff',
      entityId: staff._id,
      entityLabel: staff.name,
      description: `${req.user?.name || 'أدمن'} أضاف موظف جديد "${staff.name}" (${staffLabel(role)})`,
    });

    res.status(201).json({
      id: staff._id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      permissions: staff.permissions,
    });
  } catch (err) {
    console.error('Error adding staff member:', err);
    res.status(500).json({ message: 'حصل خطأ في إضافة الموظف'});
  }
};

// PATCH /api/staff/:id  (أدمن بس) — لتعديل صلاحيات موظف "staff" (وممكن تعديل الاسم/الهاتف كمان)
const updateStaff = async (req, res) => {
  try {
    const staff = await User.findOne({ _id: req.params.id, role: { $in: STAFF_ROLES } });
    if (!staff) return res.status(404).json({ message: 'الموظف مش موجود' });

    const { name, phone, permissions } = req.body;

    if (name !== undefined) {
      const nameError = validateName(name);
      if (nameError) return res.status(400).json({ message: nameError });
      staff.name = name;
    }

    if (phone !== undefined) {
      if (phone && !isValidPhone(phone)) {
        return res.status(400).json({ message: 'رقم الهاتف غير صحيح' });
      }
      staff.phone = phone;
    }

    if (permissions !== undefined) {
      if (staff.role !== 'staff') {
        return res.status(400).json({ message: 'الصلاحيات المخصصة متاحة بس لموظفي "صلاحيات مخصصة"' });
      }
      try {
        staff.permissions = sanitizePermissions(permissions);
      } catch (permErr) {
        return res.status(400).json({ message: permErr.message });
      }
    }

    await staff.save();

    logActivity(req, {
      action: 'update',
      entityType: 'staff',
      entityId: staff._id,
      entityLabel: staff.name,
      description: `${req.user?.name || 'أدمن'} عدّل بيانات/صلاحيات الموظف "${staff.name}"`,
    });

    res.json({
      id: staff._id,
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      role: staff.role,
      permissions: staff.permissions,
    });
  } catch (err) {
    console.error('Error updating staff member:', err);
    res.status(500).json({ message: 'حصل خطأ في تعديل الموظف'});
  }
};

// DELETE /api/staff/:id  (أدمن بس)
const removeStaff = async (req, res) => {
  const staff = await User.findOne({ _id: req.params.id, role: { $in: STAFF_ROLES } });
  if (!staff) return res.status(404).json({ message: 'الموظف مش موجود' });
  await staff.deleteOne();

  logActivity(req, {
    action: 'delete',
    entityType: 'staff',
    entityId: staff._id,
    entityLabel: staff.name,
    description: `${req.user?.name || 'أدمن'} حذف الموظف "${staff.name}"`,
  });

  res.json({ message: 'اتمسح بنجاح' });
};

module.exports = { getStaff, getSections, addStaff, updateStaff, removeStaff };