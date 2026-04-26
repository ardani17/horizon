#!/bin/bash
# ============================================
# Host-Level Reverse Proxy — Deploy & Manage
#
# Script untuk deploy, reload, dan monitoring
# Nginx reverse proxy host-level.
#
# Usage:
#   bash deploy.sh              # Deploy (default)
#   bash deploy.sh deploy       # Deploy
#   bash deploy.sh reload       # Reload konfigurasi Nginx
#   bash deploy.sh status       # Tampilkan status container
#   bash deploy.sh logs         # Tampilkan log container
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
    echo "  Host Reverse Proxy — Deploy & Manage"
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

# ── SSL certificate validation ──────────────

SSL_DIR="${SSL_DIR:-/etc/ssl/cloudflare}"

validate_ssl() {
    info "Memeriksa sertifikat SSL di ${SSL_DIR}/ ..."

    # Create SSL directory if missing
    if [ ! -d "$SSL_DIR" ]; then
        info "Membuat direktori ${SSL_DIR}/ ..."
        mkdir -p "$SSL_DIR"
    fi

    # Scan for at least one subdirectory with cert.pem and key.pem
    local found=false
    for domain_dir in "$SSL_DIR"/*/; do
        # Skip if glob didn't match (no subdirectories)
        [ -d "$domain_dir" ] || continue

        local cert_file="${domain_dir}cert.pem"
        local key_file="${domain_dir}key.pem"

        if [ -f "$cert_file" ] && [ -f "$key_file" ]; then
            local domain_name
            domain_name=$(basename "$domain_dir")
            ok "Sertifikat ditemukan untuk: ${domain_name}"
            found=true
        fi
    done

    if [ "$found" = false ]; then
        err "Tidak ada sertifikat SSL yang ditemukan di ${SSL_DIR}/!"
        echo ""
        echo "  Untuk membuat Cloudflare Origin Certificate:"
        echo "  1. Login ke Cloudflare Dashboard → pilih domain Anda"
        echo "  2. Buka SSL/TLS → Origin Server → Create Certificate"
        echo "  3. Pilih key type (RSA atau ECDSA) dan hostnames"
        echo "  4. Simpan certificate dan private key ke server:"
        echo ""
        echo "     sudo mkdir -p ${SSL_DIR}/<domain-anda>"
        echo "     sudo nano ${SSL_DIR}/<domain-anda>/cert.pem   # Paste Origin Certificate"
        echo "     sudo nano ${SSL_DIR}/<domain-anda>/key.pem    # Paste Private Key"
        echo "     sudo chmod 600 ${SSL_DIR}/<domain-anda>/key.pem"
        echo ""
        echo "  5. Pastikan Cloudflare SSL/TLS mode diset ke 'Full (Strict)'"
        echo "  6. Jalankan ulang: bash deploy.sh"
        echo ""
        exit 1
    fi
}

# ── Docker network setup ───────────────────

setup_network() {
    info "Memeriksa Docker network proxy-net ..."

    if docker network inspect proxy-net >/dev/null 2>&1; then
        ok "Network proxy-net sudah ada."
    else
        info "Membuat Docker network proxy-net ..."
        if docker network create proxy-net; then
            ok "Network proxy-net berhasil dibuat."
        else
            err "Gagal membuat network proxy-net!"
            exit 1
        fi
    fi
}

# ── Deploy action ───────────────────────────

do_deploy() {
    info "Memulai deploy reverse proxy ..."

    validate_ssl
    setup_network

    info "Building dan starting container ..."
    if ! $COMPOSE up -d --build; then
        err "Gagal menjalankan container! Periksa log:"
        $COMPOSE logs --tail=50
        exit 1
    fi

    ok "Container dimulai. Menunggu health check ..."

    # Wait for healthy status (up to 60 seconds)
    local max_wait=60
    local elapsed=0
    local interval=2

    while [ $elapsed -lt $max_wait ]; do
        local status
        status=$(docker inspect --format='{{.State.Health.Status}}' nginx-proxy 2>/dev/null || echo "unknown")

        if [ "$status" = "healthy" ]; then
            ok "Container nginx-proxy healthy!"
            echo ""
            echo "=========================================="
            echo -e "  ${GREEN}✅ Reverse proxy berhasil di-deploy!${NC}"
            echo "=========================================="
            echo ""
            echo "  Perintah berguna:"
            echo "    bash deploy.sh status   — Cek status container"
            echo "    bash deploy.sh logs     — Lihat log container"
            echo "    bash deploy.sh reload   — Reload konfigurasi Nginx"
            echo ""
            return
        fi

        sleep $interval
        elapsed=$((elapsed + interval))
    done

    # Health check timeout
    err "Container nginx-proxy tidak healthy setelah ${max_wait} detik!"
    echo ""
    info "Log container:"
    $COMPOSE logs --tail=50
    exit 1
}

# ── Reload action ───────────────────────────

do_reload() {
    info "Memvalidasi konfigurasi Nginx ..."

    if ! docker exec nginx-proxy nginx -t 2>&1; then
        err "Konfigurasi Nginx tidak valid! Perbaiki error di atas sebelum reload."
        exit 1
    fi

    ok "Konfigurasi valid."

    info "Reload Nginx ..."
    if docker exec nginx-proxy nginx -s reload; then
        ok "Nginx berhasil di-reload."
    else
        err "Gagal reload Nginx!"
        exit 1
    fi
}

# ── Status action ───────────────────────────

do_status() {
    info "Status container nginx-proxy:"
    echo ""

    if ! docker inspect nginx-proxy >/dev/null 2>&1; then
        warn "Container nginx-proxy tidak ditemukan. Sudah di-deploy?"
        exit 1
    fi

    local state
    state=$(docker inspect --format='{{.State.Status}}' nginx-proxy 2>/dev/null || echo "unknown")
    local health
    health=$(docker inspect --format='{{.State.Health.Status}}' nginx-proxy 2>/dev/null || echo "unknown")

    echo "  Container : nginx-proxy"
    echo "  Status    : ${state}"
    echo -n "  Health    : "

    case "$health" in
        healthy)
            echo -e "${GREEN}${health}${NC}"
            ;;
        unhealthy)
            echo -e "${RED}${health}${NC}"
            ;;
        *)
            echo -e "${YELLOW}${health}${NC}"
            ;;
    esac

    echo ""
    docker ps --filter "name=nginx-proxy" --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
    echo ""
}

# ── Logs action ─────────────────────────────

do_logs() {
    info "Log container nginx-proxy:"
    echo ""
    $COMPOSE logs --tail=100
}

# ── Main ────────────────────────────────────

main() {
    # Change to script directory so docker-compose finds its files
    cd "$(dirname "$0")"

    banner
    detect_compose

    local action="${1:-deploy}"

    case "$action" in
        deploy)
            do_deploy
            ;;
        reload)
            do_reload
            ;;
        status)
            do_status
            ;;
        logs)
            do_logs
            ;;
        *)
            err "Action tidak dikenal: $action"
            echo ""
            echo "  Usage: bash deploy.sh [action]"
            echo ""
            echo "  Actions:"
            echo "    deploy   — Deploy reverse proxy (default)"
            echo "    reload   — Reload konfigurasi Nginx"
            echo "    status   — Tampilkan status container"
            echo "    logs     — Tampilkan log container"
            echo ""
            exit 1
            ;;
    esac
}

main "$@"
