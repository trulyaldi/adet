-- 002_sync: server-side last-write-wins and merge tracking for sync.
-- Run once in the Supabase SQL editor, after 001_init.sql.

-- When a habit is deleted because it was merged into another one, clients
-- record the target here so offline sessions on it can be moved over.
alter table public.habits add column if not exists merged_into text;

-- Replaces the 001 trigger function (the triggers already call it by name).
-- An update carrying an older updated_at than the stored row is skipped, so a
-- device that hasn't pulled yet can't overwrite a newer write from another one.
create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.server_updated_at := now();
  return new;
end;
$$;
