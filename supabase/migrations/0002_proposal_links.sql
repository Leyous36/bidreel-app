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
