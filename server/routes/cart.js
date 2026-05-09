const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

function getCartWithProducts(userId) {
  return db.prepare(`
    SELECT ci.id, ci.quantity, ci.created_at,
           p.id as product_id, p.name, p.price, p.compare_price, p.stock, p.images, p.slug
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    WHERE ci.user_id = ? AND p.active = 1
    ORDER BY ci.created_at DESC
  `).all(userId).map(row => ({
    id: row.id,
    quantity: row.quantity,
    created_at: row.created_at,
    product: {
      id: row.product_id,
      name: row.name,
      price: row.price,
      compare_price: row.compare_price,
      stock: row.stock,
      slug: row.slug,
      images: JSON.parse(row.images || '[]'),
    },
  }));
}

// GET /api/cart
router.get('/', verifyToken, (req, res) => {
  const items = getCartWithProducts(req.user.id);
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  res.json({ success: true, items, subtotal });
});

// POST /api/cart
router.post('/', verifyToken, (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  if (!product_id) return res.status(400).json({ success: false, message: 'product_id is required' });

  const product = db.prepare('SELECT id, stock FROM products WHERE id = ? AND active = 1').get(product_id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  const existing = db.prepare('SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?').get(req.user.id, product_id);

  if (existing) {
    const newQty = existing.quantity + Number(quantity);
    if (newQty > product.stock) {
      return res.status(400).json({ success: false, message: 'Not enough stock' });
    }
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(newQty, existing.id);
  } else {
    if (Number(quantity) > product.stock) {
      return res.status(400).json({ success: false, message: 'Not enough stock' });
    }
    db.prepare('INSERT INTO cart_items (id, user_id, product_id, quantity) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), req.user.id, product_id, Number(quantity));
  }

  const items = getCartWithProducts(req.user.id);
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  res.json({ success: true, items, subtotal });
});

// PUT /api/cart/:id
router.put('/:id', verifyToken, (req, res) => {
  const { quantity } = req.body;
  if (!quantity || Number(quantity) < 1) {
    return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
  }

  const item = db.prepare('SELECT ci.*, p.stock FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.id = ? AND ci.user_id = ?')
    .get(req.params.id, req.user.id);
  if (!item) return res.status(404).json({ success: false, message: 'Cart item not found' });

  if (Number(quantity) > item.stock) {
    return res.status(400).json({ success: false, message: 'Not enough stock' });
  }

  db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(Number(quantity), req.params.id);

  const items = getCartWithProducts(req.user.id);
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  res.json({ success: true, items, subtotal });
});

// DELETE /api/cart/:id
router.delete('/:id', verifyToken, (req, res) => {
  const item = db.prepare('SELECT id FROM cart_items WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!item) return res.status(404).json({ success: false, message: 'Cart item not found' });

  db.prepare('DELETE FROM cart_items WHERE id = ?').run(req.params.id);

  const items = getCartWithProducts(req.user.id);
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  res.json({ success: true, items, subtotal });
});

// DELETE /api/cart  — clear entire cart
router.delete('/', verifyToken, (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
  res.json({ success: true, items: [], subtotal: 0 });
});

module.exports = router;
