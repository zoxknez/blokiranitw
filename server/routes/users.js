// Users (blocked_users) routes
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { authenticateToken, ensureJson } = require('../middleware/auth');
const { requireAdmin, requireAdminIp: requireAdminIpMiddleware } = require('../middleware/admin');
const { coerceLimit, coercePage, coerceSort, coerceOrder, buildDateCondition } = require('../utils/query');
const { isAllowedProfileUrl } = require('../utils/validation');
const createAuditService = require('../services/audit');
const db = require('../db').getDb();

const router = express.Router();
const { writeAudit } = createAuditService(db);

const UserUpsertSchema = z.object({
  username: z.string().min(1).max(50),
  profile_url: z.string().url().refine(isAllowedProfileUrl, 'Only Twitter/X profile URLs are allowed')
});

// Multer configuration for file uploads
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (e) {
  console.error('Failed to create uploads directory:', e.message);
}

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

// Rate limiters
const { adminWriteLimiter } = require('../middleware/rateLimiter');
const { requireAdminIp } = require('../middleware/admin');

// Get all blocked users with pagination and search
router.get('/', (req, res) => {
  const page = coercePage(req.query.page || 1);
  const limit = coerceLimit(req.query.limit || 50);
  const search = String(req.query.search || '');
  const sort = coerceSort(req.query.sort || 'username');
  const order = coerceOrder(req.query.order || 'ASC');
  const dateRange = String(req.query.dateRange || 'all');
  const offset = (page - 1) * limit;
  
  const searchTerm = `%${search}%`;
  const dateCondition = buildDateCondition(dateRange);

  let query = `
    SELECT * FROM blocked_users 
    WHERE username LIKE ?${dateCondition}
    ORDER BY ${sort} ${order}
    LIMIT ? OFFSET ?
  `;
  
  let countQuery = `
    SELECT COUNT(*) as total FROM blocked_users 
    WHERE username LIKE ?${dateCondition}
  `;
  
  // Add timeout for database operations
  const queryTimeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Database query timeout' });
    }
  }, 25000);
  
  db.get(countQuery, [searchTerm], (err, countRow) => {
    if (err) {
      clearTimeout(queryTimeout);
      console.error('Database error in /api/users count:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    
    db.all(query, [searchTerm, parseInt(limit), parseInt(offset)], (err, rows) => {
      clearTimeout(queryTimeout);
      if (err) {
        console.error('Database error in /api/users query:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        users: rows || [],
        pagination: {
          page: page,
          limit: limit,
          total: countRow?.total || 0,
          pages: Math.ceil((countRow?.total || 0) / limit)
        }
      });
    });
  });
});

// Get user by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get("SELECT * FROM blocked_users WHERE id = ?", [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(row);
  });
});

// Add new blocked user (admin only)
router.post('/', adminWriteLimiter, authenticateToken, requireAdmin, ensureJson, (req, res) => {
  const parsed = UserUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { username, profile_url } = parsed.data;
  
  if (!username || !profile_url) {
    return res.status(400).json({ error: 'Username and profile URL are required' });
  }
  
  if (!isAllowedProfileUrl(profile_url)) {
    return res.status(400).json({ error: 'Invalid profile URL' });
  }
  
  db.run(
    "INSERT INTO blocked_users (username, profile_url) VALUES (?, ?)",
    [username, profile_url],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(409).json({ error: 'User already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      
      writeAudit('users.create', req.user?.username || 'system', username, { id: this.lastID });
      res.status(201).json({ id: this.lastID, username, profile_url });
    }
  );
});

// Update blocked user (admin only)
router.put('/:id', adminWriteLimiter, authenticateToken, requireAdmin, ensureJson, (req, res) => {
  const { id } = req.params;
  const parsed = UserUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { username, profile_url } = parsed.data;
  
  if (!isAllowedProfileUrl(profile_url)) {
    return res.status(400).json({ error: 'Invalid profile URL' });
  }
  
  db.run(
    "UPDATE blocked_users SET username = ?, profile_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [username, profile_url, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      writeAudit('users.update', req.user?.username || 'system', username, { id });
      res.json({ id, username, profile_url });
    }
  );
});

// Delete blocked user (admin only)
router.delete('/:id', adminWriteLimiter, authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.get("SELECT username FROM blocked_users WHERE id = ?", [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    db.run("DELETE FROM blocked_users WHERE id = ?", [id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      writeAudit('users.delete', req.user?.username || 'system', row.username, { id });
      res.json({ message: 'User deleted successfully' });
    });
  });
});

// Import users from JSON file (admin only)
router.post('/import', adminWriteLimiter, authenticateToken, requireAdmin, requireAdminIpMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const jsonData = JSON.parse(fileContent);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    if (!Array.isArray(jsonData)) {
      return res.status(400).json({ error: 'Invalid JSON format. Expected an array' });
    }
    
    const stmt = db.prepare("INSERT OR IGNORE INTO blocked_users (username, profile_url) VALUES (?, ?)");
    let imported = 0;
    let errors = 0;
    
    jsonData.forEach((user, index) => {
      if (!user.username || !user.profile_url || !isAllowedProfileUrl(user.profile_url)) {
        errors++;
        if (index === jsonData.length - 1) {
          stmt.finalize();
          writeAudit('users.import', req.user?.username || 'system', '', { imported, errors, total: jsonData.length });
          return res.status(201).json({ 
            message: 'Import completed', 
            imported, 
            errors, 
            total: jsonData.length 
          });
        }
        return;
      }
      
      stmt.run([user.username, user.profile_url], (err) => {
        if (err) {
          errors++;
        } else {
          imported++;
        }
        
        if (index === jsonData.length - 1) {
          stmt.finalize();
          writeAudit('users.import', req.user?.username || 'system', '', { imported, errors, total: jsonData.length });
          return res.status(201).json({ 
            message: 'Import completed', 
            imported, 
            errors, 
            total: jsonData.length 
          });
        }
      });
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Import error:', error.message);
    return res.status(500).json({ error: 'Invalid JSON file' });
  }
});

module.exports = router;

