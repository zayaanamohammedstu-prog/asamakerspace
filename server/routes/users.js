const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/admin/users
router.get('/', requireAdmin, (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where = '';
  const params = [];
  if (search) {
    where = 'WHERE name LIKE ? OR email LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM users ${where}`).get(...params).c;
  const users = db.prepare(`
    SELECT id, name, email, role, phone, address, created_at FROM users
    ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  res.json({ success: true, users, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

// GET /api/admin/users/:id
router.get('/:id', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, phone, address, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const orders = db.prepare('SELECT id, status, total, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(req.params.id);
  res.json({ success: true, user, orders });
});

// PUT /api/admin/users/:id
router.put('/:id', requireAdmin, (req, res) => {
  const { name, phone, address, role } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const validRoles = ['customer', 'admin'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }

  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      address = COALESCE(?, address),
      role = COALESCE(?, role)
    WHERE id = ?
  `).run(name || null, phone || null, address || null, role || null, req.params.id);

  const updated = db.prepare('SELECT id, name, email, role, phone, address, created_at FROM users WHERE id = ?').get(req.params.id);
  res.json({ success: true, user: updated });
});

// DELETE /api/admin/users/:id
router.delete('/:id', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (user.role === 'admin') {
    return res.status(400).json({ success: false, message: 'Cannot delete an admin account' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'User deleted' });
});

module.exports = router;
