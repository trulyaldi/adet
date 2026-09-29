-- 007_sage_usage: the AI Sage's daily call counter (server-only).
-- Run once in the Supabase SQL editor, after 006_quest.sql, ONLY if you
-- deploy the optional `sage` Edge Function. The app never reads or syncs
-- this table; Quest Mode works fully without it (local advice).
--
-- Safe to run more than once.

-- One row per user per UTC day. Not a synced table: no deleted_at, no
-- server_updated_at, and no client access at all.
create table if not exists public.sage_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  calls   integer not null default 0,
  primary key (user_id, day)
);

-- RLS on with no policies: anon and authenticated clients can do nothing.
alter table public.sage_usage enable row level security;
revoke all on table public.sage_usage from anon, authenticated;

-- Take one of today's calls, atomically. Returns false once `p_limit` calls
-- were taken today (the row is left unchanged). Called by the Edge Function
-- with the service-role key, only after a request passed size and
-- validation checks.
create or replace function public.sage_take_call(p_user uuid, p_limit integer default 30)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.sage_usage as u (user_id, day, calls)
  values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update
    set calls = u.calls + 1
    where u.calls < p_limit
  returning u.calls into n;
  return n is not null;
end;
$$;

revoke all on function public.sage_take_call(uuid, integer) from public, anon, authenticated;
grant execute on function public.sage_take_call(uuid, integer) to service_role;
