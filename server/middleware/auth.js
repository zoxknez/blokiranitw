// Authentication middleware
const jwt = require('jsonwebtoken');
const config = require('../config');

let jwksCache = null;

async function getJWKS() {
  try {
    if (jwksCache && (Date.now() - jwksCache.fetchedAt < 60 * 60 * 1000)) {
      return jwksCache.keys;
    }
    const res = await fetch(config.SUPABASE_JWKS_URL);
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
    jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }, (err, payload) => {
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
    const decodedHeader = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
    let payload;
    
    if (decodedHeader.alg === 'RS256') {
      payload = await verifySupabaseJwt(token);
      req.user = { id: payload.sub, username: payload.user_metadata?.username || payload.email };
    } else if (decodedHeader.alg === 'HS256') {
      payload = await verifyLocalJwt(token);
      req.user = { id: payload.id, username: payload.username, email: payload.email, role: payload.role };
    } else {
      return res.status(400).json({ error: 'Unsupported JWT algorithm' });
    }
    return next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

function ensureJson(req, res, next) {
  if (!req.is('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type' });
  }
  next();
}

module.exports = {
  authenticateToken,
  ensureJson
};

