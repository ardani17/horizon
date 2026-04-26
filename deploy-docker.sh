#!/bin/bash
# ============================================
# Horizon Trader Platform — Docker Deploy Script
#
# Deploy seluruh stack di bare server yang hanya
# membutuhkan Docker dan Docker Compose.
#
# Usage: bash deploy-docker.sh
# ============================================

set -e

# ── Colors & helpers ────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }

banner() {
    echo ""
    echo "=========================================="
    echo "  Horizon Trader Platform — Docker Deploy"
    echo "=========================================="
    echo ""
}

# ── Detect docker compose command ───────────

detect_compose() {
    if docker compose version >/dev/null 2>&1; then
        COMPOSE="docker compose"
    elif docker-compose version >/dev/null 2>&1; then
        COMPOSE="docker-compose"
    else
        err "Docker Compose tidak ditemukan!"
        echo "  Install Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    ok "Menggunakan: $COMPOSE"
}

# ── 1. validate_env ─────────────────────────

validate_env() {
    info "Memeriksa file .env ..."

    if [ ! -f .env ]; then
        err "File .env tidak ditemukan!"
        echo "  Copy .env.example ke .env dan isi semua nilai yang diperlukan:"
        echo "    cp .env.example .env"
        exit 1
    fi

    # shellcheck disable=SC1091
    set -a
    source .env
    set +a

    ok "File .env ditemukan dan dimuat."
}

# ── 2. check_required_vars ──────────────────

check_required_vars() {
    info "Memvalidasi variabel wajib ..."

    local required_vars=(
        DOMAIN
        POSTGRES_DB
        POSTGRES_USER
        POSTGRES_PASSWORD
        TELEGRAM_BOT_TOKEN
        R2_ACCESS_KEY_ID
        R2_SECRET_ACCESS_KEY
        R2_BUCKET_NAME
        ADMIN_USERNAME
        ADMIN_PASSWORD
    )

    local missing=()

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing+=("$var")
        fi
    done

    if [ ${#missing[@]} -gt 0 ]; then
        err "Variabel wajib berikut belum diisi di .env:"
        for var in "${missing[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi

    # Validasi DOMAIN tidak mengandung placeholder
    case "$DOMAIN" in
        *yourdomain.com*|*example.com*)
            err "DOMAIN masih mengandung placeholder: $DOMAIN"
            echo "  Ganti dengan domain asli Anda di file .env"
            exit 1
            ;;
    esac

    # Validasi ADMIN_PASSWORD tidak mengandung default
    case "$ADMIN_PASSWORD" in
        *admin123*|*password*|*GANTI_PASSWORD*)
            err "ADMIN_PASSWORD masih menggunakan nilai default: $ADMIN_PASSWORD"
            echo "  Ganti dengan password yang kuat di file .env"
            exit 1
            ;;
    esac

    ok "Semua variabel wajib tervalidasi."
}

# ── 3. auto_construct_vars ──────────────────

auto_construct_vars() {
    info "Mengkonstruksi variabel otomatis ..."

    export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}/${POSTGRES_DB}"
    export TELEGRAM_WEBHOOK_URL="https://${DOMAIN}/webhook/telegram"
    export FRONTEND_URL="https://${DOMAIN}"
    export NEXT_PUBLIC_SITE_URL="https://${DOMAIN}"

    ok "DATABASE_URL       = postgresql://${POSTGRES_USER}:****@${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}/${POSTGRES_DB}"
    ok "TELEGRAM_WEBHOOK_URL = ${TELEGRAM_WEBHOOK_URL}"
    ok "FRONTEND_URL       = ${FRONTEND_URL}"
    ok "NEXT_PUBLIC_SITE_URL = ${NEXT_PUBLIC_SITE_URL}"
}

# ── 4. set_defaults ─────────────────────────

set_defaults() {
    info "Menetapkan nilai default untuk variabel opsional ..."

    export FRONTEND_PORT="${FRONTEND_PORT:-3000}"
    export BOT_PORT="${BOT_PORT:-4000}"

    export DB_DATA_DIR="${DB_DATA_DIR:-./data/postgres}"

    ok "Defaults: FRONTEND_PORT=${FRONTEND_PORT}, BOT_PORT=${BOT_PORT}"
    ok "Defaults: DB_DATA_DIR=${DB_DATA_DIR}"
}

# ── 5. setup_directories ───────────────────

setup_directories() {
    info "Membuat direktori yang diperlukan ..."

    mkdir -p "${DB_DATA_DIR}"

    ok "Direktori siap: ${DB_DATA_DIR}"
}

# ── 6. build_and_start ──────────────────────

build_and_start() {
    info "Building Docker images (--no-cache) ..."

    if ! $COMPOSE build --no-cache; then
        err "Docker build gagal! Periksa log di atas untuk detail error."
        exit 1
    fi

    ok "Build selesai."

    info "Menjalankan semua service ..."
    $COMPOSE up -d

    ok "Semua container dimulai."
}

# ── 7. health_check ─────────────────────────

health_check() {
    echo ""
    info "Menjalankan health check ..."
    echo ""

    local services=("db" "bot" "frontend")
    local containers=("horizon-db" "horizon-bot" "horizon-frontend")
    local max_retries=30
    local all_healthy=true

    for i in "${!services[@]}"; do
        local svc="${services[$i]}"
        local ctr="${containers[$i]}"
        local healthy=false

        echo -n "  ${svc}: "

        for attempt in $(seq 1 "$max_retries"); do
            local status
            status=$(docker inspect --format='{{.State.Health.Status}}' "$ctr" 2>/dev/null || echo "unknown")

            if [ "$status" = "healthy" ]; then
                healthy=true
                break
            fi
            sleep 2
        done

        if $healthy; then
            echo -e "${GREEN}✅ Healthy${NC}"
        else
            echo -e "${RED}❌ Not healthy${NC} (cek: docker logs ${ctr})"
            all_healthy=false
        fi
    done

    echo ""
    echo "=========================================="

    if $all_healthy; then
        echo -e "  ${GREEN}✅ Deploy berhasil! Semua service healthy.${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Deploy selesai, tapi ada service yang belum healthy.${NC}"
        echo "  Periksa log container yang bermasalah."
    fi

    echo ""
    echo "  Langkah selanjutnya:"
    echo "  0. Pastikan host reverse proxy sudah berjalan (lihat proxy/README.md)"
    echo "  1. Pastikan DNS A record untuk ${DOMAIN} mengarah ke IP server ini"
    echo "  2. Verifikasi HTTPS: https://${DOMAIN}"
    echo "  3. Cek admin panel: https://${DOMAIN}/admin"
    echo "  4. Cek bot status: https://${DOMAIN}/api/bot/status"
    echo ""
    echo "=========================================="
    echo ""
}

# ── Main ────────────────────────────────────

main() {
    banner
    detect_compose
    validate_env
    check_required_vars
    auto_construct_vars
    set_defaults
    setup_directories
    build_and_start
    health_check
}

main
