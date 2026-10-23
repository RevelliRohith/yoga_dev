-- READ ONLY. Preparation for fees/payments; never reads application or Auth rows.
-- Run in the verified project ogzdhmptzeyinhgxcgii SQL Editor as postgres.
-- Export the single schema_inventory result. No migration or grants are executed.
begin read only;
with tables as (
  select c.oid, c.relname, c.relkind, pg_get_userbyid(c.relowner) as owner,
    c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p','v','m')
), columns as (
  select table_name, column_name, ordinal_position, data_type, udt_name, is_nullable, column_default
  from information_schema.columns where table_schema = 'public'
), constraints as (
  select t.relname as table_name, k.conname, k.convalidated, pg_get_constraintdef(k.oid, true) as definition
  from pg_constraint k join tables t on t.oid = k.conrelid
), policies as (
  select tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies where schemaname = 'public'
), functions as (
  select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type, p.prosecdef as security_definer,
    pg_get_userbyid(p.proowner) as owner, p.proconfig as settings
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
)
select jsonb_build_object(
  'expected_project_reference', 'ogzdhmptzeyinhgxcgii',
  'database_role', current_user,
  'captured_at_utc', to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'tables', (select coalesce(jsonb_agg(to_jsonb(t) order by t.relname), '[]'::jsonb) from tables t),
  'columns', (select coalesce(jsonb_agg(to_jsonb(c) order by c.table_name,c.ordinal_position), '[]'::jsonb) from columns c),
  'constraints', (select coalesce(jsonb_agg(to_jsonb(c) order by c.table_name,c.conname), '[]'::jsonb) from constraints c),
  'policies', (select coalesce(jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname), '[]'::jsonb) from policies p),
  'functions', (select coalesce(jsonb_agg(to_jsonb(f) order by f.proname,f.arguments), '[]'::jsonb) from functions f)
) as schema_inventory;
rollback;
