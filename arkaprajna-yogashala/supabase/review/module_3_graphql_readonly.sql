-- REVIEW ONLY: metadata SELECTs. Not executed by the agent.
-- No GraphQL/data queries, secret values, student rows, or permission changes.
begin read only;

-- 1. Installed GraphQL version and schema usage/creation rights.
select e.extname, e.extversion, n.nspname as extension_schema
from pg_extension e join pg_namespace n on n.oid = e.extnamespace
where e.extname = 'pg_graphql';

select n.nspname as schema_name, api.role_name,
       has_schema_privilege(api.role_name, n.oid, 'USAGE') as can_use_schema,
       has_schema_privilege(api.role_name, n.oid, 'CREATE') as can_create_objects,
       obj_description(n.oid, 'pg_namespace') as schema_comment
from pg_namespace n
cross join (values ('anon'::text), ('authenticated'::text)) api(role_name)
where n.nspname in ('public', 'graphql_public', 'graphql', 'extensions', 'vault')
order by n.nspname, api.role_name;

-- 2. Exposed GraphQL wrappers and the engine entry point: inspect execution
-- context and called functions, especially any custom SECURITY DEFINER wrapper.
select n.nspname as function_schema, p.proname,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_userbyid(p.proowner) as owner, p.prosecdef as security_definer,
       p.proconfig as settings, e.extname as owned_by_extension,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
left join pg_depend d on d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
left join pg_extension e on e.oid = d.refobjid
where p.prokind = 'f'
  and (n.nspname = 'graphql_public' or (n.nspname = 'graphql' and p.proname = 'resolve'))
order by n.nspname, p.proname, arguments;

-- 3. Metadata and directives for the three reported non-public views only.
-- NEVER SELECT FROM vault.decrypted_secrets or the statistics views themselves.
select n.nspname, c.relname, pg_get_userbyid(c.relowner) as owner,
       c.reloptions, obj_description(c.oid, 'pg_class') as view_comment,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_can_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_can_select
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where (n.nspname = 'extensions' and c.relname in ('pg_stat_statements', 'pg_stat_statements_info'))
   or (n.nspname = 'vault' and c.relname = 'decrypted_secrets')
order by n.nspname, c.relname;

-- 4. Only non-secret API/search-path settings, when stored in database/role config.
-- No rows does NOT establish the live API path: Dashboard settings may live elsewhere.
select coalesce(r.rolname, '(all roles)') as role_name,
       coalesce(db.datname, '(all databases)') as database_name,
       setting.value as setting
from pg_db_role_setting cfg
left join pg_roles r on r.oid = cfg.setrole
left join pg_database db on db.oid = cfg.setdatabase
cross join lateral unnest(cfg.setconfig) setting(value)
where setting.value like 'search_path=%'
   or setting.value like 'pgrst.db_schemas=%'
   or setting.value like 'pgrst.db_extra_search_path=%'
order by role_name, database_name, setting.value;

rollback;
