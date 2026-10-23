-- READ ONLY. Fresh alternate-path review. No application/Auth rows or secrets queried.
-- Verified project ogzdhmptzeyinhgxcgii, role postgres. Export all result grids.
begin read only;
select current_user as database_role,current_setting('server_version') as postgres_version;
select rolname,rolsuper,rolbypassrls,rolinherit from pg_roles where rolname in ('anon','authenticated');
select n.nspname,api.role_name,has_schema_privilege(api.role_name,n.oid,'USAGE') can_use,has_schema_privilege(api.role_name,n.oid,'CREATE') can_create from pg_namespace n cross join(values('anon'),('authenticated'))api(role_name) where n.nspname in ('public','graphql_public','graphql','extensions','vault') order by n.nspname,api.role_name;
select n.nspname,c.relname,c.relkind,c.reloptions,pg_get_userbyid(c.relowner) owner,has_table_privilege('anon',c.oid,'SELECT') anon_select,has_table_privilege('authenticated',c.oid,'SELECT') authenticated_select from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('v','m') and n.nspname in ('public','graphql_public','graphql','extensions','vault') order by n.nspname,c.relname;
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef,p.proconfig,p.proacl,pg_get_userbyid(p.proowner) owner,has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','graphql_public') and p.prokind='f' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')) order by n.nspname,p.proname;
select extname,extversion from pg_extension where extname='pg_graphql';
select pg_get_userbyid(d.defaclrole) owner,n.nspname,d.defaclobjtype,d.defaclacl from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace order by owner,n.nspname,d.defaclobjtype;
select coalesce(r.rolname,'(all roles)') role_name,coalesce(db.datname,'(all databases)') database_name,s.value from pg_db_role_setting cfg left join pg_roles r on r.oid=cfg.setrole left join pg_database db on db.oid=cfg.setdatabase cross join lateral unnest(cfg.setconfig)s(value) where s.value like 'pgrst.db_schemas=%' or s.value like 'pgrst.db_extra_search_path=%' or s.value like 'search_path=%' order by role_name,database_name;
-- Settings stored outside pg_db_role_setting may not appear here. Confirm Dashboard
-- Data API exposed schemas separately; an empty setting grid does not prove exposure.
rollback;
