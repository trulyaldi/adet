-- 004_doable_day: habit frequency and minimum session.
-- Run once in the Supabase SQL editor, after 003_archive.sql, BEFORE opening an
-- app build that includes weekly targets and minimum sessions. That build
-- sends frequency and min_target_min on every habit push; without the columns
-- PostgREST rejects it (PGRST204). Habits push before sessions, so a single
-- habit edit (the one-time rebalance screen makes one per habit) stalls all
-- syncing on that device, shown as offline, until the columns exist. Queued
-- changes are kept and go through once they do.
--
-- Older app versions don't send these columns; their upserts leave them
-- untouched, and new rows get nulls, which the app reads as "every day" and a
-- minimum of min(5, full) minutes.

-- {"kind":"daily"} | {"kind":"weekly","times":1..6} | {"kind":"days","days":[0..6]} (0 = Monday)
alter table public.habits add column if not exists frequency jsonb;
alter table public.habits add column if not exists min_target_min integer;  -- minutes

-- Make PostgREST pick up the new columns right away.
notify pgrst, 'reload schema';
