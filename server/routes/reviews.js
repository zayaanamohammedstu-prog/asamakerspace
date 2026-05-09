const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { verifyToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/products/:id/reviews
router.get('/:id/reviews', optionalAuth, (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ? AND active = 1').get(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  const reviews = db.prepare(`
    SELECT r.*, u.name as user_name FROM reviews r
    JOIN users u ON r.user_id = u.id
    WHERE r.product_id = ?
    ORDER BY r.created_at DESC
  `).all(req.params.id);

  const avgRow = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE product_id = ?').get(req.params.id);

  res.json({
    success: true,
    reviews,
    rating_avg: avgRow.avg ? Number(avgRow.avg.toFixed(1)) : 0,
    review_count: avgRow.count,
  });
});

// POST /api/products/:id/reviews  (protected)
router.post('/:id/reviews', verifyToken, (req, res) => {
  const { rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
  }

  const product = db.prepare('SELECT id FROM products WHERE id = ? AND active = 1').get(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  const existing = db.prepare('SELECT id FROM reviews WHERE product_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (existing) {
    return res.status(409).json({ success: false, message: 'You have already reviewed this product' });
  }

  const id = uuidv4();
  db.prepare('INSERT INTO reviews (id, product_id, user_id, rating, comment) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.params.id, req.user.id, Number(rating), comment || null);

  const review = db.prepare(`
    SELECT r.*, u.name as user_name FROM reviews r
    JOIN users u ON r.user_id = u.id WHERE r.id = ?
  `).get(id);

  res.status(201).json({ success: true, review });
});

module.exports = router;
