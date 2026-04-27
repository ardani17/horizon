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
- **Deployment:** Docker Compose, aaPanel Nginx reverse proxy, Cloudflare SSL

## Penggunaan Telegram Bot

### Hashtag Triggers

Kirim pesan di grup Telegram dengan hashtag berikut untuk auto-publish artikel ke website:

| Hashtag | Kategori | Kredit |
|---------|----------|--------|
| `#trading` | Trading | 10 |
| `#cerita` | Life Story | 5 |
| `#general` | General | 3 |

Setiap kategori memiliki tepat satu hashtag (1:1 mapping). Hashtag yang dikenali akan otomatis dihapus dari konten artikel yang dipublikasikan.

**Contoh:**
```
#trading Hari ini saya belajar tentang support dan resistance.
Ternyata penting banget untuk menentukan entry point...
```

Bot akan otomatis:
1. Membuat artikel di website (draft untuk member, published untuk admin)
2. Menghapus hashtag dari konten artikel
3. Mengupload foto/video jika ada lampiran
4. **Member:** Reply "Menunggu persetujuan admin" — artikel perlu di-approve admin via `/publish`
5. **Admin:** Langsung publish, memberikan kredit, dan menghapus pesan dari grup

### Slash Commands

| Command | Akses | Deskripsi |
|---------|-------|-----------|
| `/publish` | Admin | Balas pesan draft member dengan `/publish` untuk approve dan publikasikan |
| `/help` | Semua | Tampilkan daftar command yang tersedia |

**Contoh `/publish` (admin only):**
```
[Balas pesan draft member di grup]
/publish
```
Bot akan:
1. Mencari artikel draft berdasarkan message ID pesan yang dibalas
2. Mengubah status artikel dari `draft` ke `published`
3. Memberikan kredit ke penulis asli (bukan admin)
4. Menghapus pesan asli, balasan bot, dan command `/publish` dari grup
5. Mengirim konfirmasi sementara yang auto-delete setelah 5 detik

> **Catatan:** `/publish` hanya bisa approve artikel draft yang sudah dibuat via hashtag. Tidak bisa mempublikasikan pesan biasa.

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
- Domain yang sudah diarahkan ke IP server (DNS A record)
- Telegram Bot Token (dari [@BotFather](https://t.me/BotFather))
- Cloudflare R2 bucket (untuk media storage)

### 1. Clone & Konfigurasi Environment

```bash
git clone <repository-url>
cd horizon-trader-platform

cp .env.example .env
```

Edit `.env` dan isi semua variabel yang bertanda `[REQUIRED]`. Variabel bertanda `[AUTO-CONSTRUCTED]` tidak perlu diisi — nilainya dikonstruksi otomatis oleh deploy script.

Variabel wajib:

```env
# Domain & SSL
DOMAIN=yourdomain.com
SSL_EMAIL=admin@yourdomain.com

# Database
POSTGRES_DB=horizon
POSTGRES_USER=horizon_user
POSTGRES_PASSWORD=password_aman_anda

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...

# Cloudflare R2
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=horizon-media

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password_admin_aman
```

Lihat `.env.example` untuk daftar lengkap variabel beserta penjelasannya.

### 2. Deploy

```bash
bash deploy-docker.sh
```

Script ini akan:
1. Validasi semua variabel wajib di `.env`
2. Auto-construct `DATABASE_URL`, `TELEGRAM_WEBHOOK_URL`, `FRONTEND_URL`, `NEXT_PUBLIC_SITE_URL`
3. Generate sertifikat self-signed sementara (jika belum ada)
4. Build semua Docker image (`--no-cache`)
5. Start semua service (db, bot, frontend, nginx, certbot)
6. Request sertifikat Let's Encrypt (jika DNS sudah benar)
7. Tampilkan health check status

Setelah deploy berhasil:
- Website: `https://yourdomain.com`
- Admin: `https://yourdomain.com/admin`
- Bot API: `https://yourdomain.com/api/bot/status`

### 3. Setup Reverse Proxy (aaPanel)

Platform ini menggunakan **2 port** yang perlu di-reverse-proxy oleh aaPanel Nginx:

| Service | Host Port | Container Port | Path |
|---------|-----------|----------------|------|
| Frontend (Next.js) | `127.0.0.1:3888` | `3000` | `/`, `/_next/*` |
| Bot (Express) | `127.0.0.1:4888` | `4000` | `/api/bot/*`, `/webhook/telegram` |

**Langkah setup di aaPanel:**

1. Buka aaPanel → **Website** → **Add Site** → masukkan domain (misal `horizon.cloudnexify.com`)
2. Buka site config → **Config** (ikon Nginx)
3. Paste location blocks berikut di dalam `server {}` block:

```nginx
# --- Frontend (semua request default) ---
location / {
    proxy_pass http://127.0.0.1:3888;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

# --- Bot API routes ---
location /api/bot/ {
    proxy_pass http://127.0.0.1:4888;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# --- Telegram Webhook ---
location = /webhook/telegram {
    proxy_pass http://127.0.0.1:4888;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# --- Next.js Static Assets (long-term cache) ---
location /_next/static/ {
    proxy_pass http://127.0.0.1:3888;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# --- Next.js Image Optimization ---
location /_next/image {
    proxy_pass http://127.0.0.1:3888;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

> **Penting:** Jangan gunakan fitur "Reverse Proxy" bawaan aaPanel karena hanya support 1 target. Paste langsung di Nginx config supaya bisa routing ke 2 port berbeda berdasarkan path.

File referensi lengkap: `aapanel-nginx.conf`

Port host bisa dikustomisasi via `.env`:
```env
FRONTEND_HOST_PORT=3888   # default
BOT_HOST_PORT=4888        # default
```

### 4. Setup Telegram Webhook

Webhook otomatis dikonstruksi dari variabel `DOMAIN` (`https://<DOMAIN>/webhook/telegram`). Setelah deploy, set webhook:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://yourdomain.com/webhook/telegram"}'
```

### 5. Re-deploy & Update

Script `deploy-docker.sh` bersifat idempotent — aman dijalankan berulang kali:

```bash
bash deploy-docker.sh
```

- Jika sertifikat Let's Encrypt sudah ada, tidak akan request ulang
- Selalu build fresh image untuk memastikan perubahan kode ter-deploy
- Data database aman (bind mount di `${DB_DATA_DIR}`)

### 6. Backup Database

Data PostgreSQL disimpan di host directory (default: `./data/postgres`). Untuk backup:

```bash
# Copy langsung dari host
cp -r ./data/postgres /path/to/backup/

# Atau gunakan pg_dump via container
docker exec horizon-db pg_dump -U horizon_user horizon > backup.sql
```

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
├── nginx/                  # Nginx reverse proxy config
│   ├── nginx.conf          # Main config (rate limit template)
│   ├── templates/
│   │   └── default.conf.template  # Server blocks (envsubst template)
│   └── docker-entrypoint.sh       # Custom entrypoint for envsubst
├── docker-compose.yml      # Full Docker stack (semua service)
├── deploy-docker.sh        # Deploy script untuk bare server
├── aapanel-nginx.conf      # Referensi config Nginx untuk aaPanel reverse proxy
└── .env.example            # Template environment variables (dokumentasi lengkap)
```

## Lisensi

Private — Horizon Trader Platform.
