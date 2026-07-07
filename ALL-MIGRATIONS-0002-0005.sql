-- BidReel — combined migrations 0002–0005
-- Paste this whole file into the Supabase SQL Editor and click Run.
-- Safe to re-run (everything is IF NOT EXISTS / idempotent).

-- ============================================================
-- 0002_proposal_links.sql
-- ============================================================
-- BidReel — Trackable proposal links (Phase 2: share + public view)
-- Run in Supabase SQL Editor, or: supabase db push
-- Additive only. Payments tables come in a later migration.

-- 1) Share / tracking columns on bids ----------------------------------------
ALTER TABLE bids
  ADD COLUMN IF NOT EXISTS share_token          UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS shared_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_viewed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_by_name     TEXT,
  ADD COLUMN IF NOT EXISTS deposit_status       TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS deposit_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS currency             TEXT DEFAULT 'usd';

CREATE INDEX IF NOT EXISTS bids_share_token_idx ON bids (share_token);

-- 2) Studio branding for the public page -------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS logo_url            TEXT,
  ADD COLUMN IF NOT EXISTS brand_color         TEXT DEFAULT '#F5B82E',
  ADD COLUMN IF NOT EXISTS default_deposit_pct INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS stripe_account_id   TEXT;

-- 3) Append-only activity timeline -------------------------------------------
CREATE TABLE IF NOT EXISTS bid_events (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bid_id     UUID REFERENCES bids(id) ON DELETE CASCADE NOT NULL,
  type       TEXT NOT NULL,            -- 'shared' | 'viewed' | 'accepted' | 'deposit_requested' | 'deposit_paid'
  metadata   JSONB DEFAULT '{}',       -- never store a raw IP; only a salted hash
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bid_events_bid_id_idx ON bid_events (bid_id, created_at DESC);

ALTER TABLE bid_events ENABLE ROW LEVEL SECURITY;

-- Producer can read the timeline for their own bids.
-- Writes happen only from Edge Functions using the service role, which
-- bypasses RLS — so there is intentionally no INSERT policy here.
DROP POLICY IF EXISTS "Owner reads bid events" ON bid_events;
CREATE POLICY "Owner reads bid events" ON bid_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM bids b WHERE b.id = bid_id AND b.user_id = auth.uid())
  );

-- ============================================================
-- 0003_payments.sql
-- ============================================================
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

-- ============================================================
-- 0004_push_tokens.sql
-- ============================================================
-- BidReel — Phase 5: push notifications
-- Run in Supabase SQL Editor, or: supabase db push
-- Additive: stores each producer's Expo push token so the Edge Functions can
-- notify them when a proposal is opened, accepted, or paid.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT;

-- ============================================================
-- 0005_branding_storage.sql
-- ============================================================
-- BidReel — Phase 6: studio branding storage (logo uploads)
-- Run in Supabase SQL Editor, or: supabase db push
-- Creates a public bucket for studio logos and scopes writes to each user's
-- own folder (studio-logos/<uid>/...). The brand_color / logo_url / default
-- deposit columns on `profiles` already exist from 0002.

-- Public bucket so the client-facing proposal page can load logos by URL.
INSERT INTO storage.buckets (id, name, public)
VALUES ('studio-logos', 'studio-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (bucket is public).
DROP POLICY IF EXISTS "Studio logos are publicly readable" ON storage.objects;
CREATE POLICY "Studio logos are publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'studio-logos');

-- A user can write only into their own folder: studio-logos/<auth.uid()>/...
DROP POLICY IF EXISTS "Users upload own logo" ON storage.objects;
CREATE POLICY "Users upload own logo" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'studio-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own logo" ON storage.objects;
CREATE POLICY "Users update own logo" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'studio-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own logo" ON storage.objects;
CREATE POLICY "Users delete own logo" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'studio-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

