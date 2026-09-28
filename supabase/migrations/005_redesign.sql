-- 005_redesign: project looks, habit kinds, done marks, daily logs, badges and
-- per-user planning preferences.
-- Run once in the Supabase SQL editor, after 004_doable_day.sql, BEFORE
-- opening an app build with the redesign. That build sends color, icon and
-- scene on every project push and kind on every habit push, and syncs the four
-- new tables; without them PostgREST rejects the push (PGRST204 / 42P01), and
-- because projects push first, all syncing on that device stalls (shown as
-- offline) until this has run. Queued changes are kept and go through once it
-- has.
--
-- Safe to run more than once. Older app versions don't send the new columns;
-- their upserts leave them untouched, and the app derives a look from the id
-- for projects that have none.

-- Projects: how they look everywhere (color key, icon key, focus scene).
alter table public.projects add column if not exists color text;  -- purple | orange | green | pink | teal | yellow | coral | indigo
alter table public.projects add column if not exists icon  text;  -- IconKey
alter table public.projects add column if not exists scene text;  -- plant | orbit | fill | constellation

-- Habits: timed (a count-up toward a target) or check-off. Null reads as timed.
alter table public.habits add column if not exists kind text;     -- timed | check

-- A habit marked done on a day (a check-off, or "done" tapped on a timer).
-- id = habitId:dkey; undone by a soft delete.
create table if not exists public.habit_marks (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id                text not null,
  habit_id          text not null,
  day               text not null,                -- local dkey, e.g. 2026-09-28
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- A finished day's plan against what happened (id = dkey), written once.
create table if not exists public.daily_logs (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id                text not null,                -- dkey
  capacity_min      integer not null,
  planned_min       integer not null,
  actual_min        integer not null,
  items             jsonb not null default '[]',  -- [{habitId, projectId, shareMin}]
  done_count        integer not null default 0,
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Earned milestones (id = badge key, e.g. streak-7, hours-<project>-10).
create table if not exists public.badges (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id                text not null,
  earned_at         bigint not null,              -- epoch ms
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Planning preferences, one row per user (id = 'prefs').
create table if not exists public.user_prefs (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id                text not null,
  capacity_min      jsonb not null,               -- 7 numbers, minutes, Monday first
  week_start        smallint not null default 1,  -- Date.getDay() of the first day: 1 = Monday, 0 = Sunday
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Trigger, index and row-level security for each new table, as in 001.
do $$
declare
  t text;
begin
  foreach t in array array['habit_marks', 'daily_logs', 'badges', 'user_prefs'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_server_updated_at', t);
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function public.set_server_updated_at()',
      t || '_set_server_updated_at', t);

    execute format(
      'create index if not exists %I on public.%I (user_id, server_updated_at)',
      t || '_user_server_updated_idx', t);

    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (user_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (user_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (user_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end;
$$;

-- Make PostgREST pick up the new columns and tables right away.
notify pgrst, 'reload schema';
