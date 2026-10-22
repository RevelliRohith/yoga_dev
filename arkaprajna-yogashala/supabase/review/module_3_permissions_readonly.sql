-- PHASE A: READ ONLY. Run in Supabase SQL Editor and share schema result grids.
-- No user rows, Auth identities, keys, passwords, or tokens are queried.
-- Redact any unexpected hardcoded secrets in custom function definitions.
begin read only;

-- 1. Complete role-check definitions, including SECURITY DEFINER, search_path,
-- owner, overloads, and explicit ACLs. NULL function_settings means no per-function
-- setting; inspect function_definition for any configuration inside the body.
select ns.nspname as function_schema, fn.proname as function_name,
       pg_get_function_identity_arguments(fn.oid) as arguments,
       pg_get_userbyid(fn.proowner) as owner,
       fn.prosecdef as security_definer, fn.proconfig as function_settings,
       fn.proacl::text as explicit_acl,
       pg_get_functiondef(fn.oid) as function_definition
from pg_proc fn join pg_namespace ns on ns.oid = fn.pronamespace
where ns.nspname = 'public'
  and fn.proname in ('is_admin', 'is_trainer')
order by ns.nspname, fn.proname, arguments;

-- 2. Function EXECUTE grants, including defaults when explicit_acl is NULL.
select ns.nspname as function_schema, fn.proname as function_name,
       pg_get_function_identity_arguments(fn.oid) as arguments,
       case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end as grantee,
       acl.privilege_type, acl.is_grantable
from pg_proc fn join pg_namespace ns on ns.oid = fn.pronamespace
cross join lateral aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) acl
where ns.nspname = 'public'
  and fn.proname in ('is_admin', 'is_trainer')
order by ns.nspname, fn.proname, arguments, grantee;

-- 3. Existing policies, including permissive/restrictive mode and both predicates.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
  and tablename in ('profiles', 'programs', 'batches', 'students')
order by tablename, policyname;

-- 4. RLS enabled and FORCE RLS flags for each table.
select rel.relname as table_name, rel.relrowsecurity as rls_enabled,
       rel.relforcerowsecurity as force_rls
from pg_class rel join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public' and rel.relkind in ('r', 'p')
  and rel.relname in ('profiles', 'programs', 'batches', 'students')
order by rel.relname;

-- 5. Student column names/types only. No student records are returned.
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'students'
order by table_name, ordinal_position;

-- 6. Table-level grants relevant to unauthenticated/authenticated API access.
select table_name, grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
  and table_name in ('profiles', 'programs', 'batches', 'students')
order by table_name, grantee, privilege_type;

-- 7. Column grants: RLS restricts rows, not individual private columns.
select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name in ('profiles', 'programs', 'batches', 'students')
  and grantee in ('anon', 'authenticated', 'PUBLIC')
order by table_name, column_name, grantee, privilege_type;

-- 8. Effective table privileges, including privileges inherited through roles/PUBLIC.
select api_role.role_name, rel.relname as table_name,
       has_table_privilege(api_role.role_name, rel.oid, 'SELECT') as can_select,
       has_table_privilege(api_role.role_name, rel.oid, 'INSERT') as can_insert,
       has_table_privilege(api_role.role_name, rel.oid, 'UPDATE') as can_update,
       has_table_privilege(api_role.role_name, rel.oid, 'DELETE') as can_delete
from pg_class rel join pg_namespace ns on ns.oid = rel.relnamespace
cross join (values ('anon'::text), ('authenticated'::text)) api_role(role_name)
where ns.nspname = 'public' and rel.relkind in ('r', 'p')
  and rel.relname in ('profiles', 'programs', 'batches', 'students')
order by api_role.role_name, rel.relname;

-- 9. Profile-protection triggers may prevent self-promotion/status changes.
select trg.tgname as trigger_name, trg.tgenabled as enabled_mode,
       pg_get_triggerdef(trg.oid, true) as trigger_definition,
       pg_get_functiondef(fn.oid) as function_definition
from pg_trigger trg join pg_proc fn on fn.oid = trg.tgfoid
where trg.tgrelid = 'public.profiles'::regclass and not trg.tgisinternal
order by trg.tgname;

rollback;
