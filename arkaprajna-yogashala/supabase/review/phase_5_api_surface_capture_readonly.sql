-- READ ONLY. Single-row export of ALL alternate-path inspection sections.
-- Run in project ogzdhmptzeyinhgxcgii as postgres; export api_surface_snapshot.
-- No application/Auth records, passwords, tokens or secret values queried.
-- Review unexpected hardcoded secrets in custom function definitions before sharing.
begin read only;
with api_roles as (
 select rolname,rolsuper,rolbypassrls,rolinherit from pg_roles where rolname in ('anon','authenticated')
), schemas as (
 select n.nspname,api.role_name,has_schema_privilege(api.role_name,n.oid,'USAGE') can_use,has_schema_privilege(api.role_name,n.oid,'CREATE') can_create
 from pg_namespace n cross join(values('anon'),('authenticated'))api(role_name)
 where n.nspname in ('public','graphql_public','graphql','extensions','vault')
), views as (
 select n.nspname,c.relname,c.relkind,c.reloptions,pg_get_userbyid(c.relowner) owner,has_table_privilege('anon',c.oid,'SELECT') anon_select,has_table_privilege('authenticated',c.oid,'SELECT') authenticated_select
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('v','m') and n.nspname in ('public','graphql_public','graphql','extensions','vault')
), functions as (
 select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef,p.proconfig,p.proacl::text,pg_get_userbyid(p.proowner) owner,has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,pg_get_functiondef(p.oid) definition
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','graphql_public') and p.prokind='f' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))
), extensions as (
 select extname,extversion from pg_extension where extname='pg_graphql'
), defaults as (
 select pg_get_userbyid(d.defaclrole) owner,n.nspname,d.defaclobjtype,d.defaclacl::text from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
), settings as (
 select coalesce(r.rolname,'(all roles)') role_name,coalesce(db.datname,'(all databases)') database_name,s.value
 from pg_db_role_setting cfg left join pg_roles r on r.oid=cfg.setrole left join pg_database db on db.oid=cfg.setdatabase cross join lateral unnest(cfg.setconfig)s(value)
 where s.value like 'pgrst.db_schemas=%' or s.value like 'pgrst.db_extra_search_path=%' or s.value like 'search_path=%'
)
select jsonb_build_object(
 'expected_project_reference','ogzdhmptzeyinhgxcgii',
 'database_role',current_user,'postgres_version',current_setting('server_version'),
 'captured_at_utc',to_char(current_timestamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
 'api_roles',(select coalesce(jsonb_agg(to_jsonb(x) order by x.rolname),'[]'::jsonb) from api_roles x),
 'schemas',(select coalesce(jsonb_agg(to_jsonb(x) order by x.nspname,x.role_name),'[]'::jsonb) from schemas x),
 'views',(select coalesce(jsonb_agg(to_jsonb(x) order by x.nspname,x.relname),'[]'::jsonb) from views x),
 'functions',(select coalesce(jsonb_agg(to_jsonb(x) order by x.nspname,x.proname,x.arguments),'[]'::jsonb) from functions x),
 'graphql_extensions',(select coalesce(jsonb_agg(to_jsonb(x) order by x.extname),'[]'::jsonb) from extensions x),
 'default_acls',(select coalesce(jsonb_agg(to_jsonb(x) order by x.owner,x.nspname,x.defaclobjtype),'[]'::jsonb) from defaults x),
 'settings',(select coalesce(jsonb_agg(to_jsonb(x) order by x.role_name,x.database_name,x.value),'[]'::jsonb) from settings x)
) as api_surface_snapshot;
-- Dashboard Data API exposure can be configured outside these database settings.
-- Confirm the Dashboard exposed-schema list separately; the project label is not proof.
rollback;
