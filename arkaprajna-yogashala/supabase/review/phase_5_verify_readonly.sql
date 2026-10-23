-- READ ONLY. Run ONLY after the separately approved financial migration succeeds.
-- Target ogzdhmptzeyinhgxcgii, postgres role. No records, payments or sends created.
-- This file inspects metadata and aggregate violation counts, not student PII.
begin read only;

select current_user as database_role,current_database() as database_name,
  current_setting('server_version') as postgres_version,
  (transaction_timestamp() at time zone 'Asia/Kolkata')::date as studio_today;

-- Expected: 5 tables, RLS=true, postgres owner, one admin SELECT policy each.
select c.relname,pg_get_userbyid(c.relowner) as owner,c.relrowsecurity,c.relforcerowsecurity,
  obj_description(c.oid,'pg_class') as marker
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname like 'fee_%' order by c.relname;
select tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename like 'fee_%' order by tablename,policyname;

-- Authenticated SELECT=true (RLS must still deny non-admin rows); all writes and
-- TRUNCATE/TRIGGER/REFERENCES=false. Anon SELECT and all other privileges=false.
select roles.role_name,c.relname,
  has_table_privilege(roles.role_name,c.oid,'SELECT') as can_select,
  has_table_privilege(roles.role_name,c.oid,'INSERT') as can_insert,
  has_table_privilege(roles.role_name,c.oid,'UPDATE') as can_update,
  has_table_privilege(roles.role_name,c.oid,'DELETE') as can_delete,
  has_table_privilege(roles.role_name,c.oid,'TRUNCATE') as can_truncate,
  has_table_privilege(roles.role_name,c.oid,'TRIGGER') as can_create_trigger,
  has_any_column_privilege(roles.role_name,c.oid,'REFERENCES') as can_reference_columns,
  pg_has_role(roles.role_name,c.relowner,'USAGE') as has_owner_rights
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values('anon'::text),('authenticated'::text)) roles(role_name)
where n.nspname='public' and c.relkind='r' and c.relname like 'fee_%'
order by c.relname,roles.role_name;

-- Inspect all effective helper/RPC access and definitions. Only the six marked
-- API functions grant authenticated EXECUTE. Every API function checks admin.
select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_userbyid(p.proowner) as owner,p.prosecdef as security_definer,p.proconfig,
  obj_description(p.oid,'pg_proc') as marker,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'fee_%' order by p.proname;

select c.relname as sequence_name,roles.role_name,
  has_sequence_privilege(roles.role_name,c.oid,'USAGE') as can_use,
  has_sequence_privilege(roles.role_name,c.oid,'UPDATE') as can_update,
  has_sequence_privilege(roles.role_name,c.oid,'SELECT') as can_read
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values('anon'::text),('authenticated'::text)) roles(role_name)
where n.nspname='public' and c.relkind='S' and c.relname like 'fee_%' order by c.relname,roles.role_name;

-- Constraints, generated amounts/dates, deferred integrity checks and indexes.
select c.relname,k.conname,k.contype,k.condeferrable,k.condeferred,k.convalidated,
  pg_get_constraintdef(k.oid,true) as definition
from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 'fee_%' order by c.relname,k.conname;
select table_name,column_name,data_type,is_nullable,column_default,is_generated,generation_expression
from information_schema.columns where table_schema='public' and table_name like 'fee_%'
order by table_name,ordinal_position;
select c.relname,t.tgname,t.tgenabled,t.tgdeferrable,t.tginitdeferred,pg_get_triggerdef(t.oid,true) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 'fee_%' and not t.tgisinternal order by c.relname,t.tgname;
select tablename,indexname,indexdef from pg_indexes
where schemaname='public' and tablename like 'fee_%' order by tablename,indexname;

-- Expected ALL violation counts zero. Empty tables do not prove runtime locking,
-- idempotency or audit behavior; controlled transaction tests remain mandatory.
select 'incomplete_payment_allocations' as check_name,count(*) as violations
from public.fee_payments p where p.amount_paise<>(select coalesce(sum(a.amount_paise),0) from public.fee_allocations a where a.payment_id=p.id)
union all
select 'overallocated_bills',count(*) from public.fee_bills b where public.fee_net_paid(b.id) not between 0 and b.due_paise
union all
select 'cross_student_allocations',count(*) from public.fee_allocations a
join public.fee_payments p on p.id=a.payment_id join public.fee_bills b on b.id=a.bill_id
where a.student_id<>p.student_id or a.student_id<>b.student_id
union all
select 'inconsistent_reversal_marker',count(*) from public.fee_payments p left join public.fee_reversals r on r.payment_id=p.id
where (p.reversed_at is null) is distinct from (r.id is null) or (r.id is not null and r.created_at is distinct from p.reversed_at)
union all
select 'missing_bill_audit',count(*) from public.fee_bills b where not exists(select 1 from public.fee_events e where e.source_table='fee_bills' and e.entity_id=b.id and e.action='bill_created')
union all
select 'missing_payment_audit',count(*) from public.fee_payments p where not exists(select 1 from public.fee_events e where e.source_table='fee_payments' and e.entity_id=p.id and e.action='payment_recorded')
union all
select 'missing_reversal_audit',count(*) from public.fee_reversals r where not exists(select 1 from public.fee_events e where e.source_table='fee_reversals' and e.entity_id=r.id and e.action='payment_reversed')
union all
select 'missing_allocation_audit',count(*) from public.fee_allocations a where not exists(select 1 from public.fee_events e where e.source_table='fee_allocations' and e.entity_id=a.payment_id and e.action='allocation_recorded' and (e.details->'after'->>'bill_id')::uuid=a.bill_id)
union all
select 'off_schedule_reminder',count(*) from public.fee_events e where e.action='reminder_prepared' and
  ((e.reminder_kind='upcoming' and extract(day from e.reminder_on)<>8)
    or (e.reminder_kind='grace' and extract(day from e.reminder_on)<>11)
    or (e.reminder_kind='overdue' and extract(day from e.reminder_on)<>16));

-- Existing application policies/functions must match saved Phase 5 inventory.
select tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename in ('profiles','programs','batches','students') order by tablename,policyname;
select p.proname,pg_get_functiondef(p.oid) as definition,p.proconfig,p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('is_admin','is_trainer','trainer_dashboard_batches','trainer_student_roster') order by p.proname;
-- Also rerun the existing module_3_capture_baseline_readonly.sql and compare its
-- original four-table constraints/triggers/ACLs; save under a NEW filename.
rollback;
