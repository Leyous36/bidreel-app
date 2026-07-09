-- BidReel — Phase 8: email send log (abuse/rate limiting)
-- Run in Supabase SQL Editor, or: supabase db push
-- Backs a per-user daily cap in send-proposal-email so a signed-in user can't
-- turn the verified sending domain into an unmetered spam relay.

CREATE TABLE IF NOT EXISTS email_log (
  -- gen_random_uuid() is built into Postgres (no extension / search_path
  -- dependency), so this applies cleanly via `supabase db push`.
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bid_id     UUID REFERENCES bids(id) ON DELETE SET NULL,
  to_email   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_log_user_time_idx
  ON email_log (user_id, created_at DESC);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

-- Owner can read their own send history; writes happen only from the Edge
-- Function via the service role (which bypasses RLS), so no INSERT policy.
DROP POLICY IF EXISTS "Owner reads email log" ON email_log;
CREATE POLICY "Owner reads email log" ON email_log
  FOR SELECT USING (user_id = auth.uid());
