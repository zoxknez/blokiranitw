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

```bash
# Build frontend
cd client
npm run build

# Pokreni production server
cd ../server
NODE_ENV=production npm start
```

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
