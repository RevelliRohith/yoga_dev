-- READ ONLY: no database changes, no user rows, no secrets/credentials queried.
-- Review schema results before declaring all alternate paths secure.
-- Redact unexpected hardcoded secrets in custom routine definitions before sharing.
-- Scope is public. Confirm Data API exposed schemas in Supabase settings; repeat
-- for any other exposed application schemas. Do not assume public is the only one.
begin read only;

-- Owner-rights views may bypass base-table RLS. security_invoker=true is visible
-- in reloptions when configured. Materialized views contain cached data.
select c.relname as relation_name,
       case c.relkind when 'v' then 'view' when 'm' then 'materialized view' end as kind,
       pg_get_userbyid(c.relowner) as owner, c.reloptions,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_can_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_can_select,
       pg_get_viewdef(c.oid, true) as definition
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v', 'm')
order by c.relname;

-- Inspect ALL public functions, not just those whose source mentions students:
-- wrappers or dynamic SQL may hide the actual data access behind another call.
select p.proname as routine_name, pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_userbyid(p.proowner) as owner, p.prosecdef as security_definer,
       p.proconfig as settings, pg_get_function_result(p.oid) as return_type,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
order by p.proname, arguments;

-- Existing triggers can affect admin CRUD or expose indirect privileged paths.
select c.relname as table_name, t.tgname as trigger_name, t.tgenabled,
       pg_get_triggerdef(t.oid, true) as trigger_definition,
       pg_get_functiondef(p.oid) as function_definition
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'public' and not t.tgisinternal
  and c.relname in ('profiles', 'programs', 'batches', 'students')
order by c.relname, t.tgname;

rollback;
