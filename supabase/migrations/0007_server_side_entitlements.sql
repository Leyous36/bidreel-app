-- BidReel — Phase 7: server-side entitlements & quota (security hardening)
-- Run in Supabase SQL Editor, or: supabase db push
-- Fully re-runnable (CREATE OR REPLACE / IF EXISTS throughout).
--
-- Closes the hole where any signed-in user could update privileged columns on
-- their own profile row (subscription_tier, proposals_this_month,
-- stripe_account_id) through PostgREST, i.e. give themselves a paid plan.
-- From now on those columns change only server-side (edge functions /
-- rc-webhook / pg_cron), and the free-tier quota is claimed atomically by the
-- generate-proposal function instead of being counted by the app.

-- 1 · Block client writes to privileged profile columns.
--     PostgREST requests carry a JWT role claim ('anon' / 'authenticated');
--     edge functions using the service key carry 'service_role'; direct DB
--     sessions (postgres, pg_cron jobs) have no claim at all. Only the last
--     two may touch these columns.
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  jwt_role TEXT;
BEGIN
  BEGIN
    jwt_role := current_setting('request.jwt.claims', true)::json ->> 'role';
  EXCEPTION WHEN OTHERS THEN
    jwt_role := NULL;
  END;

  IF jwt_role IS NULL OR jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.subscription_tier    IS DISTINCT FROM OLD.subscription_tier
     OR NEW.proposals_this_month IS DISTINCT FROM OLD.proposals_this_month
     OR NEW.stripe_account_id    IS DISTINCT FROM OLD.stripe_account_id THEN
    RAISE EXCEPTION 'subscription_tier, proposals_this_month and stripe_account_id can only be changed by the server';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_privileged ON public.profiles;
CREATE TRIGGER profiles_protect_privileged
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_privileged_profile_columns();

-- 2 · Neutralize the client-callable counter RPC. Old app builds still call
--     it after generating, but since 0007 the generate-proposal function owns
--     the count (claim_free_proposal below) — so this becomes a read-only
--     no-op instead of a double count / griefing vector (it used to accept an
--     arbitrary uid and increment it).
CREATE OR REPLACE FUNCTION public.increment_proposal_count(uid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (SELECT proposals_this_month FROM public.profiles WHERE id = uid);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.increment_proposal_count(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_proposal_count(UUID) TO authenticated, service_role;

-- 3 · Atomic quota claim for the free tier, callable ONLY by the service role
--     (generate-proposal). Returns FALSE when the user is at/over the cap —
--     the increment and the check happen in one UPDATE, so parallel requests
--     cannot exceed the cap.
CREATE OR REPLACE FUNCTION public.claim_free_proposal(p_uid UUID, p_cap INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claimed BOOLEAN;
BEGIN
  UPDATE public.profiles
     SET proposals_this_month = COALESCE(proposals_this_month, 0) + 1
   WHERE id = p_uid
     AND COALESCE(proposals_this_month, 0) < p_cap
  RETURNING TRUE INTO claimed;
  RETURN COALESCE(claimed, FALSE);
END;
$$;

-- Give back a claimed slot when generation fails after the claim.
CREATE OR REPLACE FUNCTION public.refund_free_proposal(p_uid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
     SET proposals_this_month = GREATEST(COALESCE(proposals_this_month, 0) - 1, 0)
   WHERE id = p_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_free_proposal(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_free_proposal(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_free_proposal(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_free_proposal(UUID) TO service_role;

-- 4 · (Optional, run once you want automated payment reconciliation.)
--     Schedules the reconcile-payments edge function hourly via pg_cron +
--     pg_net, converging any 'created' payments whose webhook never arrived.
--     Left commented out because pg_net must be enabled first
--     (Dashboard → Database → Extensions → pg_net):
--
-- SELECT cron.schedule(
--   'reconcile-payments-hourly',
--   '15 * * * *',
--   $$ SELECT net.http_post(
--        url    := 'https://ikrjbkrhawfpekocksjw.supabase.co/functions/v1/reconcile-payments',
--        body   := '{}'::jsonb,
--        headers:= '{"Content-Type":"application/json"}'::jsonb
--      ) $$
-- );
