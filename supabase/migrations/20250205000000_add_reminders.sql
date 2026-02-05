-- Migration: Add reminders table for scheduled notifications
-- Created: 2025-02-05

-- Ensure uuid-ossp extension is available (may already exist from initial schema)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create reminders table
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,                    -- AI-generated reasoning for the reminder
  remind_at TIMESTAMPTZ NOT NULL,
  channels TEXT[] DEFAULT '{}',    -- Array of channels: 'whatsapp', 'telegram', 'email'
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_remind_at ON reminders(remind_at) WHERE status = 'pending';
CREATE INDEX idx_reminders_memory_id ON reminders(memory_id);
CREATE INDEX idx_reminders_status ON reminders(status);

-- Enable Row Level Security
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- RLS policy for user isolation
CREATE POLICY reminders_user_isolation ON reminders
  USING (user_id = current_setting('app.current_user_id', true));

-- Comment on table
COMMENT ON TABLE reminders IS 'Stores scheduled reminders linked to memories for notification delivery';
COMMENT ON COLUMN reminders.channels IS 'Array of notification channels: whatsapp, telegram, email';
COMMENT ON COLUMN reminders.status IS 'Reminder status: pending (awaiting send), sent (delivered), failed (delivery error), cancelled (user cancelled)';
COMMENT ON COLUMN reminders.summary IS 'AI-generated reasoning explaining why this reminder was suggested';
