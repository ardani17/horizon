#!/bin/bash
set -e

# ============================================
# Horizon Trader Platform — Database Initialization
# Runs migrations and seeds data on first startup
# This script is mounted into /docker-entrypoint-initdb.d/
# and executed automatically by PostgreSQL on first init.
# ============================================

MIGRATIONS_DIR="/docker-entrypoint-initdb.d/migrations"

# ----------------------------------------
# Enable pgcrypto extension (for bcrypt password hashing)
# ----------------------------------------
echo "=== Horizon DB Init: Enabling pgcrypto extension ==="

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-'EOSQL'
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
EOSQL

# ----------------------------------------
# Run schema migration
# ----------------------------------------
echo "=== Horizon DB Init: Running schema migration ==="

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -f "${MIGRATIONS_DIR}/001_create_schema.sql"

echo "=== Horizon DB Init: Schema created successfully ==="

# ----------------------------------------
# Run seed data migration
# ----------------------------------------
echo "=== Horizon DB Init: Running seed data migration ==="

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -f "${MIGRATIONS_DIR}/002_seed_data.sql"

echo "=== Horizon DB Init: Seed data applied ==="

# ----------------------------------------
# Override admin username if env var is set
# ----------------------------------------
if [ -n "${ADMIN_USERNAME}" ]; then
    echo "=== Horizon DB Init: Updating admin username to '${ADMIN_USERNAME}' ==="

    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
        -v admin_user="'${ADMIN_USERNAME}'" <<-'EOSQL'
        UPDATE users SET username = :admin_user WHERE telegram_id = 0 AND role = 'admin';
EOSQL
fi

# ----------------------------------------
# Override admin password if env var is set
# Uses pgcrypto's crypt() with bcrypt (bf) algorithm
# ----------------------------------------
if [ -n "${ADMIN_PASSWORD}" ]; then
    echo "=== Horizon DB Init: Updating admin password from ADMIN_PASSWORD env ==="

    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
        -v admin_pass="'${ADMIN_PASSWORD}'" <<-'EOSQL'
        UPDATE users
        SET password_hash = crypt(:admin_pass, gen_salt('bf', 10))
        WHERE telegram_id = 0 AND role = 'admin';
EOSQL
fi

echo "=== Horizon DB Init: Complete ==="
