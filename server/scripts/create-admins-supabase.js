// Script za kreiranje admin korisnika koristeći Supabase Admin API
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kvbppgfwqnwvwubaendh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Ako nemamo service role key, koristićemo direktnu PostgreSQL konekciju
const DATABASE_URL = process.env.DATABASE_URL || 
                     process.env.SUPABASE_DB_URL || 
                     'postgresql://postgres:MUK0DK9s1VIJHNUX@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

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

async function createAdminsViaPostgres() {
  const { Client } = require('pg');
  const bcrypt = require('bcryptjs');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000
  });
  
  console.log('Connecting to database via PostgreSQL...');
  console.log('Database URL:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

  try {
    await client.connect();
    console.log('✓ Connected to Supabase database');

    // Proveri/kreiraj admin_users tabelu
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_users'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('Creating admin_users table...');
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
      console.log('✓ admin_users table created');
    } else {
      console.log('✓ admin_users table already exists');
    }

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
    const allAdmins = await client.query('SELECT id, username, email, role, created_at FROM admin_users ORDER BY id');
    console.log('\n📋 All admin users:');
    console.log('─'.repeat(80));
    allAdmins.rows.forEach(admin => {
      console.log(`ID: ${admin.id} | Username: ${admin.username} | Email: ${admin.email} | Role: ${admin.role}`);
    });
    console.log('─'.repeat(80));

  } catch (error) {
    console.error('✗ Database error:', error.message);
    console.error('Error details:', error);
    throw error;
  } finally {
    await client.end();
    console.log('\n✓ Connection closed');
  }
}

// Main execution
(async () => {
  try {
    await createAdminsViaPostgres();
    console.log('\n✅ Script completed successfully!');
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
})();

