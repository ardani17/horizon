-- ============================================
-- Horizon Trader Platform — WordPress Import Jobs
-- Migration 007: Create wordpress_import_jobs table
-- ============================================

CREATE TABLE wordpress_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    total_fetched INTEGER NOT NULL DEFAULT 0,
    total_imported INTEGER NOT NULL DEFAULT 0,
    total_skipped INTEGER NOT NULL DEFAULT 0,
    total_failed INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    triggered_by UUID NOT NULL REFERENCES users(id)
);

-- Index for checking running jobs (single-job constraint)
CREATE INDEX idx_wordpress_import_jobs_status ON wordpress_import_jobs(status);

-- Index for listing recent jobs ordered by start time
CREATE INDEX idx_wordpress_import_jobs_started_at ON wordpress_import_jobs(started_at DESC);
