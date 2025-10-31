const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const { z } = require('zod');
const dbModule = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
// Determine JWKS URL to validate Supabase RS256 tokens.
// Prefer explicit env override. If running in development or when SUPABASE_URL
// points to localhost/127.0.0.1, use local Supabase JWKS endpoint so auth works
// against a locally started Supabase stack.
function resolveSupabaseJwks() {
  if (process.env.SUPABASE_JWKS_URL) return process.env.SUPABASE_JWKS_URL;
  const suppliedBase = (process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '').trim();
  try {
    if (suppliedBase.includes('127.0.0.1') || suppliedBase.includes('localhost')) {
      return (suppliedBase.replace(/\/$/, '') || 'http://127.0.0.1:54321') + '/auth/v1/keys';
    }
  } catch (e) {}
  if ((process.env.NODE_ENV || '').toLowerCase() === 'development') {
    return 'http://127.0.0.1:54321/auth/v1/keys';
  }
  return 'https://kvbppgfwqnwvwubaendh.supabase.co/auth/v1/keys';
}
const SUPABASE_JWKS_URL = resolveSupabaseJwks();
const CAPTCHA_PROVIDER = (process.env.CAPTCHA_PROVIDER || '').toLowerCase(); // 'turnstile' | 'recaptcha'
const CAPTCHA_SECRET = process.env.CAPTCHA_SECRET || '';
const CAPTCHA_REQUIRED = (process.env.CAPTCHA_REQUIRED || 'false') === 'true';

// Supabase client za pristup Supabase bazi (za proveru role-a Supabase korisnika)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || 'https://kvbppgfwqnwvwubaendh.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YnBwZ2Z3cW53dnd1YmFlbmRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NjcwNzYsImV4cCI6MjA3NzM0MzA3Nn0.qs-Vk8rwl2DNq5T7hDw4W9Fi6lSdWzET35sdy2anv9U';
const supabaseClient = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

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
  const ALLOWED_CONNECT = (process.env.ALLOWED_CONNECT || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  // Default to Supabase and Turnstile if not specified
  const connectSrc = ALLOWED_CONNECT.length > 0 
    ? ALLOWED_CONNECT.join(' ')
    : 'https://*.supabase.co https://challenges.cloudflare.com';
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    `connect-src 'self' ${connectSrc}`,
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
// CORS: support multiple origins (comma-separated)
const raw = process.env.ALLOWED_ORIGIN || '*';
const origins = raw === '*' ? true : raw.split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: origins, credentials: false }));
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

    // Build candidate JWKS URLs to support different Supabase local/remote layouts
    const candidates = [];
    if (process.env.SUPABASE_JWKS_URL) candidates.push(process.env.SUPABASE_JWKS_URL);
    const suppliedBase = (process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '').trim();
    try {
      if (suppliedBase) {
        const base = suppliedBase.replace(/\/$/, '');
        candidates.push(`${base}/auth/v1/keys`);
        candidates.push(`${base}/auth/v1/.well-known/jwks.json`);
        candidates.push(`${base}/auth/v1/jwks`);
        candidates.push(`${base}/keys`);
        candidates.push(`${base}/.well-known/jwks.json`);
      }
    } catch (e) {}

    // Local Supabase development defaults
    candidates.push('http://127.0.0.1:54321/auth/v1/keys');
    candidates.push('http://127.0.0.1:54321/auth/v1/.well-known/jwks.json');
    candidates.push('http://127.0.0.1:54321/keys');
    candidates.push('http://127.0.0.1:54321/.well-known/jwks.json');

    // Deduplicate while preserving order
    const seen = new Set();
    const uniq = candidates.filter(c => c && !seen.has(c) && (seen.add(c), true));

    for (const url of uniq) {
      try {
        // fetch with timeout
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        if (!res.ok) {
          console.debug(`JWKS probe ${url} -> ${res.status}`);
          continue;
        }
        const data = await res.json();
        const keys = Array.isArray(data.keys) ? data.keys : (Array.isArray(data) ? data : []);
        if (!keys || keys.length === 0) {
          console.debug(`JWKS probe ${url} -> no keys found`);
          continue;
        }
        jwksCache = { keys, fetchedAt: Date.now(), url };
        console.log(`JWKS fetched from ${url} (keys: ${keys.length})`);
        return jwksCache.keys;
      } catch (err) {
        console.debug(`JWKS probe ${url} -> error: ${err?.message || err}`);
        continue;
      }
    }

    console.error('JWKS Error: no reachable JWKS endpoint among candidates');
    return [];
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

