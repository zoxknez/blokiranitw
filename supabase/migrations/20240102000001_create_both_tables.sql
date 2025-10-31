-- Kreiraj OBE tabele: users i admin_users

-- 1. Kreiraj users tabelu (za obične korisnike - BEZ role kolone)
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- Kreiraj indexe za users
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- RLS za users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read users" ON public.users;
CREATE POLICY "Allow anon read users" ON public.users
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert and update users" ON public.users;
CREATE POLICY "Allow insert and update users" ON public.users
  FOR ALL 
  USING (
    auth.role() = 'service_role' OR 
    auth.role() = 'anon'
  )
  WITH CHECK (
    auth.role() = 'service_role' OR 
    auth.role() = 'anon'
  );

-- 2. Kreiraj admin_users tabelu (SAMO za admin korisnike - SA role kolonom)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',  -- DEFAULT je 'admin' jer su samo admini ovde
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- Kreiraj indexe za admin_users
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON public.admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);

-- RLS za admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read admin_users" ON public.admin_users;
CREATE POLICY "Allow anon read admin_users" ON public.admin_users
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert and update admin_users" ON public.admin_users;
CREATE POLICY "Allow insert and update admin_users" ON public.admin_users
  FOR ALL 
  USING (
    auth.role() = 'service_role' OR 
    auth.role() = 'anon'
  )
  WITH CHECK (
    auth.role() = 'service_role' OR 
    auth.role() = 'anon'
  );

-- Provera
SELECT 
  'Tables created!' as status,
  (SELECT COUNT(*) FROM public.users) as users_count,
  (SELECT COUNT(*) FROM public.admin_users) as admin_users_count;

