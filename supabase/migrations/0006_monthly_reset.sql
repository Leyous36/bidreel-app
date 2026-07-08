-- BidReel — auto-reset the free-tier proposal counter each month.
--
-- profiles.proposals_this_month is incremented on every generation and gates
-- the free tier (3/month). Without a reset, a free user who hits the cap stays
-- blocked forever. This schedules a monthly reset via pg_cron — no app build
-- needed, since the app reads the column directly.

-- 1. Enable the scheduler (no-op if already enabled).
create extension if not exists pg_cron;

-- 2. Reset every account's counter at 00:00 UTC on the 1st of each month.
--    cron.schedule upserts by job name, so re-running this is safe.
select cron.schedule(
  'reset-monthly-proposals',
  '0 0 1 * *',
  $$update public.profiles set proposals_this_month = 0 where proposals_this_month <> 0$$
);