// JWT verification helpers
async function verifySupabaseJwt(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, payload) => {
      if (err) return reject(err);
      resolve(payload);
    });
  });
}

async function verifyLocalJwt(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, payload) => {
      if (err) return reject(err);
      resolve(payload);
    });
  });
}

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    // Decode header to check algorithm
    const decodedHeader = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
    let payload;
    
    if (decodedHeader.alg === 'RS256') {
      payload = await verifySupabaseJwt(token);
      const email = payload.email;
      const username = payload.user_metadata?.username || email?.split('@')[0] || '';
      
      // Proveri korisnika u Supabase bazi
      // Prvo proveri u users tabeli (obični korisnici), pa u admin_users (admini)
      if (supabaseClient) {
        try {
          // Probaj prvo u users tabeli (obični korisnici)
          let { data: supabaseUser, error: supabaseError } = await supabaseClient
            .from('users')
            .select('id, username, email')
            .eq('email', email)
            .single();

          if (supabaseError && supabaseError.code === 'PGRST116') {
            // Probaj po username-u
            const { data: userByUsername, error: usernameError } = await supabaseClient
              .from('users')
              .select('id, username, email')
              .eq('username', username)
              .single();
            
            if (!usernameError && userByUsername) {
              supabaseUser = userByUsername;
              supabaseError = null;
            }
          }

          if (!supabaseError && supabaseUser) {
            // Korisnik je običan korisnik (users tabela)
            req.user = {
              id: supabaseUser.id,
              username: supabaseUser.username,
              email: supabaseUser.email,
              role: 'user'
            };
            return next();
          }

          // Ako nije u users, proveri u admin_users
          let { data: supabaseAdmin, error: adminError } = await supabaseClient
            .from('admin_users')
            .select('id, username, email, role')
            .eq('email', email)
            .single();

          if (adminError && adminError.code === 'PGRST116') {
            // Probaj po username-u
            const { data: adminByUsername, error: adminUsernameError } = await supabaseClient
              .from('admin_users')
              .select('id, username, email, role')
              .eq('username', username)
              .single();
            
            if (!adminUsernameError && adminByUsername) {
              supabaseAdmin = adminByUsername;
              adminError = null;
            } else {
              adminError = adminUsernameError;
            }
          }

          if (adminError) {
            if (adminError.code === 'PGRST116') {
              console.warn(`[${req.id}] Supabase user ${email || username} not found in Supabase database`);
              return res.status(403).json({ error: 'User not authorized. Please register through the application.' });
            }
            throw adminError;
          }

          if (supabaseAdmin) {
            // Korisnik je admin (admin_users tabela)
            req.user = {
              id: supabaseAdmin.id,
              username: supabaseAdmin.username,
              email: supabaseAdmin.email,
              role: supabaseAdmin.role || 'admin'
            };
            return next();
          }

          // Korisnik nije pronađen ni u users ni u admin_users
          console.warn(`[${req.id}] Supabase user ${email || username} not found in Supabase database`);
          return res.status(403).json({ error: 'User not authorized. Please register through the application.' });
        } catch (supabaseErr) {
          console.error(`[${req.id}] Supabase database error checking user role:`, supabaseErr.message);
          // Fallback na lokalnu bazu ako Supabase ne radi
          console.warn(`[${req.id}] Falling back to local database...`);
        }
      }

      // Fallback: Proveri role iz lokalne SQLite baze (za backward compatibility)
      try {
        const localDb = dbModule.getDb();
        localDb.get(
          "SELECT id, username, email, role FROM admin_users WHERE email = ? OR username = ?",
          [email, username],
          (err, row) => {
          if (err) {
            console.error(`[${req.id}] Database error checking user role:`, err.message);
            return res.status(403).json({ error: 'User not found in database' });
          }
          
          if (!row) {
            console.warn(`[${req.id}] User ${email || username} not found in database`);
            return res.status(403).json({ error: 'User not authorized. Please register through the application.' });
          }
          
          req.user = {
            id: row.id,
            username: row.username,
            email: row.email,
            role: row.role || 'user'
          };
          return next();
        }
      );
      } catch (dbErr) {
        console.error(`[${req.id}] Database not available:`, dbErr.message);
        return res.status(503).json({ error: 'Database unavailable' });
      }
      return; // Vrati iz funkcije, callback će pozvati next() ili res.status()
    } else if (decodedHeader.alg === 'HS256') {
      payload = await verifyLocalJwt(token);
      req.user = { id: payload.id, username: payload.username, email: payload.email, role: payload.role };
      return next();
    } else {
      return res.status(400).json({ error: 'Unsupported JWT algorithm' });
    }
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
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

