-- BidReel initial schema
-- Run in Supabase SQL Editor, or: supabase db push

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users profile table (extends Supabase Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  company_name TEXT,
  producer_name TEXT,
  email TEXT,
  phone TEXT,
  subscription_tier TEXT DEFAULT 'free',
  proposals_this_month INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bids table (core data)
CREATE TABLE bids (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  client_name TEXT NOT NULL,
  template_id TEXT NOT NULL,
  project_brief TEXT,
  budget NUMERIC,
  timeline TEXT,
  status TEXT DEFAULT 'draft',
  proposal JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX bids_user_id_idx ON bids (user_id);
CREATE INDEX bids_status_idx ON bids (user_id, status);

-- Row Level Security (each user sees only their data)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users see own bids" ON bids
  FOR ALL USING (auth.uid() = user_id);

-- Auto-create profile on signup.
-- Fully-qualified names + locked search_path + ON CONFLICT make this robust;
-- the grant + role policy below let the signup transaction insert the row
-- without tripping row-level security.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Allow the auth system to create the profile row during signup
GRANT INSERT ON public.profiles TO supabase_auth_admin;

CREATE POLICY "Auth admin can insert profiles" ON public.profiles
  FOR INSERT TO supabase_auth_admin
  WITH CHECK (true);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bids_touch_updated_at
  BEFORE UPDATE ON bids
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Atomic monthly proposal counter (free-tier enforcement)
CREATE OR REPLACE FUNCTION increment_proposal_count(uid UUID)
RETURNS INTEGER AS $$
DECLARE new_count INTEGER;
BEGIN
  UPDATE profiles
  SET proposals_this_month = proposals_this_month + 1
  WHERE id = uid
  RETURNING proposals_this_month INTO new_count;
  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
