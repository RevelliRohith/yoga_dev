-- READ ONLY. After separately approved execution only. No user records queried.
begin read only;
select relname,relrowsecurity,relforcerowsecurity,relacl from pg_class where relnamespace='public'::regnamespace and relname like 'studio_%' and relkind='r' order by relname;
select tablename,policyname,cmd,roles,qual,with_check from pg_policies where schemaname='public' and tablename like 'studio_%' order by tablename,policyname;
select proname,prosecdef,proconfig,proacl,pg_get_functiondef(oid) from pg_proc where pronamespace='public'::regnamespace and proname like 'studio_%' order by proname;
select c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid where not t.tgisinternal and (c.relname like 'studio_%' or t.tgname='studio_enrollment_history');
select api.role_name,c.relname,has_table_privilege(api.role_name,c.oid,'SELECT') can_select,has_table_privilege(api.role_name,c.oid,'DELETE') can_delete,has_table_privilege(api.role_name,c.oid,'TRUNCATE') can_truncate from pg_class c cross join(values('anon'),('authenticated'))api(role_name) where c.relnamespace='public'::regnamespace and c.relname like 'studio_%' and c.relkind='r';
rollback;
