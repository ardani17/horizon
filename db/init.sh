#!/bin/bash

# ============================================
# Horizon Trader Platform — Database Initialization & Migration
#
# Handles all scenarios:
#   1. Fresh database — runs all migrations from scratch
#   2. Existing database (pre-tracking) — seeds tracking table, runs new migrations
#   3. Existing database (with tracking) — runs only new migrations
#
# Uses `schema_migrations` table to track applied migrations.
# Safe to execute repeatedly (idempotent).
# ============================================

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/docker-entrypoint-initdb.d/migrations}"
DB_USER="${POSTGRES_USER:-horizon_user}"
DB_NAME="${POSTGRES_DB:-horizon}"

run_sql() {
    psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" "$@"
}

# Run a query and return trimmed scalar result
query_val() {
    run_sql -t -A -c "$1" | tr -d '[:space:]'
}

echo "=== Horizon DB: Starting migration runner ==="

# ----------------------------------------
# 1. Enable pgcrypto extension
# ----------------------------------------
run_sql -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" 2>/dev/null || true

# ----------------------------------------
# 2. Create migration tracking table
# ----------------------------------------
run_sql -c "CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW());" 2>/dev/null || true

# ----------------------------------------
# 3. Detect pre-existing database without tracking
# ----------------------------------------
tracked=$(query_val "SELECT COUNT(*) FROM schema_migrations")
has_users=$(query_val "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='users' AND table_schema='public'")

echo "  Migration tracking entries: ${tracked}"
echo "  Users table exists: ${has_users}"

if [ "${tracked}" = "0" ] && [ "${has_users}" = "1" ]; then
    echo "=== Horizon DB: Existing database detected — seeding migration history ==="

    # Mark all existing migrations as applied by checking what already exists
    # 001: schema — users table exists, so this was applied
    run_sql -c "INSERT INTO schema_migrations (filename) VALUES ('001_create_schema.sql') ON CONFLICT DO NOTHING"
    echo "  [SEED] 001_create_schema.sql"

    # 002: seed data — credit_settings has rows if seed was applied
    has_seeds=$(query_val "SELECT COUNT(*) FROM credit_settings")
    if [ "${has_seeds}" != "0" ]; then
        run_sql -c "INSERT INTO schema_migrations (filename) VALUES ('002_seed_data.sql') ON CONFLICT DO NOTHING"
        echo "  [SEED] 002_seed_data.sql"
    fi

    # 003: drop content_type — check if column still exists
    has_content_type=$(query_val "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='articles' AND column_name='content_type'")
    if [ "${has_content_type}" = "0" ]; then
        run_sql -c "INSERT INTO schema_migrations (filename) VALUES ('003_drop_content_type.sql') ON CONFLICT DO NOTHING"
        echo "  [SEED] 003_drop_content_type.sql (column already dropped)"
    fi
fi

# ----------------------------------------
# 4. Run pending migrations in order
# ----------------------------------------
echo "=== Horizon DB: Checking for pending migrations ==="

applied=0

for migration_file in "$MIGRATIONS_DIR"/*.sql; do
    [ -f "$migration_file" ] || continue

    filename=$(basename "$migration_file")

    already=$(query_val "SELECT COUNT(*) FROM schema_migrations WHERE filename='${filename}'")

    if [ "${already}" != "0" ]; then
        echo "  [SKIP] ${filename}"
        continue
    fi

    echo "  [RUN]  ${filename} ..."
    if run_sql -f "$migration_file"; then
        run_sql -c "INSERT INTO schema_migrations (filename) VALUES ('${filename}')"
        echo "  [DONE] ${filename}"
        applied=$((applied + 1))
    else
        echo "  [FAIL] ${filename} — check error above"
        # Don't exit, continue with other migrations
    fi
done

if [ "$applied" -eq 0 ]; then
    echo "=== Horizon DB: All migrations up to date ==="
else
    echo "=== Horizon DB: Applied ${applied} migration(s) ==="
fi

# ----------------------------------------
# 5. Update admin credentials if env vars set
# ----------------------------------------
if [ -n "${ADMIN_USERNAME}" ]; then
    echo "=== Horizon DB: Updating admin username ==="
    run_sql -v admin_user="'${ADMIN_USERNAME}'" <<-'EOSQL'
        UPDATE users SET username = :admin_user WHERE telegram_id = 0 AND role = 'admin';
EOSQL
fi

if [ -n "${ADMIN_PASSWORD}" ]; then
    echo "=== Horizon DB: Updating admin password ==="
    run_sql -v admin_pass="'${ADMIN_PASSWORD}'" <<-'EOSQL'
        UPDATE users
        SET password_hash = crypt(:admin_pass, gen_salt('bf', 10))
        WHERE telegram_id = 0 AND role = 'admin';
EOSQL
fi

echo "=== Horizon DB: Complete ==="
