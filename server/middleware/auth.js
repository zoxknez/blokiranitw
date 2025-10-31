// Authentication middleware
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const dbModule = require('../db');

let jwksCache = null;

// Supabase client for role checking
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || 'https://kvbppgfwqnwvwubaendh.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YnBwZ2Z3cW53dnd1YmFlbmRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NjcwNzYsImV4cCI6MjA3NzM0MzA3Nn0.qs-Vk8rwl2DNq5T7hDw4W9Fi6lSdWzET35sdy2anv9U';
const supabaseClient = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

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
            // Korisnik je običan korisnik (users tabela) - ROLE = 'user'
            console.log(`[${req.id || 'auth'}] ✅ User found in users table: ${email} -> role='user'`);
            req.user = {
              id: supabaseUser.id,
              username: supabaseUser.username,
              email: supabaseUser.email,
              role: 'user'  // EKSPLICITNO POSTAVI role='user' za users tabelu
            };
            return next();
          }

          // AKO NIJE U users, PROVERI admin_users
          console.log(`[${req.id || 'auth'}] ⚠️ User ${email} NOT found in users table, checking admin_users...`);

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
              console.warn(`[${req.id || 'auth'}] Supabase user ${email || username} not found in Supabase database`);
              return res.status(403).json({ error: 'User not authorized. Please register through the application.' });
            }
            throw adminError;
          }

          if (supabaseAdmin) {
            // Korisnik je admin (admin_users tabela)
            console.log(`[${req.id || 'auth'}] ⚠️ User ${email} found in admin_users table -> role='${supabaseAdmin.role || 'admin'}'`);
            req.user = {
              id: supabaseAdmin.id,
              username: supabaseAdmin.username,
              email: supabaseAdmin.email,
              role: supabaseAdmin.role || 'admin'
            };
            return next();
          }

          // VAŽNO: Korisnik nije pronađen ni u users ni u admin_users
          // OVO ZNAČI da se korisnik možda registruje DIREKTNO u Supabase Auth, ali nije u našim tabelama
          // U OVOM SLUČAJU, POSTAVI role='user' kao default (NE 'admin')
          console.warn(`[${req.id || 'auth'}] ⚠️ User ${email || username} NOT found in users OR admin_users tables`);
          console.warn(`[${req.id || 'auth'}] This user may have registered directly in Supabase Auth but not in our app`);
          console.warn(`[${req.id || 'auth'}] Setting role='user' as default (NOT admin)`);
          
          // POSTAVI role='user' kao default, NE 'admin'
          req.user = {
            id: payload.sub || email,
            username: username,
            email: email,
            role: 'user'  // DEFAULT JE 'user', NE 'admin'
          };
          return next();
        } catch (supabaseErr) {
          console.error(`[${req.id || 'auth'}] Supabase database error checking user role:`, supabaseErr.message);
          // Fallback na lokalnu bazu ako Supabase ne radi
          console.warn(`[${req.id || 'auth'}] Falling back to local database...`);
        }
      }

      // Fallback: Proveri role iz lokalne SQLite baze (za backward compatibility)
      try {
        const localDb = dbModule.getDb();
        // Prvo proveri u users tabeli
        localDb.get(
          "SELECT id, username, email FROM users WHERE email = ? OR username = ?",
          [email, username],
          (err, userRow) => {
            if (!err && userRow) {
              // Korisnik je u users tabeli - ROLE = 'user'
              req.user = {
                id: userRow.id,
                username: userRow.username,
                email: userRow.email,
                role: 'user'  // EKSPLICITNO POSTAVI role='user'
              };
              return next();
            }
            
            // Ako nije u users, proveri u admin_users
            localDb.get(
              "SELECT id, username, email, role FROM admin_users WHERE email = ? OR username = ?",
              [email, username],
              (err2, adminRow) => {
                if (err2) {
                  console.error(`[${req.id || 'auth'}] Database error checking user role:`, err2.message);
                  return res.status(403).json({ error: 'User not found in database' });
                }
                
                if (!adminRow) {
                  // Korisnik nije ni u users ni u admin_users u lokalnoj bazi
                  // OVO ZNAČI da se korisnik registruje DIREKTNO u Supabase Auth
                  console.warn(`[${req.id || 'auth'}] ⚠️ User ${email || username} NOT found in local users OR admin_users`);
                  console.warn(`[${req.id || 'auth'}] This user may have registered directly in Supabase Auth`);
                  console.warn(`[${req.id || 'auth'}] Setting role='user' as default (NOT admin)`);
                  
                  // POSTAVI role='user' kao default, NE 'admin'
                  req.user = {
                    id: email || username,
                    username: username,
                    email: email,
                    role: 'user'  // DEFAULT JE 'user', NE 'admin'
                  };
                  return next();
                }
                
                // Korisnik JE u admin_users - to je admin
                console.log(`[${req.id || 'auth'}] ⚠️ User ${email} found in local admin_users -> role='${adminRow.role || 'admin'}'`);
                req.user = {
                  id: adminRow.id,
                  username: adminRow.username,
                  email: adminRow.email,
                  role: adminRow.role || 'admin'
                };
                return next();
              }
            );
          }
        );
      } catch (dbErr) {
        console.error(`[${req.id || 'auth'}] Database not available:`, dbErr.message);
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

