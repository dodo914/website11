const User = require('../models/User');
const Order = require('../models/Order');
const { parsePagination, buildListResponse } = require('../utils/pagination');

// GET /api/customers  (أدمن بس) - كل العملاء اللي عندهم حساب + عدد ومجموع طلباتهم
const getCustomers = async (req, res) => {
  try {
    const { isPaginated, page, limit, skip } = parsePagination(req.query, { maxLimit: 200, defaultLimit: 50, hardCap: 1000 });

    const filter = { role: 'customer' };
    if (req.query.search) {
      const term = String(req.query.search).trim();
      if (term) {
        const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
      }
    }

    const [customers, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const customerIds = customers.map((c) => c._id);

    const orderStats = customerIds.length
      ? await Order.aggregate([
          { $match: { customerId: { $in: customerIds } } },
          {
            $group: {
              _id: '$customerId',
              ordersCount: { $sum: 1 },
              totalSpent: { $sum: '$totalAmount' },
              lastOrderAt: { $max: '$createdAt' },
            },
          },
        ])
      : [];

    const statsMap = {};
    orderStats.forEach((s) => {
      statsMap[String(s._id)] = s;
    });

    const enriched = customers.map((c) => {
      const stats = statsMap[String(c._id)];
      return {
        ...c,
        ordersCount: stats ? stats.ordersCount : 0,
        totalSpent: stats ? stats.totalSpent : 0,
        lastOrderAt: stats ? stats.lastOrderAt : null,
      };
    });

    res.json(buildListResponse({ isPaginated, page, limit, items: enriched, total }));
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب بيانات العملاء'});
  }
};

// GET /api/customers/:id/orders  (أدمن بس) - كل طلبات عميل معين
const getCustomerOrders = async (req, res) => {
  try {
    const customer = await User.findOne({ _id: req.params.id, role: 'customer' }).select('-password');
    if (!customer) {
      return res.status(404).json({ message: 'العميل مش موجود' });
    }

    const { isPaginated, page, limit, skip } = parsePagination(req.query, { maxLimit: 100, defaultLimit: 50 });
    const filter = { customerId: req.params.id };

    if (!isPaginated) {
      const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(500).lean();
      return res.json({ customer, orders });
    }

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);

    res.json({ customer, orders: buildListResponse({ isPaginated: true, page, limit, items: orders, total }) });
  } catch (err) {
    console.error('Error fetching customer orders:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب طلبات العميل'});
  }
};

// GET /api/customers/segments  (أدمن بس)
// يحسب شرائح العملاء الجاهزة: عملاء جدد / عائدون / VIP / كتير الإنفاق / غير نشطين / متكررو الشراء
// بناءً على بيانات الطلبات الحقيقية - مفيش أي بيانات وهمية.
const getCustomerSegments = async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' }).select('-password').lean();
    const customerIds = customers.map((c) => c._id);

    const orderStats = await Order.aggregate([
      { $match: { customerId: { $in: customerIds } } },
      {
        $group: {
          _id: '$customerId',
          ordersCount: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
          lastOrderAt: { $max: '$createdAt' },
        },
      },
    ]);

    const statsMap = {};
    orderStats.forEach((s) => { statsMap[String(s._id)] = s; });

    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

    // ===== حدود الشرائح: نسبية على متوسط إنفاق العملاء (بدون قيم وهمية ثابتة) =====
    const spentValues = orderStats.map((s) => s.totalSpent || 0).filter((v) => v > 0);
    const avgSpent = spentValues.length > 0 ? spentValues.reduce((a, b) => a + b, 0) / spentValues.length : 0;
    const vipThreshold = avgSpent > 0 ? avgSpent * 2 : 0;
    const highSpenderThreshold = avgSpent > 0 ? avgSpent * 1.2 : 0;

    const segments = {
      newCustomers: [],
      returningCustomers: [],
      vip: [],
      highSpenders: [],
      inactiveCustomers: [],
      frequentBuyers: [],
    };

    customers.forEach((c) => {
      const stats = statsMap[String(c._id)] || { ordersCount: 0, totalSpent: 0, lastOrderAt: null };
      const entry = { _id: c._id, name: c.name, email: c.email, phone: c.phone, ordersCount: stats.ordersCount, totalSpent: stats.totalSpent || 0, lastOrderAt: stats.lastOrderAt };

      if (stats.ordersCount === 0) {
        segments.newCustomers.push(entry);
        return;
      }
      if (stats.ordersCount === 1) segments.newCustomers.push(entry);
      if (stats.ordersCount >= 2) segments.returningCustomers.push(entry);
      if (stats.ordersCount >= 4) segments.frequentBuyers.push(entry);
      if (vipThreshold > 0 && stats.totalSpent >= vipThreshold) segments.vip.push(entry);
      else if (highSpenderThreshold > 0 && stats.totalSpent >= highSpenderThreshold) segments.highSpenders.push(entry);

      const lastOrderTime = stats.lastOrderAt ? new Date(stats.lastOrderAt).getTime() : null;
      if (lastOrderTime && (now - lastOrderTime) > NINETY_DAYS) {
        segments.inactiveCustomers.push(entry);
      }
    });

    res.json({
      summary: {
        newCustomers: segments.newCustomers.length,
        returningCustomers: segments.returningCustomers.length,
        vip: segments.vip.length,
        highSpenders: segments.highSpenders.length,
        inactiveCustomers: segments.inactiveCustomers.length,
        frequentBuyers: segments.frequentBuyers.length,
      },
      segments,
    });
  } catch (err) {
    console.error('Error computing customer segments:', err);
    res.status(500).json({ message: 'حصل خطأ في حساب شرائح العملاء'});
  }
};

module.exports = { getCustomers, getCustomerOrders, getCustomerSegments };