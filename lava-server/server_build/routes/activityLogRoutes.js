const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('../controllers/activityLogController');
const { protect, access } = require('../middleware/auth');

router.use(protect);
router.get('/', access('activity_log', 'view'), getActivityLogs);

module.exports = router;