// Script za kreiranje admin korisnika - pokreni sa tačnom connection string putanjom
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

// Koristi connection string koji si dao
const DATABASE_URL = process.env.DATABASE_URL || 
                     'postgresql://postgres:MUK0DK9s1VIJHNUX@db.kvbppgfwqnwvwubaendh.supabase.co:5432/postgres';

const admins = [
  {
    username: 'admin1',
    email: 'admin1@example.com',
    password: 'Admin123!'
  },
  {
    username: 'admin2',
    email: 'admin2@example.com',
    password: 'Admin123!'
  }
];

async function createAdmins() {
  // Probaj različite connection opcije
  const connectionOptions = [
    {
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    {
      host: 'db.kvbppgfwqnwvwubaendh.supabase.co',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'MUK0DK9s1VIJHNUX',
      ssl: { rejectUnauthorized: false }
    },
    {
      connectionString: DATABASE_URL.replace(':5432/', ':6543/'),
      ssl: { rejectUnauthorized: false }
    }
  ];

  let client = null;
  let connected = false;

  for (let i = 0; i < connectionOptions.length; i++) {
    try {
      console.log(`\nTrying connection option ${i + 1}...`);
      client = new Client(connectionOptions[i]);
      await client.connect();
      console.log('✓ Connected to Supabase database!');
      connected = true;
      break;
    } catch (error) {
      console.log(`✗ Connection failed: ${error.message}`);
      if (client) {
        try { await client.end(); } catch {}
      }
    }
  }

  if (!connected) {
    console.error('\n❌ Could not connect to database. Please check:');
    console.error('1. Connection string is correct');
    console.error('2. Database allows connections from your IP');
    console.error('3. Credentials are correct');
    console.error('\nAlternatively, use SQL script: supabase/create-admins.sql');
    console.error('Run it in Supabase Dashboard -> SQL Editor');
    process.exit(1);
  }

  try {
    // Kreiraj/kreiraj admin_users tabelu


    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );
    `);
    console.log('✓ admin_users table ready');

    // Kreiraj admin korisnike
    for (const admin of admins) {
      try {
        const existing = await client.query(
          'SELECT id FROM admin_users WHERE username = $1 OR email = $2',
          [admin.username, admin.email]
        );

        if (existing.rows.length > 0) {
          console.log(`⚠ Admin ${admin.username} already exists, skipping...`);
          continue;
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(admin.password, saltRounds);

        const result = await client.query(
          `INSERT INTO admin_users (username, email, password_hash, role) 
           VALUES ($1, $2, $3, 'admin') 
           RETURNING id, username, email`,
          [admin.username, admin.email, passwordHash]
        );

        console.log(`✓ Created admin: ${result.rows[0].username} (ID: ${result.rows[0].id})`);
        console.log(`  Email: ${result.rows[0].email}`);
        console.log(`  Password: ${admin.password}`);
        console.log('');
      } catch (error) {
        if (error.code === '23505') {
          console.log(`⚠ Admin ${admin.username} already exists, skipping...`);
        } else {
          console.error(`✗ Error creating admin ${admin.username}:`, error.message);
        }
      }
    }

    // Prikaži sve admin korisnike
    const allAdmins = await client.query(
      'SELECT id, username, email, role, created_at FROM admin_users ORDER BY id'
    );
    console.log('\n📋 All admin users:');
    console.log('─'.repeat(80));
    allAdmins.rows.forEach(admin => {
      console.log(`ID: ${admin.id} | Username: ${admin.username} | Email: ${admin.email} | Role: ${admin.role}`);
    });
    console.log('─'.repeat(80));

  } catch (error) {
    console.error('✗ Database error:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n✓ Connection closed');
  }
}

(async () => {
  try {
    await createAdmins();
    console.log('\n✅ Script completed successfully!');
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    console.error('\n💡 Alternative: Use SQL script in Supabase Dashboard:');
    console.error('   1. Go to Supabase Dashboard -> SQL Editor');
    console.error('   2. Run: supabase/create-admins.sql');
    process.exit(1);
  }
})();

