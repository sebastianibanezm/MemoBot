-- Add Stripe subscription fields to users table
-- Run with: supabase db push or in Supabase SQL Editor

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_status TEXT DEFAULT 'inactive';

-- Index for quick subscription lookups by customer ID
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer 
  ON users(stripe_customer_id) 
  WHERE stripe_customer_id IS NOT NULL;

-- Index for subscription status checks
CREATE INDEX IF NOT EXISTS idx_users_stripe_status 
  ON users(stripe_status) 
  WHERE stripe_status IS NOT NULL;

-- Comment on columns for documentation
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe Customer ID (cus_xxx)';
COMMENT ON COLUMN users.stripe_subscription_id IS 'Active Stripe Subscription ID (sub_xxx)';
COMMENT ON COLUMN users.stripe_price_id IS 'Current plan price ID (price_xxx)';
COMMENT ON COLUMN users.stripe_current_period_end IS 'Subscription renewal/expiry date';
COMMENT ON COLUMN users.stripe_status IS 'Subscription status: active, past_due, canceled, trialing, inactive';
