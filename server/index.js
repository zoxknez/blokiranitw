const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// helmet is optional; set critical headers manually to avoid runtime deps issues
// Lightweight rate limiter (no external deps)
const { randomUUID } = require('crypto');
const { z } = require('zod');

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SUPABASE_JWKS_URL = process.env.SUPABASE_JWKS_URL || 'https://kvbppgfwqnwvwubaendh.supabase.co/auth/v1/keys';
const CAPTCHA_PROVIDER = (process.env.CAPTCHA_PROVIDER || '').toLowerCase(); // 'turnstile' | 'recaptcha'
const CAPTCHA_SECRET = process.env.CAPTCHA_SECRET || '';
const CAPTCHA_REQUIRED = (process.env.CAPTCHA_REQUIRED || 'false') === 'true';

// Early boot log
try { console.log(`Booting API process. HOST=${HOST} PORT=${PORT}`); } catch {}

// Middleware
app.disable('x-powered-by');
app.use((req, res, next) => {
  // Security headers similar to helmet defaults
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  // CSP tuned for our app and Turnstile widget
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' *",
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  next();
});
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});
app.use((req, res, next) => {
  req.id = randomUUID();
  next();
});
// Lightweight request logger (avoid extra deps in runtime)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    try {
      const ms = Date.now() - start;
      // Basic log; redact auth header
      const ua = req.headers['user-agent'] || '';
      console.log(`[${req.id}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms UA:${ua.substring(0,80)}`);
    } catch {}
  });
  next();
});
// Basic param pollution guard: collapse array params to first value
app.use((req, res, next) => {
  for (const key of Object.keys(req.query)) {
    const val = req.query[key];
    if (Array.isArray(val)) {
      req.query[key] = val[0];
    }
  }
  next();
});
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: ALLOWED_ORIGIN === '*' ? true : [ALLOWED_ORIGIN], credentials: false }));
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));

// Alert webhook
const LOG_WEBHOOK_URL = process.env.LOG_WEBHOOK_URL || '';
async function sendAlert(payload) {
  try {
    if (!LOG_WEBHOOK_URL) return;
    await fetch(LOG_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  } catch {}
}

// Simple in-memory rate limiter (per-process)
function createRateLimiter(windowMs, max) {
  const hits = new Map(); // key -> [timestamps]
  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const arr = hits.get(key) || [];
    const fresh = arr.filter(ts => now - ts < windowMs);
    fresh.push(now);
    hits.set(key, fresh);
    if (fresh.length > max) {
      sendAlert({ type: 'rate-limit', path: req.path, ip: req.ip, reqId: req.id, limit: max });
      return res.status(429).json({ error: 'Too many requests' });
    }
    next();
  };
}

// Global rate limit (basic DoS protection)
app.use(createRateLimiter(60 * 1000, 300));

// Per-route stricter limits
const authLimiter = createRateLimiter(5 * 60 * 1000, 50);
const suggestLimiter = createRateLimiter(60 * 1000, 30);
const adminWriteLimiter = createRateLimiter(60 * 1000, 20);

// Trust proxy for correct IP and HTTPS detection
app.set('trust proxy', 1);
const FORCE_HTTPS = (process.env.FORCE_HTTPS || 'true') === 'true';
if (FORCE_HTTPS) {
  app.use((req, res, next) => {
    if (req.path === '/api/health' || req.path === '/') return next();
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, 'https://' + req.headers.host + req.originalUrl);
    }
    next();
  });
}

// Auth middleware: verify Supabase JWT via JWKS
let jwksCache = null;
async function getJWKS() {
  try {
    if (jwksCache && (Date.now() - jwksCache.fetchedAt < 60 * 60 * 1000)) {
      return jwksCache.keys;
    }
    const res = await fetch(SUPABASE_JWKS_URL);
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
    const data = await res.json();
    jwksCache = { keys: Array.isArray(data.keys) ? data.keys : [], fetchedAt: Date.now() };
    return jwksCache.keys;
  } catch (e) {
    try { console.error('JWKS Error:', e?.message || e); } catch {}
    return [];
  }
}

