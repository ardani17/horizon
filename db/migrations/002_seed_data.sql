-- ============================================
-- Horizon Trader Platform — Seed Data
-- Migration 002: Default credit settings and admin user
-- ============================================

-- Seed credit settings with default values
-- trading: 10 credits, life_story: 5 credits, general: 3 credits
INSERT INTO credit_settings (category, credit_reward, is_active) VALUES
    ('trading', 10, true),
    ('life_story', 5, true),
    ('general', 3, true)
ON CONFLICT (category) DO NOTHING;

-- Seed initial admin user
-- Password: "admin123" hashed with bcrypt (cost factor 10)
-- telegram_id 0 is reserved for the admin account
-- The init.sh script may override the username via ADMIN_USERNAME env var
INSERT INTO users (telegram_id, username, password_hash, role, credit_balance)
VALUES (
    0,
    'admin',
    '$2b$10$yXhaUXeZeuEleI6Bdv0Z0eTQPdK9KuvOTpG.r.9cCgprMKM49/Wii',
    'admin',
    0
)
ON CONFLICT (telegram_id) DO NOTHING;
