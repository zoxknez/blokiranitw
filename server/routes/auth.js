// Authentication routes
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db').getDb();

const router = express.Router();

router.post('/api/auth/register', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    db.get("SELECT * FROM admin_users WHERE username = ? OR email = ?", [username, email], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (row) {
        return res.status(400).json({ error: 'User already exists' });
      }

      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      db.run(
        "INSERT INTO admin_users (username, email, password_hash) VALUES (?, ?, ?)",
        [username, email, passwordHash],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          const token = jwt.sign(
            { id: this.lastID, username, email, role: 'admin' },
            config.JWT_SECRET,
            { expiresIn: '24h' }
          );

          res.status(201).json({
            message: 'User created successfully',
            token,
            user: { id: this.lastID, username, email, role: 'admin' }
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/api/auth/login', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    db.get("SELECT * FROM admin_users WHERE username = ?", [username], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!row) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, row.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      db.run("UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [row.id]);

      const token = jwt.sign(
        { id: row.id, username: row.username, email: row.email, role: row.role },
        config.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: { id: row.id, username: row.username, email: row.email, role: row.role }
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

