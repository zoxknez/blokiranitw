#!/usr/bin/env node
/**
 * CLI skripta za automatsko kreiranje admin korisnika u Railway/SQLite bazi
 * 
 * Usage:
 *   node scripts/setup-admins.js
 *   node scripts/setup-admins.js --username admin1 --password Admin123!
 *   node scripts/setup-admins.js --count 2
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const readline = require('readline');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  username: args.find(a => a.startsWith('--username='))?.split('=')[1] || 'admin1',
  password: args.find(a => a.startsWith('--password='))?.split('=')[1] || 'Admin123!',
  email: args.find(a => a.startsWith('--email='))?.split('=')[1] || null,
  count: parseInt(args.find(a => a.startsWith('--count='))?.split('=')[1] || '2'),
  dbPath: args.find(a => a.startsWith('--db='))?.split('=')[1] || path.join(__dirname, '..', 'blocked_users.db'),
  interactive: !args.includes('--non-interactive')
};

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function ensureDatabase(dbPath) {
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`✓ Created database directory: ${dir}`, 'green');
  }

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        log(`✓ Connected to database: ${dbPath}`, 'green');
        resolve(db);
      }
    });
  });
}

async function ensureAdminUsersTable(db) {
  return new Promise((resolve, reject) => {
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
        reject(err);
      } else {
        log('✓ admin_users table ready', 'green');
        resolve();
      }
    });
  });
}

async function checkExistingAdmins(db) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, username, email, role, created_at FROM admin_users ORDER BY id', (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function createAdminUser(db, username, email, password, index) {
  return new Promise((resolve, reject) => {
    // Check if user exists
    db.get('SELECT id FROM admin_users WHERE username = ? OR email = ?', [username, email], async (err, row) => {
      if (err) {
        return reject(err);
      }

      if (row) {
        log(`  ⚠ Admin ${username} already exists (ID: ${row.id}), skipping...`, 'yellow');
        return resolve({ created: false, exists: true });
      }

      try {
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert admin user
        db.run(
          'INSERT INTO admin_users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
          [username, email, passwordHash, 'admin'],
          function(err) {
            if (err) {
              if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                log(`  ⚠ Admin ${username} already exists, skipping...`, 'yellow');
                return resolve({ created: false, exists: true });
              }
              return reject(err);
            }

            log(`  ✓ Created admin ${index + 1}: ${username} (ID: ${this.lastID})`, 'green');
            log(`    Email: ${email}`, 'cyan');
            log(`    Password: ${password}`, 'cyan');
            log('');
            
            resolve({ created: true, id: this.lastID });
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function setupAdmins() {
  try {
    log('\n🚀 Admin Setup CLI', 'cyan');
    log('════════════════════════════════════════', 'cyan');
    log('');

    // Check if database file exists or if we should create it
    const dbExists = fs.existsSync(options.dbPath);
    if (!dbExists && options.interactive) {
      log(`Database file not found: ${options.dbPath}`, 'yellow');
      const rl = createReadlineInterface();
      const answer = await askQuestion(rl, 'Do you want to create a new database? (y/n): ');
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        log('✗ Setup cancelled', 'red');
        process.exit(0);
      }
    }

    // Connect to database
    log('📦 Connecting to database...', 'blue');
    const db = await ensureDatabase(options.dbPath);

    // Ensure admin_users table exists
    log('📋 Creating admin_users table if needed...', 'blue');
    await ensureAdminUsersTable(db);

    // Check existing admins
    log('👥 Checking existing admin users...', 'blue');
    const existingAdmins = await checkExistingAdmins(db);
    
    if (existingAdmins.length > 0) {
      log(`\nFound ${existingAdmins.length} existing admin user(s):`, 'yellow');
      existingAdmins.forEach((admin, idx) => {
        log(`  ${idx + 1}. ${admin.username} (${admin.email}) - ID: ${admin.id}`, 'cyan');
      });
      log('');
    }

    // Interactive mode: ask for details
    let adminsToCreate = [];
    if (options.interactive) {
      const rl = createReadlineInterface();
      
      log('🔧 Setup Options:', 'blue');
      const countAnswer = await askQuestion(rl, `How many admin users to create? (default: ${options.count}): `);
      const count = parseInt(countAnswer) || options.count;

      for (let i = 0; i < count; i++) {
        log(`\n📝 Admin User ${i + 1}:`, 'blue');
        const username = await askQuestion(rl, `Username (default: admin${i + 1}): `) || `admin${i + 1}`;
        const email = await askQuestion(rl, `Email (default: ${username}@example.com): `) || `${username}@example.com`;
        const password = await askQuestion(rl, `Password (default: ${options.password}): `) || options.password;
        
        adminsToCreate.push({ username, email, password });
      }
      
      rl.close();
    } else {
      // Non-interactive mode: use defaults or command line args
      for (let i = 0; i < options.count; i++) {
        const username = i === 0 ? options.username : `${options.username.replace(/\d+$/, '') || 'admin'}${i + 1}`;
        const email = options.email || `${username}@example.com`;
        adminsToCreate.push({ username, email, password: options.password });
      }
    }

    // Create admin users
    log('\n👤 Creating admin users...', 'blue');
    let created = 0;
    let skipped = 0;

    for (let i = 0; i < adminsToCreate.length; i++) {
      const { username, email, password } = adminsToCreate[i];
      const result = await createAdminUser(db, username, email, password, i);
      if (result.created) {
        created++;
      } else if (result.exists) {
        skipped++;
      }
    }

    // Final summary
    log('\n📊 Summary:', 'cyan');
    log('════════════════════════════════════════', 'cyan');
    log(`  ✓ Created: ${created} admin user(s)`, created > 0 ? 'green' : 'yellow');
    log(`  ⚠ Skipped: ${skipped} existing user(s)`, skipped > 0 ? 'yellow' : 'cyan');
    
    // Show all admins
    const allAdmins = await checkExistingAdmins(db);
    if (allAdmins.length > 0) {
      log('\n📋 All admin users:', 'blue');
      log('────────────────────────────────────────────────', 'cyan');
      allAdmins.forEach((admin) => {
        log(`  ID: ${admin.id} | Username: ${admin.username} | Email: ${admin.email} | Role: ${admin.role}`, 'cyan');
      });
      log('────────────────────────────────────────────────', 'cyan');
    }

    // Close database
    db.close((err) => {
      if (err) {
        log(`\n✗ Error closing database: ${err.message}`, 'red');
        process.exit(1);
      } else {
        log('\n✅ Setup completed successfully!', 'green');
        log('\n💡 You can now login with the admin credentials.', 'cyan');
        process.exit(0);
      }
    });

  } catch (error) {
    log(`\n✗ Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupAdmins();
}

module.exports = { setupAdmins };

