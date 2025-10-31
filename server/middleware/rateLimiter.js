// Rate limiting middleware
const config = require('../config');

async function sendAlert(payload) {
  try {
    if (!config.LOG_WEBHOOK_URL) return;
    await fetch(config.LOG_WEBHOOK_URL, { 
      method: 'POST', 
      headers: { 'content-type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });
  } catch {}
}

function createRateLimiter(windowMs, max) {
  const hits = new Map();
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

// Per-route rate limiters
const authLimiter = createRateLimiter(5 * 60 * 1000, 50);
const suggestLimiter = createRateLimiter(60 * 1000, 30);
const adminWriteLimiter = createRateLimiter(60 * 1000, 20);
const globalLimiter = createRateLimiter(60 * 1000, 300);

module.exports = {
  createRateLimiter,
  authLimiter,
  suggestLimiter,
  adminWriteLimiter,
  globalLimiter
};

