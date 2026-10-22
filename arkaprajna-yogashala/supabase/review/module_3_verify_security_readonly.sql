-- REVIEW/VERIFICATION ONLY. Not executed by the agent.
-- Save results before any approved change; rerun after each approved step.
-- Metadata only: no student/profile rows, passwords, tokens, or keys.
begin read only;

-- 0. Normal API roles must not be superusers or bypass RLS.
select rolname, rolsuper, rolbypassrls, rolinherit
from pg_roles where rolname in ('anon', 'authenticated', 'postgres', 'service_role')
order by rolname;

-- 1. Effective grants. After hardening: CRUD true; the last three columns false.
-- Effective checks include PUBLIC and immediately inherited privileges.
select api.role_name, c.relname as table_name,
       has_table_privilege(api.role_name, c.oid, 'SELECT') as can_select,
       has_table_privilege(api.role_name, c.oid, 'INSERT') as can_insert,
       has_table_privilege(api.role_name, c.oid, 'UPDATE') as can_update,
       has_table_privilege(api.role_name, c.oid, 'DELETE') as can_delete,
       has_table_privilege(api.role_name, c.oid, 'TRUNCATE') as can_truncate,
       has_table_privilege(api.role_name, c.oid, 'TRIGGER') as can_create_trigger,
       has_any_column_privilege(api.role_name, c.oid, 'REFERENCES') as can_reference_columns,
       pg_has_role(api.role_name, c.relowner, 'USAGE') as has_table_owner_rights
from pg_class c join pg_namespace n on n.oid = c.relnamespace
cross join (values ('anon'::text), ('authenticated'::text)) api(role_name)
where n.nspname = 'public' and c.relkind in ('r', 'p')
  and c.relname in ('profiles', 'programs', 'batches', 'students')
order by api.role_name, c.relname;

-- 2. Show direct ACL sources, including PUBLIC. This helps investigate failures.
select c.relname as table_name,
       case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
       a.privilege_type, a.is_grantable
from pg_class c join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
where n.nspname = 'public' and c.relkind in ('r', 'p')
  and c.relname in ('profiles', 'programs', 'batches', 'students')
order by c.relname, grantee, a.privilege_type;

-- 3. Membership versus immediately usable inheritance. Membership can provide
-- further SQL role-switch paths; investigate it, do not blindly revoke parent grants.
select api.role_name, parent.rolname as member_of,
       pg_has_role(api.role_name, parent.oid, 'USAGE') as privileges_immediately_available,
       parent.rolsuper, parent.rolbypassrls
from pg_roles parent
cross join (values ('anon'::text), ('authenticated'::text)) api(role_name)
where parent.rolname <> api.role_name
  and pg_has_role(api.role_name, parent.oid, 'MEMBER')
order by api.role_name, parent.rolname;

-- 4. Compare old policies to the saved baseline: all remain, with two new
-- restrictive admin-only SELECT policies after the trainer-access step.
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
  and tablename in ('profiles', 'programs', 'batches', 'students')
order by tablename, policyname;

select c.relname as table_name, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as force_rls, pg_get_userbyid(c.relowner) as owner
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
  and c.relname in ('profiles', 'programs', 'batches', 'students')
order by c.relname;

-- 5. Owner/configuration/return allowlists and effective execution rights.
-- Helper grants are unchanged. New RPCs: anon=false, authenticated=true.
select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_userbyid(p.proowner) as owner, p.prosecdef as security_definer,
       p.proconfig as settings, pg_get_function_result(p.oid) as return_type,
       p.proargnames as argument_and_output_names,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in
  ('is_admin', 'is_trainer', 'trainer_dashboard_batches', 'trainer_student_roster')
order by p.proname, arguments;

select p.proname,
       case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
       a.privilege_type, a.is_grantable
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
where n.nspname = 'public' and p.proname in
  ('is_admin', 'is_trainer', 'trainer_dashboard_batches', 'trainer_student_roster')
order by p.proname, grantee;

-- 6. Foreign-key/constraint and trigger fingerprints. Compare with the baseline;
-- these OIDs/definitions/settings should not change due to these proposals.
select c.relname as table_name, k.oid as constraint_oid, k.conname,
       k.convalidated, pg_get_constraintdef(k.oid, true) as definition
from pg_constraint k join pg_class c on c.oid = k.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('profiles', 'programs', 'batches', 'students')
order by c.relname, k.conname;

select c.relname as table_name, t.oid as trigger_oid, t.tgname, t.tgenabled,
       t.tgisinternal, pg_get_triggerdef(t.oid, true) as definition
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('profiles', 'programs', 'batches', 'students')
order by c.relname, t.tgname;

rollback;
