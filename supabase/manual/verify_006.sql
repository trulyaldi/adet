-- verify_006: read-only checks that migration 006_quest.sql is fully in place.
-- Paste into the Supabase SQL Editor and run. Changes nothing.
-- Every row should say pass = true; the last row sums them up.

with checks(check_name, pass) as (
  values
    ('items table exists',                  to_regclass('public.items') is not null),
    ('links table exists',                  to_regclass('public.links') is not null),
    ('items: primary key (user_id, id)',    exists (
       select 1 from pg_constraint c where c.conrelid = to_regclass('public.items') and c.contype = 'p'
         and (select array_agg(a.attname::text order by k.ord) from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) = array['user_id', 'id'])),
    ('links: primary key (user_id, id)',    exists (
       select 1 from pg_constraint c where c.conrelid = to_regclass('public.links') and c.contype = 'p'
         and (select array_agg(a.attname::text order by k.ord) from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) = array['user_id', 'id'])),
    ('items: deleted_at, server_updated_at', (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'items' and column_name in ('deleted_at', 'server_updated_at', 'updated_at')) = 3),
    ('links: deleted_at, server_updated_at', (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'links' and column_name in ('deleted_at', 'server_updated_at', 'updated_at')) = 3),
    ('items: row level security on',        coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.items')), false)),
    ('links: row level security on',        coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.links')), false)),
    ('items: 4 own-row policies',           (select count(*) from pg_policies where schemaname = 'public' and tablename = 'items'
       and policyname in ('items_select_own', 'items_insert_own', 'items_update_own', 'items_delete_own')) = 4),
    ('links: 4 own-row policies',           (select count(*) from pg_policies where schemaname = 'public' and tablename = 'links'
       and policyname in ('links_select_own', 'links_insert_own', 'links_update_own', 'links_delete_own')) = 4),
    ('items: server_updated_at trigger',    exists (select 1 from pg_trigger where tgrelid = to_regclass('public.items')
       and tgname = 'items_set_server_updated_at' and not tgisinternal)),
    ('links: server_updated_at trigger',    exists (select 1 from pg_trigger where tgrelid = to_regclass('public.links')
       and tgname = 'links_set_server_updated_at' and not tgisinternal)),
    ('items: indexes',                      (select count(*) from pg_indexes where schemaname = 'public' and tablename = 'items'
       and indexname in ('items_user_type_idx', 'items_user_server_updated_idx')) = 2),
    ('links: indexes',                      (select count(*) from pg_indexes where schemaname = 'public' and tablename = 'links'
       and indexname in ('links_user_from_idx', 'links_user_to_idx', 'links_user_server_updated_idx')) = 3)
)
select check_name, pass from checks
union all
select '== ALL 006 CHECKS', bool_and(pass) from checks;
