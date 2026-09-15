const ActivityLog = require('../models/ActivityLog');

// GET /api/activity-logs (أدمن بس)
// يدعم فلترة اختيارية: ?entityType=product&action=update&userId=...&limit=50&page=1
const getActivityLogs = async (req, res) => {
  try {
    const { entityType, action, userId, limit, page } = req.query;
    const filter = {};
    if (entityType) filter.entityType = entityType;
    if (action) filter.action = action;
    if (userId) filter.userId = userId;

    const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const pageNum = Math.max(1, parseInt(page, 10) || 1);

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);

    res.json({ logs, total, page: pageNum, pageSize });
  } catch (err) {
    console.error('Error fetching activity logs:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب سجل النشاط'});
  }
};

module.exports = { getActivityLogs };