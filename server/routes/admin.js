// Admin routes
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const createAuditService = require('../services/audit');
const dbModule = require('../db');

const router = express.Router();

function getDb() {
  return dbModule.getDb();
}

function getAuditService() {
  return createAuditService(getDb());
}

// Rate limiters
const { adminWriteLimiter } = require('../middleware/rateLimiter');

// Get audit logs
router.get('/audit', authenticateToken, requireAdmin, (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  const query = `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const countQuery = `SELECT COUNT(*) as total FROM audit_logs`;

  const db = getDb();
  db.get(countQuery, [], (err, countRow) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    db.all(query, [limit, offset], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({
        logs: rows.map(row => ({
          id: row.id,
          action: row.action,
          actor: row.actor,
          target: row.target,
          details: row.details ? JSON.parse(row.details) : null,
          created_at: row.created_at
        })),
        pagination: {
          page,
          limit,
          total: countRow?.total || 0,
          pages: Math.ceil((countRow?.total || 0) / limit)
        }
      });
    });
  });
});

// Get suggestions for admin review
router.get('/suggestions', authenticateToken, requireAdmin, (req, res) => {
  const status = String(req.query.status || 'pending');
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;
  
  let query = `
    SELECT * FROM user_suggestions 
    WHERE status = ? 
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  
  let countQuery = `
    SELECT COUNT(*) as total FROM user_suggestions 
    WHERE status = ?
  `;
  
  const db = getDb();
  db.get(countQuery, [status], (err, countRow) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    db.all(query, [status, parseInt(limit), parseInt(offset)], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      res.json({
        suggestions: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countRow.total,
          pages: Math.ceil(countRow.total / limit)
        }
      });
    });
  });
});

// Approve suggestion
router.put('/suggestions/:id/approve', adminWriteLimiter, authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { username } = req.user;
  
  // First get the suggestion
  const db = getDb();
  db.get("SELECT * FROM user_suggestions WHERE id = ?", [id], (err, sug) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!sug) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }
    
    if (sug.status !== 'pending') {
      return res.status(400).json({ error: 'Suggestion already processed' });
    }
    
    let addedToBlocked = false;
    
    // Add to blocked users
    db.run(
      "INSERT OR IGNORE INTO blocked_users (username, profile_url) VALUES (?, ?)",
      [sug.username, sug.profile_url],
      function(insertErr) {
        if (insertErr) {
          return res.status(500).json({ error: insertErr.message });
        }
        
        // Check if row was actually inserted (this.changes > 0 means new row)
        addedToBlocked = this.changes > 0;
        
        // Update suggestion status
        db.run(
          "UPDATE user_suggestions SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE id = ?",
          [username, id],
          function(updateErr) {
            if (updateErr) {
              return res.status(500).json({ error: updateErr.message });
            }
            
            getAuditService().writeAudit('suggestions.approve', username, String(id), { addedToBlocked });
            res.json({
              message: 'Suggestion approved',
              addedToBlocked
            });
          }
        );
      }
    );
  });
});

// Reject suggestion
router.put('/suggestions/:id/reject', adminWriteLimiter, authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { username } = req.user;
  
  const db = getDb();
  db.run(
    "UPDATE user_suggestions SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE id = ?",
    [username, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Suggestion not found' });
      }
      
      getAuditService().writeAudit('suggestions.reject', username, String(id), {});
      res.json({ message: 'Suggestion rejected' });
    }
  );
});

module.exports = router;

