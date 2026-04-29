-- ============================================
-- Horizon Trader Platform — Blog Category
-- Migration 006: Add credit settings for blog category
-- ============================================

-- Add credit settings for blog category (0 credits, active)
INSERT INTO credit_settings (category, credit_reward, is_active)
VALUES ('blog', 0, true)
ON CONFLICT (category) DO NOTHING;
