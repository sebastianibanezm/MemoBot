-- Migration: Friction Reduction Features
-- Adds: daily digest settings, import tracking, forwarded flag

-- ============================================================
-- DAILY DIGEST SETTINGS (Feature 3)
-- ============================================================

ALTER TABLE user_settings 
  ADD COLUMN IF NOT EXISTS daily_digest_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_digest_time TIME DEFAULT '20:00',
  ADD COLUMN IF NOT EXISTS daily_digest_timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS daily_digest_last_sent TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS daily_digest_consecutive_ignores INTEGER DEFAULT 0;

-- Index for efficient cron queries
CREATE INDEX IF NOT EXISTS idx_user_settings_digest 
  ON user_settings(daily_digest_enabled, daily_digest_time) 
  WHERE daily_digest_enabled = true;

COMMENT ON COLUMN user_settings.daily_digest_enabled IS 'Whether the user has opted into nightly memory prompts';
COMMENT ON COLUMN user_settings.daily_digest_time IS 'Local time of day to send the digest (24h format)';
COMMENT ON COLUMN user_settings.daily_digest_timezone IS 'IANA timezone string for the user (e.g., America/New_York)';
COMMENT ON COLUMN user_settings.daily_digest_last_sent IS 'When the last digest was sent (prevents double-sends)';
COMMENT ON COLUMN user_settings.daily_digest_consecutive_ignores IS 'Number of consecutive digests the user ignored (for frequency throttling)';

-- ============================================================
-- IMPORT HISTORY (Feature 4)
-- ============================================================

CREATE TABLE IF NOT EXISTS import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  format TEXT, -- 'whatsapp', 'telegram', 'unknown'
  total_messages_parsed INTEGER DEFAULT 0,
  memories_created INTEGER DEFAULT 0,
  memories_skipped INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'error')),
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_history_user ON import_history(user_id);

ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_history_user_isolation ON import_history
  USING (user_id = current_setting('app.current_user_id', true));

-- ============================================================
-- MEMORY SOURCE TRACKING (Feature 2 + 4)
-- ============================================================

-- Add an import_id column to memories so imported memories can be traced back
ALTER TABLE memories 
  ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES import_history(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_memories_import ON memories(import_id) WHERE import_id IS NOT NULL;
