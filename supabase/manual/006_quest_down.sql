-- ============================================================================
--  006_quest_down — MANUAL ROLLBACK OF 006_quest.sql.  THIS DELETES DATA.
-- ============================================================================
--  Drops the `items` and `links` tables: every weak point, chronicle entry,
--  chest claim, purchase (including bought streak freezes), boss achievement
--  and quest_meta row, for EVERY user. There is no undo. Export them first
--  (Table Editor → items / links → Export to CSV) if you might want them back.
--
--  Kept outside supabase/migrations/ on purpose, so no tool ever runs it.
--  The app keeps working after this: the Quest tab shows its "almost ready"
--  note and the rest of sync is unaffected. Devices may still hold a local
--  copy, but don't count on it to restore anything: export first.
--
--  To run it, delete the SAFETY LOCK block below, then run the rest.
-- ============================================================================

-- SAFETY LOCK (delete this block to run the rollback)
do $$ begin raise exception '006_quest_down is locked: read the warning at the top, then delete the SAFETY LOCK block.'; end $$;
-- END SAFETY LOCK

begin;
drop table if exists public.links cascade;
drop table if exists public.items cascade;
commit;

notify pgrst, 'reload schema';
