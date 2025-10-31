-- SQL script za kreiranje 2 admin korisnika u Supabase PostgreSQL bazi
-- Pokreni ovaj script u Supabase Dashboard -> SQL Editor

-- Kreiraj admin_users tabelu ako ne postoji (PostgreSQL sintaksa)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- Kreiraj indexe za brže pretrage
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON public.admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);

-- Kreiraj funkciju za bcrypt hash (ili koristi JavaScript funkciju)
-- Prvo generiši hash u Node.js: bcrypt.hash('Admin123!', 10)
-- Za sada koristimo dummy hash - moraš generisati pravi

-- OBRISI postojeće admin korisnike ako postoje (opciono)
-- DELETE FROM public.admin_users WHERE username IN ('admin1', 'admin2');

-- Kreiraj admin1
-- Password: Admin123!
-- Hash mora biti generisan u Node.js: bcrypt.hash('Admin123!', 10)
INSERT INTO public.admin_users (username, email, password_hash, role)
VALUES (
  'admin1',
  'admin1@example.com',
  '$2a$10$YB/NBTKGC5Swy0dBOaKIn.xaZBRqOJy6K4P36k6gkl2pD8d7qFtDe', -- Admin123! hash (bcrypt)
  'admin'
)
ON CONFLICT (username) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash;

-- Kreiraj admin2
-- Password: Admin123!
INSERT INTO public.admin_users (username, email, password_hash, role)
VALUES (
  'admin2',
  'admin2@example.com',
  '$2a$10$YB/NBTKGC5Swy0dBOaKIn.xaZBRqOJy6K4P36k6gkl2pD8d7qFtDe', -- Admin123! hash (bcrypt)
  'admin'
)
ON CONFLICT (username) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash;

-- Prikaži sve admin korisnike
SELECT id, username, email, role, created_at 
FROM public.admin_users 
ORDER BY id;
