# Horizon Trader Platform

Platform komunitas trader dengan integrasi Telegram Bot dan website bergaya retro blogger. Anggota grup Telegram bisa mempublikasikan artikel langsung ke website melalui hashtag atau command bot, dan mendapatkan kredit sebagai reward.

## Arsitektur

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Telegram Group  │────▶│  Bot Service      │────▶│  PostgreSQL  │
│  (Members)       │     │  (Express + grammy)│◀───│  Database    │
└─────────────────┘     └──────────────────┘     └──────────────┘
                              │                        ▲
                              ▼                        │
                        ┌──────────────┐         ┌──────────────┐
                        │  Cloudflare  │         │  Frontend    │
                        │  R2 Storage  │         │  (Next.js)   │
                        └──────────────┘         └──────────────┘
```

**Tech Stack:**
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Bot:** Node.js, Express, grammy (Telegram Bot framework)
- **Database:** PostgreSQL 16
- **Media Storage:** Cloudflare R2
- **Deployment:** Docker Compose, Nginx reverse proxy

## Penggunaan Telegram Bot

### Hashtag Triggers

Kirim pesan di grup Telegram dengan hashtag berikut untuk auto-publish artikel ke website:

| Hashtag | Kategori | Kredit |
|---------|----------|--------|
| `#jurnal` | Trading | 10 |
| `#trading` | Trading | 10 |
| `#cerita` | Life Story | 5 |
| `#kehidupan` | Life Story | 5 |

**Contoh:**
```
#jurnal Hari ini saya belajar tentang support dan resistance.
Ternyata penting banget untuk menentukan entry point...
```

Bot akan otomatis:
1. Membuat artikel di website dengan kategori **Trading**
2. Mengupload foto/video jika ada lampiran
3. Memberikan **10 kredit** ke akun pengirim

### Slash Commands

| Command | Akses | Deskripsi |
|---------|-------|-----------|
| `/story [teks]` | Member | Buat cerita pendek (short post), kategori: life_story |
| `/cerita [teks]` | Member | Buat cerita panjang (long-form article), kategori: life_story |
| `/publish` | Admin | Balas pesan orang lain dengan `/publish` untuk mempublikasikannya |
| `/help` | Semua | Tampilkan daftar command yang tersedia |

**Contoh `/story`:**
```
/story Pengalaman pertama saya trading forex. Awalnya rugi terus, tapi setelah belajar money management akhirnya mulai profit konsisten.
```

**Contoh `/publish` (admin only):**
```
[Balas pesan anggota grup]
/publish
```
Bot akan mempublikasikan pesan yang dibalas sebagai artikel. Kategori ditentukan dari hashtag di pesan asli, default ke "general".

### Sistem Kredit

Setiap artikel yang dipublikasikan memberikan kredit ke pengirim:

| Kategori | Kredit per Artikel |
|----------|--------------------|
| Trading | 10 |
| Life Story | 5 |
| General | 3 |

Nilai kredit bisa diubah oleh admin melalui dashboard.

## Fitur Website

### Halaman Publik
- **Feed** (`/`) — Daftar artikel terbaru dengan filter kategori (Trading Room, Life & Coffee, General)
- **Detail Artikel** (`/artikel/[slug]`) — Artikel lengkap dengan komentar, like, dan sharing
- **Gallery** (`/gallery`) — Grid media bergaya Instagram dengan lightbox
- **Outlook** (`/outlook`) — Konten long-form khusus dari admin

### Admin Dashboard (`/admin`)
- **Dashboard** — Statistik, grafik aktivitas, top kontributor
- **Artikel** — CRUD, ubah status (published/hidden), bulk actions
- **Outlook** — Upload artikel long-form dengan rich text editor
- **Users** — Profil member, saldo kredit, riwayat artikel, manajemen role
- **Komentar** — Moderasi (hide/delete)
- **Kredit** — Setting per kategori, adjustment manual, riwayat transaksi
- **API Keys** — Generate dan kelola akses API eksternal
- **Logs** — Audit trail aktivitas platform

## Setup & Instalasi

### Prasyarat

