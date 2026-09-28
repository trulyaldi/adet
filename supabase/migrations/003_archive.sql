-- 003_archive: archived projects.
-- Run once in the Supabase SQL editor, after 002_sync.sql, BEFORE opening an
-- app build that includes project archiving: that build sends archived_at on
-- every project push, and PostgREST rejects unknown columns (PGRST204), which
-- would stop project sync.
--
-- Older app versions don't send the column; their upserts leave it untouched.

alter table public.projects add column if not exists archived_at bigint;  -- epoch ms, like started; null = active

-- Make PostgREST pick up the new column right away.
notify pgrst, 'reload schema';
