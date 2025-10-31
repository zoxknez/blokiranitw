# Twitter Blocked Users Search App

Modern web aplikacija za pretragu i upravljanje blokiranim korisnicima sa Twitter-a. Aplikacija je napravljena sa najnovijim tehnologijama i ima lep, responzivni dizajn.

## 🚀 Tehnologije

### Backend
- **Node.js** sa **Express.js** - REST API
- **SQLite** - baza podataka
- **Multer** - upload fajlova
- **CORS** - cross-origin requests

### Frontend
- **React 18** sa **TypeScript** - moderni UI framework
- **Tailwind CSS** - utility-first CSS framework
- **Lucide React** - ikone
- **Axios** - HTTP klijent

## ✨ Funkcionalnosti

- 🔍 **Napredna pretraga** - pretraživanje po korisničkom imenu
- 📊 **Statistike** - prikaz ukupnog broja blokiranih korisnika
- 📄 **Paginacija** - efikasno prikazivanje velikih lista
- 🎨 **Tamni/Svetli režim** - automatska detekcija preferenci
- ➕ **Dodavanje korisnika** - ručno dodavanje novih korisnika
- ✏️ **Izmena korisnika** - ažuriranje postojećih podataka
- 🗑️ **Brisanje korisnika** - uklanjanje korisnika iz liste
- 📤 **Import JSON** - masovni import iz JSON fajla
- 📱 **Responzivni dizajn** - radi na svim uređajima
- ⚡ **Brza pretraga** - debounced search sa 300ms delay

## 🛠️ Instalacija i pokretanje

### Preduslovi
- Node.js (v16 ili noviji)
- npm ili yarn
- Docker Desktop (za lokalni Supabase development)

### Korak 1: Kloniranje repozitorija
```bash
git clone <repository-url>
cd twitter-blocked-users-app
```

### Korak 2: Instalacija dependencija
```bash
# Instaliraj sve dependencije
npm run install-all

# Ili ručno:
npm install
cd server && npm install
cd ../client && npm install
```

### Korak 2.5: Supabase CLI Setup (opciono za lokalni development)
```bash
# Supabase CLI je već instaliran kao dev dependency
# Inicijalizuj Supabase projekat (već urađeno)
npm run supabase:start   # Pokreni lokalni Supabase stack
npm run supabase:status  # Proveri status servisa
npm run supabase:stop    # Zaustavi lokalni stack

# Prilikom prvog pokretanja, CLI će skinuti Docker image-e
# Nakon pokretanja, videćeš credentials za lokalni Supabase:
# - API URL: http://localhost:54321
# - DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# - Studio URL: http://localhost:54323 (Supabase Studio UI)
# - Mailpit URL: http://localhost:54324 (email testing)
```

### Korak 3: Pokretanje aplikacije

#### Development režim (preporučeno)
```bash
# Pokreni i backend i frontend istovremeno
npm run dev
```

#### Ili ručno:
```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend  
cd client
npm start
```

### Korak 4: Pristup aplikaciji
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 📁 Struktura projekta

```
twitter-blocked-users-app/
├── server/                 # Backend API
│   ├── index.js           # Glavni server fajl
│   ├── package.json       # Backend dependencije
│   └── blocked_users.db   # SQLite baza (kreirana automatski)
├── client/                # React frontend
│   ├── public/            # Statički fajlovi
│   ├── src/
│   │   ├── components/    # React komponente
│   │   ├── services/      # API servisi
│   │   ├── types/         # TypeScript tipovi
│   │   └── App.tsx        # Glavna komponenta
│   ├── package.json       # Frontend dependencije
│   └── tailwind.config.js # Tailwind konfiguracija
├── blocked_users.json     # Originalni JSON sa podacima
├── package.json           # Root package.json
└── README.md
```

## 🔧 API Endpoints

### Korisnici
- `GET /api/users` - Lista korisnika sa paginacijom i pretragom
- `GET /api/users/:id` - Dohvatanje korisnika po ID-u
- `POST /api/users` - Dodavanje novog korisnika
- `PUT /api/users/:id` - Ažuriranje korisnika
- `DELETE /api/users/:id` - Brisanje korisnika

### Statistike
- `GET /api/stats` - Dohvatanje statistika

### Import
- `POST /api/import` - Import korisnika iz JSON fajla

## 📊 Baza podataka

Aplikacija koristi SQLite bazu sa sledećom strukturom:

```sql
CREATE TABLE blocked_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  profile_url TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🎨 Dizajn

Aplikacija koristi moderni, čist dizajn sa:
- **Tailwind CSS** za styling
- **Lucide React** za ikone
- **Responzivni grid** layout
- **Dark/Light mode** podrška
- **Smooth animacije** i tranzicije
- **Loading states** i error handling

## 🚀 Production build

### Backend (Railway)

```bash
# Build frontend
cd client
npm run build

# Railway će automatski pokrenuti server/index.js
# Postavi environment variables u Railway Dashboard
```

**Environment Variables za Railway:**
- `SUPABASE_JWKS_URL`: `https://kvbppgfwqnwvwubaendh.supabase.co/auth/v1/keys`
- `JWT_SECRET`: generiši jaki random secret
- `ALLOWED_ORIGIN`: tvoj frontend URL
- `FORCE_HTTPS`: `true`
- `NODE_ENV`: `production`

### Frontend (Vercel/Netlify)

**Environment Variables za Frontend:**
- `REACT_APP_SUPABASE_URL`: `https://kvbppgfwqnwvwubaendh.supabase.co`
- `REACT_APP_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YnBwZ2Z3cW53dnd1YmFlbmRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NjcwNzYsImV4cCI6MjA3NzM0MzA3Nn0.qs-Vk8rwl2DNq5T7hDw4W9Fi6lSdWzET35sdy2anv9U`
- `REACT_APP_API_URL`: tvoj Railway backend URL

Vidi [SUPABASE_PRODUCTION.md](./SUPABASE_PRODUCTION.md) za detaljne instrukcije.

## 🔐 Autentifikacija i Admin Panel

### Javni pristup
- **Svi korisnici** mogu da vide listu blokiranih korisnika
- **Svi korisnici** mogu da predlože nove korisnike za blokiranje
- **Samo admin** može da dodaje, menja i briše korisnike

### Admin funkcionalnosti
- **Registracija/Login** - samo admin može da se registruje
- **Dodavanje korisnika** - direktno dodavanje u listu
- **Import JSON** - masovni import iz fajla
- **Admin Panel** - pregled i verifikacija predloga
- **Upravljanje korisnicima** - izmena i brisanje

### Kreiranje admin naloga
1. Pokrenite aplikaciju
2. Kliknite "Prijavi se" u header-u
3. Kliknite "Registrujte se"
4. Unesite admin podatke (username, email, password)
5. Sada imate pristup admin funkcionalnostima

## 📝 Napomene

- Aplikacija automatski importuje podatke iz `blocked_users.json` pri prvom pokretanju
- SQLite baza se kreira automatski u `server/blocked_users.db`
- Svi podaci se čuvaju lokalno u SQLite bazi
- Aplikacija podržava ažuriranje liste kroz import funkcionalnost
- **Predlozi korisnika** se čuvaju u bazi i čekaju admin verifikaciju
- **Admin panel** omogućava pregled svih predloga i njihovu verifikaciju

## 🤝 Doprinosi

Dobrodošli su doprinosi! Molimo otvorite issue ili pull request.

## 📄 Licenca

MIT License
