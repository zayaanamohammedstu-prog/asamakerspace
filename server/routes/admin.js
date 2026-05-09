const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const orderRoutes = require('./orders');
const userRoutes = require('./users');

const router = express.Router();

// GET /api/admin/stats
router.get('/stats', requireAdmin, (req, res) => {
  const totalRevenue = db.prepare(
    "SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE status != 'cancelled'"
  ).get().revenue;

  const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const pendingOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").get().c;
  const processingOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'processing'").get().c;

  const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'customer'").get().c;
  const totalProducts = db.prepare('SELECT COUNT(*) as c FROM products WHERE active = 1').get().c;
  const lowStockProducts = db.prepare('SELECT COUNT(*) as c FROM products WHERE stock <= 5 AND active = 1').get().c;

  const recentOrders = db.prepare(`
    SELECT o.id, o.status, o.total, o.created_at, u.name as user_name, u.email as user_email
    FROM orders o JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC LIMIT 5
  `).all();

  const topProducts = db.prepare(`
    SELECT p.id, p.name, p.price, p.stock,
      COUNT(o.id) as order_count
    FROM products p
    LEFT JOIN orders o ON o.items LIKE '%' || p.id || '%'
    WHERE p.active = 1
    GROUP BY p.id
    ORDER BY order_count DESC
    LIMIT 5
  `).all();

  const monthlySales = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month,
           COUNT(*) as orders,
           SUM(total) as revenue
    FROM orders
    WHERE status != 'cancelled'
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `).all();

  res.json({
    success: true,
    stats: {
      totalRevenue,
      totalOrders,
      pendingOrders,
      processingOrders,
      totalUsers,
      totalProducts,
      lowStockProducts,
    },
    recentOrders,
    topProducts,
    monthlySales: monthlySales.reverse(),
  });
});

// Mount admin-scoped order and user routes
router.get('/orders', requireAdmin, (req, res, next) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  let where = '';
  const params = [];
  if (status) {
    where = 'WHERE o.status = ?';
    params.push(status);
  }
  const total = db.prepare(`SELECT COUNT(*) as c FROM orders o ${where}`).get(...params).c;
  const orders = db.prepare(`
    SELECT o.*, u.name as user_name, u.email as user_email
    FROM orders o JOIN users u ON o.user_id = u.id
    ${where}
    ORDER BY o.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset).map(o => ({
    ...o,
    items: JSON.parse(o.items || '[]'),
    shipping_address: JSON.parse(o.shipping_address || '{}'),
  }));
  res.json({ success: true, orders, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

router.put('/orders/:id/status', requireAdmin, (req, res) => {
  const { status, payment_status } = req.body;
  const valid = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (status && !valid.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  db.prepare(`
    UPDATE orders SET
      status = COALESCE(?, status),
      payment_status = COALESCE(?, payment_status),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(status || null, payment_status || null, req.params.id);

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  res.json({
    success: true,
    order: {
      ...updated,
      items: JSON.parse(updated.items || '[]'),
      shipping_address: JSON.parse(updated.shipping_address || '{}'),
    },
  });
});

router.use('/users', userRoutes);

module.exports = router;
