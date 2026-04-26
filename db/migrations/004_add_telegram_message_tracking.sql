-- ============================================
-- Horizon Trader Platform — Schema Update
-- Migration 004: Add Telegram message tracking columns to articles
-- ============================================

-- Store the original Telegram message ID for article lookup during /publish
ALTER TABLE articles ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;

-- Store the bot's reply message ID for cleanup after publication
ALTER TABLE articles ADD COLUMN IF NOT EXISTS bot_reply_message_id BIGINT;

-- Store the Telegram chat ID for message deletion API calls
ALTER TABLE articles ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;

-- Index for efficient lookup by telegram_message_id (used by /publish)
CREATE INDEX IF NOT EXISTS idx_articles_telegram_message_id ON articles(telegram_message_id);
