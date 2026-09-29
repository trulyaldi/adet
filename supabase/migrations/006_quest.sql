-- 006_quest: Quest Mode's generic items and links.
-- Run once in the Supabase SQL editor, after 005_redesign.sql, BEFORE using
-- Quest Mode. Builds with Quest Mode work without it: they detect the missing
-- tables, keep the Quest tab on a friendly "not set up yet" screen and never
-- stall the rest of syncing. Once this has run, the next sync picks it up.
--
-- Safe to run more than once.
--
-- ids are text like every other table (client ids such as 's1727600000000'
-- for sessions), so links can point at sessions and habits.

-- An item: a weak point (task), a chronicle entry (log), a claimed chest,
-- a purchase, an achievement or the quest's settings (quest_meta).
-- Typed props per type are documented in src/domain/items/types.ts.
create table if not exists public.items (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id                text not null,
  type              text not null,                -- task | log | chest_claim | purchase | achievement | quest_meta
  title             text not null default '',
  body              text not null default '',
  props             jsonb not null default '{}',
  habit_id          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists items_user_type_idx on public.items (user_id, type);

-- A typed edge between two records: task → session (planned_for,
-- completed_in), log → session (chronicles).
create table if not exists public.links (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id                text not null,
  from_type         text not null,                -- item | session | habit
  from_id           text not null,
  to_type           text not null,                -- item | session | habit
  to_id             text not null,
  kind              text not null,                -- planned_for | completed_in | chronicles
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),  -- last-write-wins (the shared trigger reads it)
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists links_user_from_idx on public.links (user_id, from_id);
create index if not exists links_user_to_idx on public.links (user_id, to_id);

-- Trigger, index and row-level security for each new table, as in 001/005.
do $$
declare
  t text;
begin
  foreach t in array array['items', 'links'] loop
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

-- Make PostgREST pick up the new tables right away.
notify pgrst, 'reload schema';