// Create uploads directory on boot
const UPLOAD_DIR = path.join(__dirname, 'uploads');
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (e) {
  console.error('Failed to create uploads directory:', e.message);
}

// Multer configuration for file uploads
const upload = multer({
  dest: UPLOAD_DIR,
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

// Routes are now in separate files - mount them below
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const userRole = req.user.role;
  if (userRole !== 'admin') {
    console.warn(`[${req.id}] Non-admin user ${req.user.username} (role: ${userRole}) attempted to access admin route`);
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}

// Zod schemas
const SuggestionItemSchema = z.object({
  username: z.string().min(1).max(50),
  profile_url: z.string().url().refine(isAllowedProfileUrl, 'Only Twitter/X profile URLs are allowed')
});
const SuggestionsSchema = z.object({
  suggestions: z.array(SuggestionItemSchema).min(1).max(50),
  captchaToken: z.string().optional()
});
const UserUpsertSchema = z.object({
  username: z.string().min(1).max(50),
  profile_url: z.string().url().refine(isAllowedProfileUrl, 'Only Twitter/X profile URLs are allowed')
});

// Initialize database connection
let db;
async function initializeDatabase() {
  try {
    db = await dbModule.connect();
    console.log('Database initialized and ready');
  } catch (err) {
    console.error('Failed to initialize database:', err.message);
    // Don't exit - allow server to start even if DB has issues
    // The healthcheck endpoint doesn't depend on DB
  }
}

// Routes - mount route modules
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/suggestions', require('./routes/suggestions'));
app.use('/api/stats', require('./routes/stats'));
app.use(require('./routes/auth'));
app.use(require('./routes/health'));


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

// Initialize database and start server
initializeDatabase().then(() => {
  // Start server after DB is initialized
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
  function shutdown() {
    console.log('Shutting down...');
    server.close(() => {
      try {
        const localDb = dbModule.getDb();
        localDb.close((err) => {
          if (err) {
            console.error(err.message);
          }
          console.log('Database connection closed');
          process.exit(0);
        });
      } catch (err) {
        console.log('Database already closed or not initialized');
        process.exit(0);
      }
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}).catch((err) => {
  console.error('Failed to initialize database:', err);
  // Start server anyway for healthcheck - routes will handle DB errors
  const server = app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT} (database unavailable)`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.warn('⚠ Database not initialized - API endpoints may fail');
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
    }
    process.exit(1);
  });

  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
});

