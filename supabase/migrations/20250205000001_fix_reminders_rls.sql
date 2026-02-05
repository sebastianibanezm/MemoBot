-- Migration: Fix reminders RLS policy to use FOR ALL
-- Created: 2025-02-05

-- Drop the existing policy
DROP POLICY IF EXISTS reminders_user_isolation ON reminders;

-- Create new policy with FOR ALL (applies to SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY reminders_user_isolation ON reminders
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));
