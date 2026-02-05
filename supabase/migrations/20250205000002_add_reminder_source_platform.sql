-- Migration: Add source_platform column to reminders table
-- Created: 2025-02-05
-- Purpose: Track where reminders were created to determine notification channels

-- Add source_platform column
ALTER TABLE reminders 
ADD COLUMN source_platform TEXT DEFAULT 'web' 
CHECK (source_platform IN ('whatsapp', 'telegram', 'web'));

-- Comment on column
COMMENT ON COLUMN reminders.source_platform IS 'Platform where the reminder was created: whatsapp, telegram, or web';

-- Create index for potential filtering by source
CREATE INDEX idx_reminders_source_platform ON reminders(source_platform);
