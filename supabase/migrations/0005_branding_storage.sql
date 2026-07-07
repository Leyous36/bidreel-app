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
