-- verify_007: read-only checks that migration 007_sage_usage.sql is in place
-- (only needed if you deploy the Sage Edge Function). Changes nothing.
-- Every row should say pass = true; the last row sums them up.

with checks(check_name, pass) as (
  values
    ('sage_usage table exists',                   to_regclass('public.sage_usage') is not null),
    ('sage_usage: row level security on',         coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.sage_usage')), false)),
    ('sage_usage: no client policies',            not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'sage_usage')),
    ('sage_usage: clients cannot read it',        case when to_regclass('public.sage_usage') is null then false
       else not has_table_privilege('authenticated', 'public.sage_usage', 'select')
        and not has_table_privilege('anon', 'public.sage_usage', 'select') end),
    ('sage_take_call() exists',                   to_regprocedure('public.sage_take_call(uuid, integer)') is not null),
    ('sage_take_call() is security definer',      coalesce((select prosecdef from pg_proc where oid = to_regprocedure('public.sage_take_call(uuid, integer)')), false)),
    ('clients cannot call sage_take_call()',      case when to_regprocedure('public.sage_take_call(uuid, integer)') is null then false
       else not has_function_privilege('authenticated', 'public.sage_take_call(uuid, integer)', 'execute')
        and not has_function_privilege('anon', 'public.sage_take_call(uuid, integer)', 'execute') end),
    ('service_role can call sage_take_call()',    case when to_regprocedure('public.sage_take_call(uuid, integer)') is null then false
       else has_function_privilege('service_role', 'public.sage_take_call(uuid, integer)', 'execute') end)
)
select check_name, pass from checks
union all
select '== ALL 007 CHECKS', bool_and(pass) from checks;
