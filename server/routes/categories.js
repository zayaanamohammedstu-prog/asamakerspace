const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// GET /api/categories
router.get('/', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  res.json({ success: true, categories });
});

// GET /api/categories/:slug
router.get('/:slug', (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE slug = ?').get(req.params.slug);
  if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

  const products = db.prepare(`
    SELECT * FROM products WHERE category_id = ? AND active = 1 ORDER BY created_at DESC
  `).all(category.id).map(p => ({
    ...p,
    images: JSON.parse(p.images || '[]'),
    specifications: JSON.parse(p.specifications || '{}'),
    featured: Boolean(p.featured),
    active: Boolean(p.active),
  }));

  res.json({ success: true, category, products });
});

// POST /api/categories (admin)
router.post('/', requireAdmin, (req, res) => {
  const { name, description, image_url } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });

  const id = uuidv4();
  const slug = slugify(name);

  db.prepare('INSERT INTO categories (id, name, slug, description, image_url) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, slug, description || null, image_url || null);

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  res.status(201).json({ success: true, category });
});

// PUT /api/categories/:id (admin)
router.put('/:id', requireAdmin, (req, res) => {
  const { name, description, image_url } = req.body;
  const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Category not found' });

  db.prepare(`
    UPDATE categories SET
      name = COALESCE(?, name),
      slug = COALESCE(?, slug),
      description = COALESCE(?, description),
      image_url = COALESCE(?, image_url)
    WHERE id = ?
  `).run(
    name || null,
    name ? slugify(name) : null,
    description !== undefined ? description : null,
    image_url !== undefined ? image_url : null,
    req.params.id
  );

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  res.json({ success: true, category });
});

// DELETE /api/categories/:id (admin)
router.delete('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Category not found' });

  const productCount = db.prepare('SELECT COUNT(*) as c FROM products WHERE category_id = ? AND active = 1').get(req.params.id);
  if (productCount.c > 0) {
    return res.status(409).json({ success: false, message: 'Cannot delete category with active products' });
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Category deleted' });
});

module.exports = router;
