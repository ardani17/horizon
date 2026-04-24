#!/bin/bash
# ============================================
# Horizon Trader Platform — Deploy Script
# Domain: horizon.cloudnexify.com
# 
# Usage: bash deploy.sh
# ============================================

set -e

echo "=========================================="
echo "  Horizon Trader Platform — Deploy"
echo "=========================================="

# Check .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Copy .env.example to .env and fill in the values."
    exit 1
fi

# Check if passwords are still default
if grep -q "GANTI_PASSWORD" .env; then
    echo "ERROR: Masih ada password default di .env!"
    echo "Edit .env dan ganti semua 'GANTI_PASSWORD_*' dengan password yang aman."
    exit 1
fi

echo ""
echo "[1/4] Stopping existing containers..."
docker compose -f docker-compose.prod.yml down 2>/dev/null || true

echo ""
echo "[2/4] Building images..."
docker compose -f docker-compose.prod.yml build --no-cache

echo ""
echo "[3/4] Starting services..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "[4/4] Waiting for services to be healthy..."
sleep 5

# Check health
echo ""
echo "--- Service Status ---"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "--- Health Checks ---"

# Wait for DB
echo -n "Database: "
for i in $(seq 1 30); do
    if docker exec horizon-db pg_isready -U horizon_user -d horizon > /dev/null 2>&1; then
        echo "✅ Ready"
        break
    fi
    if [ $i -eq 30 ]; then echo "❌ Not ready"; fi
    sleep 2
done

# Wait for Frontend
echo -n "Frontend (port 3888): "
for i in $(seq 1 30); do
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3888/ | grep -q "200\|301\|302"; then
        echo "✅ Ready"
        break
    fi
    if [ $i -eq 30 ]; then echo "❌ Not ready (check: docker logs horizon-frontend)"; fi
    sleep 3
done

# Wait for Bot
echo -n "Bot (port 4888): "
for i in $(seq 1 30); do
    if curl -s http://127.0.0.1:4888/api/bot/status | grep -q "success"; then
        echo "✅ Ready"
        break
    fi
    if [ $i -eq 30 ]; then echo "❌ Not ready (check: docker logs horizon-bot)"; fi
    sleep 2
done

echo ""
echo "=========================================="
echo "  Deploy selesai!"
echo ""
echo "  Frontend: http://127.0.0.1:3888"
echo "  Bot API:  http://127.0.0.1:4888/api/bot/status"
echo ""
echo "  Selanjutnya setup reverse proxy di AAPanel:"
echo "  horizon.cloudnexify.com → 127.0.0.1:3888"
echo "=========================================="
