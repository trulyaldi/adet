-- 001_init: tables mirroring src/domain/types.ts, scoped per user with RLS.
-- Run once in the Supabase SQL editor.
--
-- Conventions:
--   * ids are the client-generated string ids used on-device; primary keys are
--     (user_id, id) so ids only need to be unique per user.
--   * Domain timestamps (start, end, started, startedAt) stay epoch ms (bigint)
--     to match the app; sync bookkeeping columns are timestamptz.
--   * updated_at is written by the client (last local edit); deleted_at marks a
--     soft delete; server_updated_at is set by trigger and drives incremental pulls.
--   * No foreign keys between domain tables: rows may sync in any order.

-- Sets server_updated_at on every insert or update.
create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;

-- Project
create table public.projects (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id                text not null,
  name              text not null,
  weekly_target     numeric not null,            -- hours
  started           bigint,                      -- epoch ms
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Habit
create table public.habits (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id                text not null,
  project_id        text not null,
  name              text not null,
  icon              text not null,
  tile              text not null,
  daily_target_min  integer not null,
  weekly_target_min integer not null,
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Session
create table public.sessions (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id                text not null,
  habit_id          text not null,
  start_ms          bigint not null,             -- Session.start
  end_ms            bigint not null,             -- Session.end
  duration          integer not null,            -- seconds
  notes             text,
  manual            boolean not null default false,
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ActiveTimer: at most one per user.
create table public.active_timers (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id          text not null,
  started_at        bigint,                      -- epoch ms, null while paused
  base_sec          double precision not null default 0,
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,                 -- set when the timer is stopped/cleared
  server_updated_at timestamptz not null default now(),
  primary key (user_id)
);

-- Triggers, indexes, and row-level security for every table.
do $$
declare
  t text;
begin
  foreach t in array array['projects', 'habits', 'sessions', 'active_timers'] loop
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function public.set_server_updated_at()',
      t || '_set_server_updated_at', t);

    execute format(
      'create index %I on public.%I (user_id, server_updated_at)',
      t || '_user_server_updated_idx', t);

    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I for select to authenticated
         using (user_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (user_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (user_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end;
$$;
