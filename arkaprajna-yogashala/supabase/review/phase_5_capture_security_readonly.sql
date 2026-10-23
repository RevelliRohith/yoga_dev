-- READ ONLY. Single metadata snapshot for BEFORE/AFTER comparison.
-- No financial/student/Auth rows or credential values are selected.
-- Save BEFORE to a new ignored file; never overwrite the supplied schema inventory.
begin read only;
with relations as (
  select c.oid,c.relname,c.relkind,pg_get_userbyid(c.relowner) as owner,
    c.relrowsecurity,c.relforcerowsecurity,c.relacl::text as acl
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p','S','v','m')
), columns as (
  select table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default,is_generated,generation_expression
  from information_schema.columns where table_schema='public'
), policies as (
  select tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public'
), constraints as (
  select r.relname,k.oid,k.conname,k.contype,k.convalidated,k.condeferrable,k.condeferred,pg_get_constraintdef(k.oid,true) as definition
  from pg_constraint k join relations r on r.oid=k.conrelid
), triggers as (
  select r.relname,t.oid,t.tgname,t.tgenabled,t.tgisinternal,t.tgdeferrable,t.tginitdeferred,pg_get_triggerdef(t.oid,true) as definition
  from pg_trigger t join relations r on r.oid=t.tgrelid
), functions as (
  select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as result,pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.provolatile,p.proconfig,p.proacl::text as acl,
    has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
    obj_description(p.oid,'pg_proc') as marker,pg_get_functiondef(p.oid) as definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'
), grants as (
  select r.relname,api.role_name,
    has_table_privilege(api.role_name,r.oid,'SELECT') as can_select,
    has_table_privilege(api.role_name,r.oid,'INSERT') as can_insert,
    has_table_privilege(api.role_name,r.oid,'UPDATE') as can_update,
    has_table_privilege(api.role_name,r.oid,'DELETE') as can_delete,
    has_table_privilege(api.role_name,r.oid,'TRUNCATE') as can_truncate,
    has_table_privilege(api.role_name,r.oid,'TRIGGER') as can_trigger,
    has_any_column_privilege(api.role_name,r.oid,'REFERENCES') as can_reference,
    pg_has_role(api.role_name,r.owner,'USAGE') as has_owner_rights
  from relations r cross join (values('anon'::text),('authenticated'::text)) api(role_name)
  where r.relkind in ('r','p')
), memberships as (
  select api.role_name,parent.rolname as member_of,
    pg_has_role(api.role_name,parent.oid,'USAGE') as immediately_inherited,parent.rolsuper,parent.rolbypassrls
  from pg_roles parent cross join (values('anon'::text),('authenticated'::text)) api(role_name)
  where parent.rolname<>api.role_name and pg_has_role(api.role_name,parent.oid,'MEMBER')
)
select jsonb_build_object(
  'expected_project_reference','ogzdhmptzeyinhgxcgii','database_role',current_user,
  'postgres_version',current_setting('server_version'),
  'captured_at_utc',to_char(current_timestamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'relations',(select coalesce(jsonb_agg(to_jsonb(x) order by x.relname),'[]'::jsonb) from relations x),
  'columns',(select coalesce(jsonb_agg(to_jsonb(x) order by x.table_name,x.ordinal_position),'[]'::jsonb) from columns x),
  'policies',(select coalesce(jsonb_agg(to_jsonb(x) order by x.tablename,x.policyname),'[]'::jsonb) from policies x),
  'constraints',(select coalesce(jsonb_agg(to_jsonb(x) order by x.relname,x.conname),'[]'::jsonb) from constraints x),
  'triggers',(select coalesce(jsonb_agg(to_jsonb(x) order by x.relname,x.tgname),'[]'::jsonb) from triggers x),
  'functions',(select coalesce(jsonb_agg(to_jsonb(x) order by x.proname,x.arguments),'[]'::jsonb) from functions x),
  'effective_grants',(select coalesce(jsonb_agg(to_jsonb(x) order by x.relname,x.role_name),'[]'::jsonb) from grants x),
  'memberships',(select coalesce(jsonb_agg(to_jsonb(x) order by x.role_name,x.member_of),'[]'::jsonb) from memberships x)
) as financial_security_snapshot;
rollback;
