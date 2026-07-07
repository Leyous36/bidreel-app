-- BidReel — Phase 5: push notifications
-- Run in Supabase SQL Editor, or: supabase db push
-- Additive: stores each producer's Expo push token so the Edge Functions can
-- notify them when a proposal is opened, accepted, or paid.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT;