- Docker & Docker Compose
- Telegram Bot Token (dari [@BotFather](https://t.me/BotFather))
- Cloudflare R2 bucket (untuk media storage)

### 1. Clone & Konfigurasi Environment

```bash
git clone <repository-url>
cd horizon-trader-platform

cp .env.example .env
```

Edit `.env` dan isi semua nilai yang diperlukan:

```env
# Database
POSTGRES_PASSWORD=password_aman_anda

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_GROUP_ID=-1001234567890
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/webhook/telegram

# Cloudflare R2
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=horizon-media
R2_PUBLIC_URL=https://your-r2-public-url.com

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password_admin_aman
```

### 2. Jalankan dengan Docker Compose

**Development:**
```bash
docker compose up -d --build
```

Akses:
- Frontend: http://localhost:80
- Bot API: http://localhost:4000/api/bot/status
- Database: localhost:5432

**Production (AAPanel):**
```bash
bash deploy.sh
```

Script ini akan:
1. Validasi file `.env`
2. Build semua image
3. Start semua service
4. Verifikasi health check

Akses setelah deploy:
- Frontend: http://127.0.0.1:3888
- Bot API: http://127.0.0.1:4888/api/bot/status

### 3. Setup Telegram Webhook

Setelah service berjalan, set webhook Telegram ke URL bot Anda:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://yourdomain.com/webhook/telegram"}'
```

### 4. Setup Reverse Proxy (Production)

Untuk AAPanel, paste konfigurasi dari `aapanel-nginx.conf` ke site config:

| Path | Target |
|------|--------|
| `/` | Frontend (localhost:3888) |
| `/api/bot/*` | Bot (localhost:4888) |
| `/webhook/telegram` | Bot (localhost:4888) |
| `/_next/static/` | Frontend + cache 1 tahun |

## Development

### Menjalankan Tanpa Docker

```bash
# Install dependencies
npm install

# Frontend (Next.js dev server)
npm run dev:frontend

# Bot (dengan hot reload)
npm run dev:bot
```

### Scripts

| Script | Deskripsi |
|--------|-----------|
| `npm run dev:frontend` | Start Next.js dev server |
| `npm run dev:bot` | Start bot dengan hot reload (tsx watch) |
| `npm run build:frontend` | Build Next.js untuk production |
| `npm run build:bot` | Compile TypeScript bot |
| `npm run lint` | Jalankan ESLint |
| `npm run test` | Jalankan test suite (vitest) |
| `npm run test:property` | Jalankan property-based tests |

## Bot API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/bot/status` | Health check (uptime, status) |
| GET | `/api/bot/commands` | Daftar command terdaftar |
| GET | `/api/bot/stats` | Statistik penggunaan command |
| POST | `/api/bot/notify` | Kirim notifikasi ke grup |
| POST | `/webhook/telegram` | Telegram webhook receiver |

## Database

### Tabel Utama

| Tabel | Deskripsi |
|-------|-----------|
| `users` | Member dan admin (telegram_id, role, credit_balance) |
| `articles` | Artikel yang dipublikasikan (content_html, category, slug) |
| `media` | Foto/video lampiran (file_url, media_type) |
| `credit_transactions` | Ledger kredit (amount, transaction_type) |
| `credit_settings` | Konfigurasi reward per kategori |
| `activity_logs` | Audit trail immutable |
| `comments` | Komentar artikel (anonim/member) |
| `likes` | Like artikel (fingerprint-based) |
| `api_keys` | Akses API eksternal |
| `admin_sessions` | Session token admin |

### Migrasi

Migrasi dijalankan otomatis saat pertama kali PostgreSQL container di-start melalui `db/init.sh`.

## Struktur Proyek

```
horizon-trader-platform/
├── bot/                    # Telegram Bot service
│   ├── src/
│   │   ├── commands/       # Command registry & types
│   │   ├── handlers/       # Command & hashtag handlers
│   │   ├── middleware/      # Auth, rate limit, logging
│   │   ├── routes/         # REST API routes
│   │   ├── services/       # Media upload service
│   │   └── index.ts        # Express entry point
│   └── Dockerfile
├── frontend/               # Next.js website
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/      # Admin dashboard
│   │   │   ├── api/        # API routes
│   │   │   └── ...         # Public pages
│   │   ├── components/     # Reusable UI components
│   │   └── lib/            # Utilities & DB queries
│   └── Dockerfile
├── shared/                 # Shared TypeScript code
│   ├── db/                 # DB connection & queries
│   ├── services/           # Shared services
│   ├── types/              # Shared type definitions
│   └── utils/              # Slug, HTML, errors, etc.
├── db/
│   ├── migrations/         # SQL schema & seed data
│   └── init.sh             # DB initialization script
├── docker-compose.yml      # Development config
├── docker-compose.prod.yml # Production config (AAPanel)
├── deploy.sh               # Deployment script
├── aapanel-nginx.conf      # Nginx reverse proxy config
└── .env.example            # Template environment variables
```

## Lisensi

Private — Horizon Trader Platform.
