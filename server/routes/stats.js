// Statistics routes
const express = require('express');
const db = require('../db').getDb();

const router = express.Router();

// Get statistics
router.get('/', (req, res) => {
  // Add timeout for database operations
  const queryTimeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Database query timeout' });
    }
  }, 25000);
  
  db.get("SELECT COUNT(*) as total FROM blocked_users", (err, row) => {
    clearTimeout(queryTimeout);
    if (err) {
      console.error('Database error in /api/stats:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({
      totalUsers: row?.total || 0,
      lastUpdated: new Date().toISOString()
    });
  });
});

module.exports = router;

