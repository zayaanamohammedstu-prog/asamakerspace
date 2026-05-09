const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password, phone, address } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email already registered' });
  }

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, name, email, password, role, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, name, email.toLowerCase(), hash, 'customer', phone || null, address || null);

  const user = db.prepare('SELECT id, name, email, role, phone, address, created_at FROM users WHERE id = ?').get(id);
  const token = generateToken(user);
  res.status(201).json({ success: true, token, user });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  const { password: _, ...safeUser } = user;
  const token = generateToken(user);
  res.json({ success: true, token, user: safeUser });
});

// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, phone, address, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json({ success: true, user });
});

// PUT /api/auth/profile
router.put('/profile', verifyToken, (req, res) => {
  const { name, phone, address, currentPassword, newPassword } = req.body;

  if (newPassword) {
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }
    const row = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(currentPassword || '', row.password)) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  }

  db.prepare('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE id = ?')
    .run(name || null, phone || null, address || null, req.user.id);

  const user = db.prepare('SELECT id, name, email, role, phone, address, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json({ success: true, user });
});

module.exports = router;
