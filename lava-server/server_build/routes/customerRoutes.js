const express = require('express');
const router = express.Router();
const { getCustomers, getCustomerOrders, getCustomerSegments } = require('../controllers/customerController');
const { protect, access } = require('../middleware/auth');

router.use(protect);
router.get('/', access('customers', 'view'), getCustomers);
router.get('/segments', access('customer_segments', 'view'), getCustomerSegments);
router.get('/:id/orders', access('customers', 'view'), getCustomerOrders);

module.exports = router;