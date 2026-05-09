const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { requireAdmin, optionalAuth } = require('../middleware/auth');

const router = express.Router();

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function parseProduct(row) {
  if (!row) return null;
  return {
    ...row,
    images: JSON.parse(row.images || '[]'),
    specifications: JSON.parse(row.specifications || '{}'),
    featured: Boolean(row.featured),
    active: Boolean(row.active),
  };
}

// GET /api/products
router.get('/', optionalAuth, (req, res) => {
  const { category, search, sort = 'created_at', page = 1, limit = 12, featured } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where = ['p.active = 1'];
  const params = [];

  if (category) {
    where.push('c.slug = ?');
    params.push(category);
  }
  if (search) {
    where.push('(p.name LIKE ? OR p.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (featured === 'true') {
    where.push('p.featured = 1');
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const orderMap = {
    created_at: 'p.created_at DESC',
    price_asc: 'p.price ASC',
    price_desc: 'p.price DESC',
    name: 'p.name ASC',
  };
  const orderBy = orderMap[sort] || 'p.created_at DESC';

  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereClause}
  `).get(...params);

  const rows = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  res.json({
    success: true,
    products: rows.map(parseProduct),
    pagination: {
      total: countRow.total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(countRow.total / Number(limit)),
    },
  });
});

// GET /api/products/:slug
router.get('/:slug', optionalAuth, (req, res) => {
  const row = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.slug = ? AND p.active = 1
  `).get(req.params.slug);

  if (!row) return res.status(404).json({ success: false, message: 'Product not found' });

  const reviews = db.prepare(`
    SELECT r.*, u.name as user_name FROM reviews r
    JOIN users u ON r.user_id = u.id
    WHERE r.product_id = ?
    ORDER BY r.created_at DESC
  `).all(row.id);

  const avgRow = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE product_id = ?').get(row.id);

  res.json({
    success: true,
    product: {
      ...parseProduct(row),
      reviews,
      rating_avg: avgRow.avg ? Number(avgRow.avg.toFixed(1)) : 0,
      review_count: avgRow.count,
    },
  });
});

// POST /api/products (admin)
router.post('/', requireAdmin, (req, res) => {
  const { name, description, price, compare_price, stock, category_id, images, specifications, featured } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ success: false, message: 'Name and price are required' });
  }

  const id = uuidv4();
  const slug = slugify(name);

  db.prepare(`
    INSERT INTO products (id, name, slug, description, price, compare_price, stock, category_id, images, specifications, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name, slug, description || null, price, compare_price || null,
    stock || 0, category_id || null,
    JSON.stringify(images || []),
    JSON.stringify(specifications || {}),
    featured ? 1 : 0
  );

  const product = parseProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
  res.status(201).json({ success: true, product });
});

// PUT /api/products/:id (admin)
router.put('/:id', requireAdmin, (req, res) => {
  const { name, description, price, compare_price, stock, category_id, images, specifications, featured, active } = req.body;
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

  db.prepare(`
    UPDATE products SET
      name = COALESCE(?, name),
      slug = COALESCE(?, slug),
      description = COALESCE(?, description),
      price = COALESCE(?, price),
      compare_price = COALESCE(?, compare_price),
      stock = COALESCE(?, stock),
      category_id = COALESCE(?, category_id),
      images = COALESCE(?, images),
      specifications = COALESCE(?, specifications),
      featured = COALESCE(?, featured),
      active = COALESCE(?, active)
    WHERE id = ?
  `).run(
    name || null,
    name ? slugify(name) : null,
    description !== undefined ? description : null,
    price !== undefined ? price : null,
    compare_price !== undefined ? compare_price : null,
    stock !== undefined ? stock : null,
    category_id !== undefined ? category_id : null,
    images !== undefined ? JSON.stringify(images) : null,
    specifications !== undefined ? JSON.stringify(specifications) : null,
    featured !== undefined ? (featured ? 1 : 0) : null,
    active !== undefined ? (active ? 1 : 0) : null,
    req.params.id
  );

  const product = parseProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
  res.json({ success: true, product });
});

// DELETE /api/products/:id (admin)
router.delete('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Product deactivated' });
});

module.exports = router;
