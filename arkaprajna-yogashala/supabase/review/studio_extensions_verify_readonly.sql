-- Read-only review; does not activate anything.
select current_database(),current_user;
select relname,relrowsecurity,relacl from pg_class where oid in ('public.studio_reminders'::regclass,'public.studio_certificates'::regclass);
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where tablename in ('studio_reminders','studio_certificates') and schemaname='public';
select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name='studio_certificates';
select proname,prosecdef,proconfig,proacl from pg_proc where oid in ('public.studio_set_reminder(text,boolean)'::regprocedure,'public.studio_reminder_stamp()'::regprocedure);
