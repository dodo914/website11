const express = require('express');
const router = express.Router();
const { getStaff, getSections, addStaff, updateStaff, removeStaff } = require('../controllers/staffController');
const { protect, authorize } = require('../middleware/auth');

// إدارة الموظفين (إضافة/حذف/تعديل صلاحيات) تفضل للأدمن بس دايماً — عشان مفيش موظف
// يقدر يدي نفسه أو غيره صلاحيات أعلى من اللي الأدمن حدده له.
router.use(protect, authorize('admin'));
router.get('/sections', getSections);
router.get('/', getStaff);
router.post('/', addStaff);
router.patch('/:id', updateStaff);
router.delete('/:id', removeStaff);

module.exports = router;