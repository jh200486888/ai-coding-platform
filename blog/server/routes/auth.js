const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getDB } = require('../db/database');

// Simple password hashing (for demo; use bcrypt in production)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'blog-salt').digest('hex');
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const db = getDB();
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || user.password_hash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Simple token (for demo; use JWT in production)
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('UPDATE users SET token = ? WHERE id = ?').run(token, user.id);

  res.json({
    token,
    user: { id: user.id, username: user.username, display_name: user.display_name }
  });
});

// POST /api/auth/register (first-run setup)
router.post('/register', (req, res) => {
  const db = getDB();
  const { username, password, display_name } = req.body;

  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existing.count > 0) {
    return res.status(403).json({ error: 'Registration closed. Only one admin allowed.' });
  }

  const hash = hashPassword(password);
  db.prepare('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)')
    .run(username, hash, display_name || username);

  res.status(201).json({ success: true });
});

module.exports = router;
