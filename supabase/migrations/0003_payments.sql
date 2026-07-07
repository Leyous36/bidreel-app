-- BidReel — Phase 4: deposit payments (Stripe)
-- Run in Supabase SQL Editor, or: supabase db push
-- Additive. Deposit columns on `bids` already exist from 0002.

CREATE TABLE IF NOT EXISTS payments (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bid_id              UUID REFERENCES bids(id) ON DELETE CASCADE NOT NULL,
  user_id             UUID REFERENCES auth.users(id) NOT NULL,
  provider            TEXT NOT NULL DEFAULT 'stripe',
  provider_session_id TEXT,             -- Stripe Checkout Session id
  provider_payment_id TEXT,             -- Stripe PaymentIntent id
  amount_cents        INTEGER NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'usd',
  status              TEXT NOT NULL DEFAULT 'created', -- created | paid | failed | refunded
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- One row per Checkout Session → makes the webhook idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS payments_session_idx
  ON payments (provider_session_id);
CREATE INDEX IF NOT EXISTS payments_bid_idx ON payments (bid_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Producer can read their own payments. Writes happen only from Edge Functions
-- via the service role (which bypasses RLS) — so no INSERT/UPDATE policy here.
DROP POLICY IF EXISTS "Owner reads payments" ON payments;
CREATE POLICY "Owner reads payments" ON payments
  FOR SELECT USING (user_id = auth.uid());

-- Reuse the touch_updated_at() trigger fn defined in 0001.
DROP TRIGGER IF EXISTS payments_touch_updated_at ON payments;
CREATE TRIGGER payments_touch_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
