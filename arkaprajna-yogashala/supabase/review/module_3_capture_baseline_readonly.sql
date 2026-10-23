-- STAGE 3B PREPARATION: READ ONLY; not executed by the agent.
-- Run BEFORE the pending trainer-access migration, in the verified project.
-- Export the single result locally as module_3_security_before.csv (or JSON).
-- After migration, run again and export as module_3_security_after.csv (or JSON).
-- Do not overwrite the BEFORE export. No application/Auth user rows are read.
-- The project reference below is an export label, NOT proof of which DB is open.
-- Confirm the actual Dashboard project reference separately before running.
begin read only;

with target_tables as (
  select c.* from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    and c.relname in ('profiles', 'programs', 'batches', 'students')
), table_state as (
  select c.relname, c.oid, pg_get_userbyid(c.relowner) as owner,
         c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls, c.relacl::text as acl
  from target_tables c
), policy_state as (
  select tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies where schemaname = 'public'
    and tablename in ('profiles', 'programs', 'batches', 'students')
), effective_grants as (
  select api.role_name, c.relname as table_name,
    has_table_privilege(api.role_name, c.oid, 'SELECT') as can_select,
    has_table_privilege(api.role_name, c.oid, 'INSERT') as can_insert,
    has_table_privilege(api.role_name, c.oid, 'UPDATE') as can_update,
    has_table_privilege(api.role_name, c.oid, 'DELETE') as can_delete,
    has_table_privilege(api.role_name, c.oid, 'TRUNCATE') as can_truncate,
    has_table_privilege(api.role_name, c.oid, 'TRIGGER') as can_create_trigger,
    has_any_column_privilege(api.role_name, c.oid, 'REFERENCES') as can_reference_columns
  from target_tables c
  cross join (values ('anon'::text), ('authenticated'::text)) api(role_name)
), function_state as (
  select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_userbyid(p.proowner) as owner, p.prosecdef as security_definer,
    p.provolatile, p.proconfig as settings, p.proacl::text as acl,
    pg_get_function_result(p.oid) as return_type, pg_get_functiondef(p.oid) as definition,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and p.proname in ('is_admin', 'is_trainer', 'trainer_dashboard_batches', 'trainer_student_roster')
), constraint_state as (
  select c.relname as table_name, k.oid, k.conname, k.convalidated,
    pg_get_constraintdef(k.oid, true) as definition
  from pg_constraint k join target_tables c on c.oid = k.conrelid
), trigger_state as (
  select c.relname as table_name, t.oid, t.tgname, t.tgenabled, t.tgisinternal,
    pg_get_triggerdef(t.oid, true) as definition
  from pg_trigger t join target_tables c on c.oid = t.tgrelid
), column_state as (
  select table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
  from information_schema.columns where table_schema = 'public'
    and table_name in ('profiles', 'programs', 'batches', 'students')
), role_state as (
  select rolname, rolsuper, rolbypassrls, rolinherit
  from pg_roles where rolname in ('anon', 'authenticated', 'postgres', 'service_role')
)
select jsonb_build_object(
  'expected_project_reference', 'ogzdhmptzeyinhgxcgii',
  'captured_at_utc', to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'database_name', current_database(),
  'database_role', current_user,
  'tables', (select coalesce(jsonb_agg(to_jsonb(s) order by s.relname), '[]'::jsonb) from table_state s),
  'policies', (select coalesce(jsonb_agg(to_jsonb(s) order by s.tablename, s.policyname), '[]'::jsonb) from policy_state s),
  'effective_grants', (select coalesce(jsonb_agg(to_jsonb(s) order by s.role_name, s.table_name), '[]'::jsonb) from effective_grants s),
  'functions', (select coalesce(jsonb_agg(to_jsonb(s) order by s.proname, s.arguments), '[]'::jsonb) from function_state s),
  'constraints', (select coalesce(jsonb_agg(to_jsonb(s) order by s.table_name, s.conname), '[]'::jsonb) from constraint_state s),
  'triggers', (select coalesce(jsonb_agg(to_jsonb(s) order by s.table_name, s.tgname), '[]'::jsonb) from trigger_state s),
  'columns', (select coalesce(jsonb_agg(to_jsonb(s) order by s.table_name, s.ordinal_position), '[]'::jsonb) from column_state s),
  'roles', (select coalesce(jsonb_agg(to_jsonb(s) order by s.rolname), '[]'::jsonb) from role_state s)
) as security_snapshot;

rollback;
