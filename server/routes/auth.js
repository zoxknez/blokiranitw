// Authentication routes
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const dbModule = require('../db');

const router = express.Router();

function getDb() {
  return dbModule.getDb();
}

// Supabase client za sync
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || 'https://kvbppgfwqnwvwubaendh.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YnBwZ2Z3cW53dnd1YmFlbmRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NjcwNzYsImV4cCI6MjA3NzM0MzA3Nn0.qs-Vk8rwl2DNq5T7hDw4W9Fi6lSdWzET35sdy2anv9U';
const supabaseClient = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Helper: Ensure users table exists
function ensureUsersTable(req, callback) {
  const db = getDb();
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )`, (err) => {
      if (err) {
        console.error(`[${req.id || 'auth'}] Error creating users table:`, err.message);
        return callback(err);
      }
      db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`, () => {
        callback(null);
      });
    });
  });
}

router.post('/api/auth/register', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  // Disable public registration in production unless explicitly enabled
  const allowRegistration = process.env.ALLOW_PUBLIC_REGISTRATION === 'true' || 
                            process.env.NODE_ENV !== 'production' ||
                            process.env.ENABLE_REGISTRATION_FOR_TEST === 'true';
  if (!allowRegistration) {
    return res.status(403).json({ error: 'Public registration is disabled in production' });
  }
  
  const { username, email, password } = req.body;
  // Ignore any client-provided role for security
  if ('role' in req.body) delete req.body.role;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Ensure users table exists
  ensureUsersTable(req, async (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }

    // Check if user already exists
    const db = getDb();
    db.get("SELECT * FROM users WHERE username = ? OR email = ?", [username, email], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (row) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user in users table (regular users, not admin_users)
      db.run(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
        [username, email, passwordHash],
        async function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          // Sync to Supabase
          if (supabaseClient) {
            try {
              console.log(`[${req.id || 'auth'}] 🔄 Syncing user to Supabase: ${email}`);
              const { data: insertedData, error: supabaseError } = await supabaseClient
                .from('users')
                .insert({
                  username: username,
                  email: email,
                  password_hash: passwordHash
                })
                .select()
                .single();

              if (supabaseError) {
                if (supabaseError.code === '23505') {
                  // User exists, update
                  await supabaseClient
                    .from('users')
                    .update({ username: username, password_hash: passwordHash })
                    .eq('email', email);
                  console.log(`[${req.id || 'auth'}] ✅ Synced to Supabase (updated)`);
                } else {
                  console.error(`[${req.id || 'auth'}] ❌ Supabase sync error:`, supabaseError.message);
                }
              } else {
                console.log(`[${req.id || 'auth'}] ✅ Synced to Supabase, ID: ${insertedData?.id}`);
              }
            } catch (syncError) {
              console.error(`[${req.id || 'auth'}] ❌ EXCEPTION syncing to Supabase:`, syncError.message);
            }
          }

          const token = jwt.sign(
            { id: this.lastID, username, email, role: 'user' },
            config.JWT_SECRET,
            { expiresIn: '24h' }
          );

          res.status(201).json({
            message: 'User created successfully',
            token,
            user: { id: this.lastID, username, email, role: 'user' }
          });
        }
      );
    });
  });
});

router.post('/api/auth/login', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Ensure users table exists
  ensureUsersTable(req, async (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }

    // First check in users table (regular users)
    const db = getDb();
    db.get("SELECT *, 'user' as role FROM users WHERE username = ?", [username], async (err, row) => {
      let isAdmin = false;
      let userRole = 'user';
      
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!row) {
        // Check in admin_users table
        db.get("SELECT *, role FROM admin_users WHERE username = ?", [username], async (err2, adminRow) => {
          if (err2) {
            return res.status(500).json({ error: err2.message });
          }
          
          if (!adminRow) {
            return res.status(401).json({ error: 'Invalid credentials' });
          }
          
          row = adminRow;
          isAdmin = true;
          userRole = adminRow.role || 'admin';
          await processLogin();
        });
        return;
      }
      
      // Regular user
      await processLogin();
      
      async function processLogin() {
        const isValidPassword = await bcrypt.compare(password, row.password_hash);
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        const tableName = isAdmin ? 'admin_users' : 'users';
        db.run(`UPDATE ${tableName} SET last_login = CURRENT_TIMESTAMP WHERE id = ?`, [row.id]);

        // Sync to Supabase
        if (supabaseClient) {
          try {
            const supabaseTable = isAdmin ? 'admin_users' : 'users';
            const { data: existingUser, error: checkError } = await supabaseClient
              .from(supabaseTable)
              .select('id')
              .eq('email', row.email)
              .single();

            if (checkError && checkError.code === 'PGRST116') {
              // User not in Supabase, add them
              const insertData = {
                username: row.username,
                email: row.email,
                password_hash: row.password_hash,
                last_login: new Date().toISOString()
              };
              if (isAdmin) {
                insertData.role = row.role || 'admin';
              }
              await supabaseClient
                .from(supabaseTable)
                .insert(insertData)
                .select()
                .single();
              console.log(`[${req.id || 'auth'}] ✅ Synced login to Supabase`);
            } else if (existingUser) {
              // Update last_login
              await supabaseClient
                .from(supabaseTable)
                .update({ last_login: new Date().toISOString() })
                .eq('email', row.email);
            }
          } catch (syncError) {
            console.error(`[${req.id || 'auth'}] ❌ EXCEPTION syncing login:`, syncError.message);
          }
        }

        const token = jwt.sign(
          { id: row.id, username: row.username, email: row.email, role: userRole },
          config.JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.json({
          message: 'Login successful',
          token,
          user: { id: row.id, username: row.username, email: row.email, role: userRole }
        });
      }
    });
  });
});

module.exports = router;
