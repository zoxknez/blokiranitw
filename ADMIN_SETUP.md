# Admin Setup - Kreiranje Admin Korisnika

## Opcija 1: SQL Script (NAJLAGANJE - Preporučeno)

1. Idi na [Supabase Dashboard](https://supabase.com/dashboard)
2. Izaberi projekat
3. Idi na **SQL Editor**
4. Kopiraj i pokreni sadržaj fajla `supabase/create-admins.sql`

Ovo će kreirati:
- ✅ **admin1** - Email: `admin1@example.com` - Password: `Admin123!`
- ✅ **admin2** - Email: `admin2@example.com` - Password: `Admin123!`

## Opcija 2: Node.js Script

```bash
# Sa connection string-om
cd server
DATABASE_URL="postgresql://postgres:MUK0DK9s1VIJHNUX@db.kvbppgfwqnwvwubaendh.supabase.co:5432/postgres" node scripts/create-admins-direct.js
```

**Napomena:** Možda neće raditi zbog IP ograničenja Supabase-a. U tom slučaju koristi Opciju 1 (SQL Script).

## Admin Korisnici

| Username | Email | Password |
|----------|-------|----------|
| admin1 | admin1@example.com | Admin123! |
| admin2 | admin2@example.com | Admin123! |

**⚠️ VAŽNO:** Promeni passworde nakon prvog logina!

## Verifikacija

Nakon kreiranja, proveri u Supabase Dashboard:
1. SQL Editor → Pokreni: `SELECT * FROM admin_users;`
2. Trebalo bi da vidiš 2 admin korisnika

## Login

Koristi ove credentials za login u aplikaciji:
- Username: `admin1` ili `admin2`
- Password: `Admin123!`

