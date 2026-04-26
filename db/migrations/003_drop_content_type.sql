-- ============================================
-- Horizon Trader Platform — Schema Update
-- Migration 003: Drop unused content_type column from articles table
-- ============================================

-- The content_type column ('short'/'long') is no longer used by the bot
-- or frontend. All articles now use a single layout regardless of type.
ALTER TABLE articles DROP COLUMN content_type;