function getKey(header, callback) {
  getJWKS()
    .then((keys) => {
      const signingKey = keys.find(k => k.kid === header.kid);
      if (!signingKey) return callback(new Error('No matching JWK'));
      const cert = signingKey.x5c?.[0];
      if (cert) {
        const pem = `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----\n`;
        callback(null, pem);
      } else {
        callback(new Error('Invalid JWK'));
      }
    })
    .catch((err) => callback(err));
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, payload) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = { id: payload.sub, username: payload.user_metadata?.username || payload.email };
    next();
  });
};

// Ensure JSON content-type for JSON routes
function ensureJson(req, res, next) {
  if (!req.is('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type' });
  }
  next();
}

async function verifyCaptcha(token, ip) {
  if (!CAPTCHA_REQUIRED) return true;
  if (!CAPTCHA_SECRET) return false;
  try {
    if (CAPTCHA_PROVIDER === 'turnstile') {
      const params = new URLSearchParams();
      params.append('secret', CAPTCHA_SECRET);
      params.append('response', token || '');
      if (ip) params.append('remoteip', ip);
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: params });
      const data = await r.json();
      return !!data.success;
    }
    if (CAPTCHA_PROVIDER === 'recaptcha') {
      const params = new URLSearchParams();
      params.append('secret', CAPTCHA_SECRET);
      params.append('response', token || '');
      if (ip) params.append('remoteip', ip);
      const r = await fetch('https://www.google.com/recaptcha/api/siteverify', { method: 'POST', body: params });
      const data = await r.json();
      return !!data.success;
    }
    return true;
  } catch {
    return false;
  }
}

// Multer configuration for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

// Helpers
const MAX_LIMIT = 100;
const SAFE_SORT_COLUMNS = new Set(['username', 'created_at', 'updated_at', 'id']);
const SAFE_ORDER = new Set(['ASC', 'DESC']);
function coerceLimit(value, fallback = 50) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return Math.min(n, MAX_LIMIT);
}
function coercePage(value, fallback = 1) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return n;
}
function coerceSort(value, fallback = 'username') {
  return SAFE_SORT_COLUMNS.has(value) ? value : fallback;
}
function coerceOrder(value, fallback = 'ASC') {
  const upper = String(value || '').toUpperCase();
  return SAFE_ORDER.has(upper) ? upper : fallback;
}
function isAllowedProfileUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return ['x.com', 'twitter.com', 'www.twitter.com', 'www.x.com'].includes(u.hostname);
  } catch {
    return false;
  }
}

// Admin IP allowlist
const ADMIN_IPS = (process.env.ADMIN_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
function requireAdminIp(req, res, next) {
  if (ADMIN_IPS.length === 0) return next();
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip;
  if (!ADMIN_IPS.includes(ip)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// Zod schemas
const SuggestionItemSchema = z.object({
  username: z.string().min(1).max(50),
  profile_url: z.string().url()
});
const SuggestionsSchema = z.object({
  suggestions: z.array(SuggestionItemSchema).min(1).max(50),
  captchaToken: z.string().optional()
});
const UserUpsertSchema = z.object({
  username: z.string().min(1).max(50),
  profile_url: z.string().url()
});

// Initialize SQLite database (allow custom path for Railway volume)
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'blocked_users.db');
try {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
} catch (e) {
  console.error('Failed to prepare DB directory:', e.message);
}
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    console.error('Database path:', DB_PATH);
    // Don't exit - allow server to start even if DB has issues
    // The healthcheck endpoint doesn't depend on DB
  } else {
    console.log('Connected to SQLite database at', DB_PATH);
    initializeDatabase();
  }
});

// Set database timeout to prevent hanging (30 seconds)
try {
  db.configure('busyTimeout', 30000);
} catch (e) {
  console.warn('Could not configure database timeout:', e.message);
}

