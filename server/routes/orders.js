const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/orders  — current user's orders
router.get('/', verifyToken, (req, res) => {
  const orders = db.prepare(`
    SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC
  `).all(req.user.id).map(o => ({
    ...o,
    items: JSON.parse(o.items || '[]'),
    shipping_address: JSON.parse(o.shipping_address || '{}'),
  }));
  res.json({ success: true, orders });
});

// GET /api/orders/:id
router.get('/:id', verifyToken, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (order.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  res.json({
    success: true,
    order: {
      ...order,
      items: JSON.parse(order.items || '[]'),
      shipping_address: JSON.parse(order.shipping_address || '{}'),
    },
  });
});

// POST /api/orders  — create order
router.post('/', verifyToken, (req, res) => {
  const { items, shipping_address, payment_method, notes } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Order items are required' });
  }

  let subtotal = 0;
  const enrichedItems = [];

  for (const item of items) {
    const product = db.prepare('SELECT id, name, price, stock FROM products WHERE id = ? AND active = 1').get(item.product_id);
    if (!product) {
      return res.status(400).json({ success: false, message: `Product not found: ${item.product_id}` });
    }
    if (product.stock < item.quantity) {
      return res.status(400).json({ success: false, message: `Insufficient stock for: ${product.name}` });
    }
    subtotal += product.price * item.quantity;
    enrichedItems.push({ product_id: product.id, name: product.name, price: product.price, quantity: item.quantity });
  }

  const shipping_cost = subtotal >= 150 ? 0 : 10;
  const total = subtotal + shipping_cost;
  const id = uuidv4();

  db.prepare(`
    INSERT INTO orders (id, user_id, total, subtotal, shipping_cost, items, shipping_address, payment_method, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.user.id, total, subtotal, shipping_cost,
    JSON.stringify(enrichedItems),
    JSON.stringify(shipping_address || {}),
    payment_method || 'online',
    notes || null
  );

  // Deduct stock
  for (const item of enrichedItems) {
    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.product_id);
  }

  // Clear user cart
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  res.status(201).json({
    success: true,
    order: {
      ...order,
      items: JSON.parse(order.items),
      shipping_address: JSON.parse(order.shipping_address),
    },
  });
});

// PUT /api/orders/:id/cancel  — user cancel
router.put('/:id/cancel', verifyToken, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (order.user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied' });
  if (!['pending', 'processing'].includes(order.status)) {
    return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage' });
  }

  db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(order.id);

  // Restore stock
  const items = JSON.parse(order.items || '[]');
  for (const item of items) {
    db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.product_id);
  }

  res.json({ success: true, message: 'Order cancelled' });
});

// GET /api/admin/orders  (mounted via admin router, but declared here too for convenience)
router.get('/admin/all', requireAdmin, (req, res) => {
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
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset).map(o => ({
    ...o,
    items: JSON.parse(o.items || '[]'),
    shipping_address: JSON.parse(o.shipping_address || '{}'),
  }));

  res.json({ success: true, orders, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

// PUT /api/admin/orders/:id/status
router.put('/admin/:id/status', requireAdmin, (req, res) => {
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

module.exports = router;
