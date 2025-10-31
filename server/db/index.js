// Database setup and connection
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');

let db = null;

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
    } else {
      db.run(`CREATE INDEX IF NOT EXISTS idx_blocked_users_username ON blocked_users(username);`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_blocked_users_created ON blocked_users(created_at);`);
    }
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
    } else {
      db.run(`CREATE INDEX IF NOT EXISTS idx_suggestions_status_created ON user_suggestions(status, created_at);`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_suggestions_username ON user_suggestions(username);`);
    }
  });

  // Users table (regular users - NO role column)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `, (err) => {
    if (err) {
      console.error('Error creating users table:', err.message);
    } else {
      console.log('✓ users table ready');
      db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    }
  });

  // Admin users table (admins only - WITH role column)
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
      console.log('✓ admin_users table ready');
      console.log('Database tables ready');
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

function importFromJSON() {
  try {
    const jsonPath = path.join(__dirname, '..', 'blocked_users.json');
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

function connect() {
  return new Promise((resolve, reject) => {
    // Prepare DB directory
    try {
      const dir = path.dirname(config.DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (e) {
      console.error('Failed to prepare DB directory:', e.message);
    }

    db = new sqlite3.Database(config.DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
        console.error('Database path:', config.DB_PATH);
        reject(err);
      } else {
        console.log('Connected to SQLite database at', config.DB_PATH);
        // Set database timeout
        try {
          db.configure('busyTimeout', 30000);
        } catch (e) {
          console.warn('Could not configure database timeout:', e.message);
        }
        initializeDatabase();
        resolve(db);
      }
    });
  });
}

function getDb() {
  if (!db) {
    throw new Error('Database not connected. Call connect() first.');
  }
  return db;
}

module.exports = {
  connect,
  getDb
};

