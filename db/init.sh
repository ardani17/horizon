#!/bin/bash
set -e

# ============================================
# Horizon Trader Platform — Database Initialization & Migration
#
# This script handles THREE scenarios:
#   1. Fresh database — runs all migrations + seed from scratch
#   2. Existing database (pre-tracking) — detects already-applied migrations,
#      seeds schema_migrations, then runs only NEW migrations
#   3. Existing database (with tracking) — runs only NEW migrations
#
# It uses a `schema_migrations` table to track which migrations have run.
# Safe to execute repeatedly (idempotent).
#
# Mounted into /docker-entrypoint-initdb.d/ for first-time init,
# and called by deploy-docker.sh for subsequent deploys.
# ============================================

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/docker-entrypoint-initdb.d/migrations}"
DB_USER="${POSTGRES_USER:-horizon_user}"
DB_NAME="${POSTGRES_DB:-horizon}"

run_sql() {
    psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" "$@"
}

# ----------------------------------------
# 1. Enable pgcrypto extension
# ----------------------------------------
echo "=== Horizon DB: Enabling pgcrypto extension ==="
run_sql <<-'EOSQL'
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
EOSQL

# ----------------------------------------
# 2. Create migration tracking table
# ----------------------------------------
echo "=== Horizon DB: Ensuring schema_migrations table exists ==="
run_sql <<-'EOSQL'
    CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
EOSQL

# ----------------------------------------
# 3. Detect pre-existing database without tracking
#    If tables exist but schema_migrations is empty,
#    seed it with migrations that were already applied.
# ----------------------------------------
migration_count_in_table=$(run_sql -t -A -c "SELECT COUNT(*) FROM schema_migrations")
users_table_exists=$(run_sql -t -A -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public'")

if [ "$migration_count_in_table" -eq 0 ] && [ "$users_table_exists" -gt 0 ]; then
    echo "=== Horizon DB: Detected existing database without migration tracking ==="
    echo "  Seeding schema_migrations with previously applied migrations..."

    # 001 and 002 were already applied (tables exist, seed data exists)
    run_sql -c "INSERT INTO schema_migrations (filename) VALUES ('001_create_schema.sql') ON CONFLICT DO NOTHING"
    run_sql -c "INSERT INTO schema_migrations (filename) VALUES ('002_seed_data.sql') ON CONFLICT DO NOTHING"

    echo "  [SEED] 001_create_schema.sql (already applied)"
    echo "  [SEED] 002_seed_data.sql (already applied)"
fi

# ----------------------------------------
# 4. Run all migrations in order (skip already applied)
# ----------------------------------------
echo "=== Horizon DB: Running migrations ==="

migration_count=0

for migration_file in "$MIGRATIONS_DIR"/*.sql; do
    [ -f "$migration_file" ] || continue

    filename=$(basename "$migration_file")

    # Check if already applied
    already_applied=$(run_sql -t -A -c "SELECT COUNT(*) FROM schema_migrations WHERE filename = '${filename}'")

    if [ "$already_applied" -gt 0 ]; then
        echo "  [SKIP] ${filename} (already applied)"
        continue
    fi

    echo "  [RUN]  ${filename} ..."
    run_sql -f "$migration_file"

    # Record migration
    run_sql -c "INSERT INTO schema_migrations (filename) VALUES ('${filename}')"

    echo "  [DONE] ${filename}"
    migration_count=$((migration_count + 1))
done

if [ "$migration_count" -eq 0 ]; then
    echo "=== Horizon DB: No new migrations to apply ==="
else
    echo "=== Horizon DB: Applied ${migration_count} migration(s) ==="
fi

# ----------------------------------------
# 5. Override admin username if env var is set
# ----------------------------------------
if [ -n "${ADMIN_USERNAME}" ]; then
    echo "=== Horizon DB: Updating admin username to '${ADMIN_USERNAME}' ==="
    run_sql -v admin_user="'${ADMIN_USERNAME}'" <<-'EOSQL'
        UPDATE users SET username = :admin_user WHERE telegram_id = 0 AND role = 'admin';
EOSQL
fi

# ----------------------------------------
# 6. Override admin password if env var is set
# ----------------------------------------
if [ -n "${ADMIN_PASSWORD}" ]; then
    echo "=== Horizon DB: Updating admin password ==="
    run_sql -v admin_pass="'${ADMIN_PASSWORD}'" <<-'EOSQL'
        UPDATE users
        SET password_hash = crypt(:admin_pass, gen_salt('bf', 10))
        WHERE telegram_id = 0 AND role = 'admin';
EOSQL
fi

echo "=== Horizon DB: Complete ==="
