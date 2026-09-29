-- ============================================================================
--  007_sage_usage_down — MANUAL ROLLBACK OF 007_sage_usage.sql.
-- ============================================================================
--  Drops the Sage's daily call counter and its function. Only the per-day
--  call counts are lost (no user content). Undeploy the `sage` Edge Function
--  first: without 007 every AI request returns 429 and the app quietly falls
--  back to local advice.
--
--  Kept outside supabase/migrations/ on purpose, so no tool ever runs it.
--  To run it, delete the SAFETY LOCK block below, then run the rest.
-- ============================================================================

-- SAFETY LOCK (delete this block to run the rollback)
do $$ begin raise exception '007_sage_usage_down is locked: read the warning at the top, then delete the SAFETY LOCK block.'; end $$;
-- END SAFETY LOCK

begin;
drop function if exists public.sage_take_call(uuid, integer);
drop table if exists public.sage_usage;
commit;