// Initialize database tables
function initializeDatabase() {
  // SQLite PRAGMAs for reliability
  db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;", (e) => {
    if (e) console.error('PRAGMA set error:', e.message);
  });
  // Blocked users table
  db.run(`
    CREATE TABLE IF NOT EXISTS blocked_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      profile_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating blocked_users table:', err.message);
    }
    // Indices
    db.run(`CREATE INDEX IF NOT EXISTS idx_blocked_users_username ON blocked_users(username);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_blocked_users_created ON blocked_users(created_at);`);
  });

  // User suggestions table
  db.run(`
    CREATE TABLE IF NOT EXISTS user_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      profile_url TEXT NOT NULL,
      reason TEXT,
      suggested_by TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      reviewed_by TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creating user_suggestions table:', err.message);
    }
    db.run(`CREATE INDEX IF NOT EXISTS idx_suggestions_status_created ON user_suggestions(status, created_at);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_suggestions_username ON user_suggestions(username);`);
  });

  // Admin users table
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `, (err) => {
    if (err) {
      console.error('Error creating admin_users table:', err.message);
    } else {
      console.log('Database tables ready');
      // Import existing JSON data if table is empty
      checkAndImportData();
    }
  });

  // Audit logs
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      actor TEXT,
      target TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function writeAudit(action, actor, target, detailsObj) {
  try {
    const details = detailsObj ? JSON.stringify(detailsObj).slice(0, 2000) : '';
    db.run("INSERT INTO audit_logs (action, actor, target, details) VALUES (?, ?, ?, ?)", [action, actor || '', target || '', details]);
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}

// Check if data exists and import from JSON if needed
function checkAndImportData() {
  db.get("SELECT COUNT(*) as count FROM blocked_users", (err, row) => {
    if (err) {
      console.error('Error checking data:', err.message);
      return;
    }
    
    if (row.count === 0) {
      console.log('No data found, importing from JSON...');
      importFromJSON();
    } else {
      console.log(`Database contains ${row.count} blocked users`);
    }
  });
}

// Import data from JSON file
function importFromJSON() {
  try {
    const jsonPath = path.join(__dirname, 'blocked_users.json');
    if (!fs.existsSync(jsonPath)) {
      console.warn('blocked_users.json not found in server directory; skipping initial import');
      return;
    }
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const stmt = db.prepare("INSERT OR IGNORE INTO blocked_users (username, profile_url) VALUES (?, ?)");
    
    let imported = 0;
    jsonData.forEach((user, index) => {
      stmt.run([user.username, user.profile_url], (err) => {
        if (err) {
          console.error(`Error inserting user ${user.username}:`, err.message);
        } else {
          imported++;
        }
        
        if (index === jsonData.length - 1) {
          stmt.finalize();
          console.log(`Successfully imported ${imported} users`);
        }
      });
    });
  } catch (error) {
    console.error('Error reading JSON file:', error.message);
  }
}

// Routes

// Health check endpoints (do not depend on DB to pass platform health probes)
app.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true });
});

// Root endpoint for Railway healthcheck (must be before static file serving)
app.get('/', (req, res) => {
  res.status(200).json({ service: 'api', ok: true });
});

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Check if user already exists
    db.get("SELECT * FROM admin_users WHERE username = ? OR email = ?", [username, email], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (row) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      db.run(
        "INSERT INTO admin_users (username, email, password_hash) VALUES (?, ?, ?)",
        [username, email, passwordHash],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          const token = jwt.sign(
            { id: this.lastID, username, email, role: 'admin' },
            JWT_SECRET,
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

app.post('/api/auth/login', async (req, res) => {
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

      // Update last login
      db.run("UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [row.id]);

      const token = jwt.sign(
        { id: row.id, username: row.username, email: row.email, role: row.role },
        JWT_SECRET,
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

// Get all blocked users with pagination and search
app.get('/api/users', (req, res) => {
  const page = coercePage(req.query.page || 1);
  const limit = coerceLimit(req.query.limit || 50);
  const search = String(req.query.search || '');
  const sort = coerceSort(req.query.sort || 'username');
  const order = coerceOrder(req.query.order || 'ASC');
  const dateRange = String(req.query.dateRange || 'all');
  const offset = (page - 1) * limit;
  
  const searchTerm = `%${search}%`;

  // Build date filter for SQLite
  let dateCondition = '';
  if (dateRange === 'today') {
    dateCondition = " AND date(created_at) = date('now')";
  } else if (dateRange === '7d') {
    dateCondition = " AND datetime(created_at) >= datetime('now','-7 days')";
  } else if (dateRange === '30d') {
    dateCondition = " AND datetime(created_at) >= datetime('now','-30 days')";
  }

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
  }, 25000); // 25 second timeout for queries
  
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
app.get('/api/users/:id', (req, res) => {
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
app.post('/api/users', adminWriteLimiter, authenticateToken, requireAdminIp, ensureJson, (req, res) => {
  const parsed = UserUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { username, profile_url } = parsed.data;
  
  if (!username || !profile_url) {
    return res.status(400).json({ error: 'Username and profile URL are required' });
  }
  
  db.run(
    "INSERT INTO blocked_users (username, profile_url) VALUES (?, ?)",
    [username, profile_url],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      writeAudit('users.create', req.user?.username, username);
      res.status(201).json({
        id: this.lastID,
        username,
        profile_url,
        message: 'User added successfully'
      });
    }
  );
});

// Update blocked user (admin only)
app.put('/api/users/:id', adminWriteLimiter, authenticateToken, requireAdminIp, ensureJson, (req, res) => {
  const { id } = req.params;
  const parsed = UserUpsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { username, profile_url } = parsed.data;
  
  if (!username || !profile_url) {
    return res.status(400).json({ error: 'Username and profile URL are required' });
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
      
      writeAudit('users.update', req.user?.username, String(id), { username, profile_url });
      res.json({
        id: parseInt(id),
        username,
        profile_url,
        message: 'User updated successfully'
      });
    }
  );
});

// Delete blocked user (admin only)
app.delete('/api/users/:id', adminWriteLimiter, authenticateToken, requireAdminIp, (req, res) => {
  const { id } = req.params;
  
  db.run("DELETE FROM blocked_users WHERE id = ?", [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    writeAudit('users.delete', req.user?.username, String(id));
    res.json({ message: 'User deleted successfully' });
  });
});

// Bulk import from JSON file (admin only)
app.post('/api/import', adminWriteLimiter, authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    const content = fs.readFileSync(req.file.path, 'utf8');
    if (content.length > 2 * 1024 * 1024) { // 2MB guard
      fs.unlinkSync(req.file.path);
      return res.status(413).json({ error: 'File too large' });
    }
    const jsonData = JSON.parse(content);
    if (!Array.isArray(jsonData)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'JSON must be an array' });
    }
    if (jsonData.length > 5000) { // hard cap
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Too many records' });
    }
    const stmt = db.prepare("INSERT OR REPLACE INTO blocked_users (username, profile_url) VALUES (?, ?)");
    
    let imported = 0;
    let errors = 0;
    
    jsonData.forEach((user, index) => {
      const username = String(user.username || '').trim().replace(/^@/, '');
      const profileUrl = String(user.profile_url || '').trim();
      if (!username || !profileUrl || !isAllowedProfileUrl(profileUrl)) {
        errors++;
        if (index === jsonData.length - 1) {
          stmt.finalize();
          fs.unlinkSync(req.file.path);
          return res.json({ message: 'Import completed', imported, errors, total: jsonData.length });
        }
        return;
      }
      stmt.run([username, profileUrl], (err) => {
        if (err) {
          errors++;
        } else {
          imported++;
        }
        
        if (index === jsonData.length - 1) {
          stmt.finalize();
          fs.unlinkSync(req.file.path); // Clean up uploaded file
          writeAudit('users.import', req.user?.username, '', { imported, errors, total: jsonData.length });
          res.json({
            message: 'Import completed',
            imported,
            errors,
            total: jsonData.length
          });
        }
      });
    });
  } catch (error) {
    fs.unlinkSync(req.file.path); // Clean up uploaded file
    res.status(500).json({ error: 'Invalid JSON file' });
  }
});

// Get statistics
app.get('/api/stats', (req, res) => {
  // Add timeout for database operations
  const queryTimeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Database query timeout' });
    }
  }, 25000); // 25 second timeout for queries
  
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

// Suggestions route (auth required, batch up to 50)
app.post('/api/suggestions', suggestLimiter, authenticateToken, ensureJson, async (req, res) => {
  const parse = SuggestionsSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload' });
  const { suggestions, captchaToken } = parse.data;
  if (CAPTCHA_REQUIRED) {
    const ok = await verifyCaptcha(captchaToken, req.ip);
    if (!ok) return res.status(400).json({ error: 'Captcha verification failed' });
  }

  // Support single object fallback
  let items = Array.isArray(suggestions) ? suggestions : [];

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Provide suggestions array or username and profile_url' });
  }

  if (items.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 suggestions per submission' });
  }

  // Basic validation and normalization
  const normalized = items
    .map((it) => ({
      username: (it.username || '').trim().replace(/^@/, ''),
      profile_url: (it.profile_url || '').trim()
    }))
    .filter((it) => it.username && it.profile_url && isAllowedProfileUrl(it.profile_url));

  if (normalized.length === 0) {
    return res.status(400).json({ error: 'No valid items found' });
  }

  const stmt = db.prepare("INSERT INTO user_suggestions (username, profile_url, reason, suggested_by) VALUES (?, ?, ?, ?)");
  let inserted = 0;
  let errors = 0;
  const suggestedBy = req.user?.username || 'Anonymous';

  let completed = 0;
  normalized.forEach((it) => {
    stmt.run([it.username, it.profile_url, '', suggestedBy], (err) => {
      if (err) {
        errors++;
      } else {
        inserted++;
      }
      completed++;
      if (completed === normalized.length) {
        stmt.finalize();
        writeAudit('suggestions.create', suggestedBy, String(inserted), { errors, total: normalized.length });
        return res.status(201).json({
          message: 'Suggestions submitted. They will be reviewed by an administrator.',
          inserted,
          errors,
          total: normalized.length
        });
      }
    });
  });
});

// Admin routes for suggestions (require authentication)
app.get('/api/admin/suggestions', authenticateToken, (req, res) => {
  const { status = 'pending', page = 1, limit = 20 } = req.query;
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

app.put('/api/admin/suggestions/:id/approve', adminWriteLimiter, authenticateToken, (req, res) => {
  const { id } = req.params;
  const { username } = req.user;
  
  // First get the suggestion
  db.get("SELECT * FROM user_suggestions WHERE id = ?", [id], (err, suggestion) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }
    
    if (suggestion.status !== 'pending') {
      return res.status(400).json({ error: 'Suggestion already processed' });
    }
    
    // Add to blocked users
    db.run(
      "INSERT OR IGNORE INTO blocked_users (username, profile_url) VALUES (?, ?)",
      [suggestion.username, suggestion.profile_url],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        // Update suggestion status
        db.run(
          "UPDATE user_suggestions SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE id = ?",
          [username, id],
          function(err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            writeAudit('suggestions.approve', username, String(id), { addedToBlocked: this.changes > 0 });
            res.json({
              message: 'Suggestion approved and user added to blocked list',
              addedToBlocked: this.changes > 0
            });
          }
        );
      }
    );
  });
});

app.put('/api/admin/suggestions/:id/reject', adminWriteLimiter, authenticateToken, (req, res) => {
  const { id } = req.params;
  const { username } = req.user;
  
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
      
      writeAudit('suggestions.reject', username, String(id));
      res.json({ message: 'Suggestion rejected' });
    }
  );
});

// Serve static files in production only if build exists
if (process.env.NODE_ENV === 'production') {
  const buildDir = path.join(__dirname, '../client/build');
  if (fs.existsSync(buildDir)) {
    app.use(express.static(buildDir));
    // Catch-all handler for client routes (SPA)
    app.get('*', (req, res, next) => {
      // Skip API routes
      if (req.path.startsWith('/api/')) {
        return next();
      }
      const indexPath = path.join(buildDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      return next();
    });
  }
}

// Global error handler to avoid crashes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, req, res, next) => {
  try {
    console.error('Unhandled error:', err?.message || err);
  } catch {}
  res.status(500).json({ error: 'Internal Server Error' });
});

process.on('unhandledRejection', (reason) => {
  try { console.error('unhandledRejection', reason); } catch {}
});
process.on('uncaughtException', (err) => {
  try { console.error('uncaughtException', err); } catch {}
});

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check available at: http://${HOST}:${PORT}/`);
  console.log(`API health check available at: http://${HOST}:${PORT}/api/health`);
});

// Error handling for server startup
server.on('error', (err) => {
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
  process.exit(1);
});

server.on('listening', () => {
  console.log(`✓ Server successfully started and listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed');
    process.exit(0);
  });
});
