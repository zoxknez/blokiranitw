// Security middleware
const config = require('../config');
const { randomUUID } = require('crypto');

// Security headers middleware
function securityHeaders(req, res, next) {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  
  // CSP
  const allowedConnect = config.ALLOWED_CONNECT
    .split(',').map(s => s.trim()).filter(Boolean);
  const connectSrc = allowedConnect.length > 0 
    ? allowedConnect.join(' ')
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
}

// Robots tag
function robotsTag(req, res, next) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
}

// Request ID middleware
function requestId(req, res, next) {
  req.id = randomUUID();
  next();
}

// Request logger
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    try {
      const ms = Date.now() - start;
      const ua = req.headers['user-agent'] || '';
      console.log(`[${req.id}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms UA:${ua.substring(0,80)}`);
    } catch {}
  });
  next();
}

// Param pollution guard
function paramPollutionGuard(req, res, next) {
  for (const key of Object.keys(req.query)) {
    const val = req.query[key];
    if (Array.isArray(val)) {
      req.query[key] = val[0];
    }
  }
  next();
}

// HTTPS redirect
function httpsRedirect(req, res, next) {
  if (!config.FORCE_HTTPS) return next();
  if (req.path === '/api/health' || req.path === '/') return next();
  if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, 'https://' + req.headers.host + req.originalUrl);
  }
  next();
}

// Admin IP allowlist
function requireAdminIp(req, res, next) {
  if (config.ADMIN_IPS.length === 0) return next();
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip;
  if (!config.ADMIN_IPS.includes(ip)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

module.exports = {
  securityHeaders,
  robotsTag,
  requestId,
  requestLogger,
  paramPollutionGuard,
  httpsRedirect,
  requireAdminIp
};

