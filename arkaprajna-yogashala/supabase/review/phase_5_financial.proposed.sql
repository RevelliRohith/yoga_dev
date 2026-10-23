-- PROPOSAL ONLY. NOT APPLIED. Requires separate explicit execution approval.
-- Target: ogzdhmptzeyinhgxcgii; SQL Editor role postgres.
-- Outside migrations. One-time guarded migration; no application rows are seeded.
-- No existing application columns, policies, helpers, Auth settings or grants change.
-- New financial FKs necessarily add internal FK triggers to existing parent tables.
-- Review PHASE_5_DATABASE_REVIEW.md and the verification/recovery files first.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
begin
  if current_user <> 'postgres' then raise exception 'Use postgres in the verified project.'; end if;
  if current_setting('server_version_num')::integer<140000 then raise exception 'PostgreSQL 14+ is required; review this server version.'; end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname like 'fee_%')
    or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'fee_%') then
    raise exception 'Financial objects already exist. Stop: do not rerun or overwrite them.';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('profiles','programs','batches','students')
      and c.relkind='r' and c.relrowsecurity and not c.relforcerowsecurity
      and c.relowner='postgres'::regrole) <> 4 then
    raise exception 'Existing table ownership/RLS differs from the reviewed inventory.';
  end if;
  if exists(select 1 from pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls))
    or has_schema_privilege('anon','public','CREATE')
    or has_schema_privilege('authenticated','public','CREATE')
    or pg_has_role('authenticated','postgres','USAGE') or pg_has_role('anon','postgres','USAGE') then
    raise exception 'API role/schema privileges require separate review.';
  end if;
  if to_regprocedure('public.is_admin()') is null or to_regprocedure('public.is_trainer()') is null
    or to_regprocedure('public.trainer_dashboard_batches()') is null
    or to_regprocedure('public.trainer_student_roster()') is null then
    raise exception 'Expected existing role helpers/trainer RPCs are missing.';
  end if;
  if exists(select 1 from pg_proc p where p.oid in ('public.is_admin()'::regprocedure,'public.is_trainer()'::regprocedure)
    and (p.proowner<>'postgres'::regrole or not p.prosecdef or p.provolatile<>'s'
      or not coalesce('search_path=""'=any(p.proconfig),false))) then
    raise exception 'Existing role helper configuration differs.';
  end if;
  if (select lower(regexp_replace(p.prosrc,'[[:space:]]+','','g')) from pg_proc p where p.oid='public.is_admin()'::regprocedure)
      <> lower(regexp_replace($body$SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid()) AND role='admin');$body$,'[[:space:]]+','','g'))
    or (select lower(regexp_replace(p.prosrc,'[[:space:]]+','','g')) from pg_proc p where p.oid='public.is_trainer()'::regprocedure)
      <> lower(regexp_replace($body$select exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='trainer' and p.is_active=true);$body$,'[[:space:]]+','','g')) then
    raise exception 'Existing helper body differs from the verified baseline.';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='students'
      and policyname='Module 3 direct students admin only' and permissive='RESTRICTIVE' and cmd='SELECT')
    or not exists(select 1 from pg_policies where schemaname='public' and tablename='programs'
      and policyname='Module 3 direct programs admin only' and permissive='RESTRICTIVE' and cmd='SELECT') then
    raise exception 'Trainer privacy restrictions are missing.';
  end if;
end $preflight$;

create sequence public.fee_receipt_seq as bigint minvalue 1 no cycle;

create table public.fee_bills (
  id uuid primary key,
  student_id uuid not null references public.students(id) on delete restrict,
  billing_month date not null check (extract(day from billing_month)=1),
  due_on date generated always as (billing_month+9) stored,
  source text not null check (source in ('program','opening')),
  source_program_id uuid references public.programs(id) on delete restrict,
  student_code_snapshot text not null,
  student_name_snapshot text not null,
  program_name_snapshot text,
  base_paise bigint not null check (base_paise between 0 and 99999999999),
  currency text not null default 'INR' check (currency='INR'),
  concession_paise bigint not null default 0 check (concession_paise between 0 and base_paise),
  concession_reason text,
  due_paise bigint generated always as (base_paise-concession_paise) stored,
  opening_reference text,
  exception_reason text,
  creation_request jsonb not null,
  ledger_version bigint not null default 0 check (ledger_version>=0),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null,
  unique(student_id,billing_month), unique(id,student_id),
  check (concession_paise=0 or (concession_reason is not null and length(btrim(concession_reason)) between 3 and 1000)),
  check (concession_reason is null or length(btrim(concession_reason)) between 3 and 1000),
  check (exception_reason is null or length(btrim(exception_reason)) between 3 and 1000),
  check (opening_reference is null or length(btrim(opening_reference)) between 3 and 1000),
  check (source<>'opening' or (opening_reference is not null and length(btrim(opening_reference)) between 3 and 1000)),
  check (source<>'program' or source_program_id is not null)
);

create table public.fee_payments (
  id uuid primary key,
  student_id uuid not null references public.students(id) on delete restrict,
  amount_paise bigint not null check (amount_paise between 1 and 99999999999),
  currency text not null default 'INR' check (currency='INR'),
  method text not null check (method in ('cash','upi','bank_transfer')),
  received_on date not null,
  external_reference text,
  note text check (note is null or length(note)<=2000),
  receipt_number text not null unique,
  student_code_snapshot text not null,
  student_name_snapshot text not null,
  request_payload jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null,
  reversed_at timestamptz,
  unique(id,student_id),
  check (external_reference is null or length(external_reference)<=200),
  check (method='cash' or (external_reference is not null and length(btrim(external_reference)) between 3 and 200))
);
-- Active bank/UPI references cannot be recorded twice. A fully reversed entry
-- retains its original reference and receipt, while allowing an explicit correction.
create unique index fee_live_external_reference on public.fee_payments(method,lower(btrim(external_reference)))
  where reversed_at is null and method in ('upi','bank_transfer');

create table public.fee_allocations (
  payment_id uuid not null,
  bill_id uuid not null,
  student_id uuid not null,
  amount_paise bigint not null check (amount_paise between 1 and 99999999999),
  primary key(payment_id,bill_id),
  foreign key(payment_id,student_id) references public.fee_payments(id,student_id) on delete restrict,
  foreign key(bill_id,student_id) references public.fee_bills(id,student_id) on delete restrict
);
create index fee_allocations_bill on public.fee_allocations(bill_id);

create table public.fee_reversals (
  id uuid primary key,
  payment_id uuid not null unique,
  student_id uuid not null,
  kind text not null check (kind in ('entry_correction','verified_refund')),
  reason text not null check (length(btrim(reason)) between 3 and 2000),
  refund_reference text,
  request_payload jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null,
  foreign key(payment_id,student_id) references public.fee_payments(id,student_id) on delete restrict,
  check (kind<>'verified_refund' or (refund_reference is not null and length(btrim(refund_reference)) between 3 and 200))
);

create table public.fee_events (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  source_table text not null check (source_table in ('fee_bills','fee_payments','fee_allocations','fee_reversals','reminder')),
  entity_id uuid not null,
  action text not null check (action in ('bill_created','concession_changed','payment_recorded','payment_marked_reversed','allocation_recorded','payment_reversed','reminder_prepared')),
  details jsonb not null,
  reminder_kind text check (reminder_kind in ('upcoming','grace','overdue','payment_confirmation')),
  reminder_on date,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null,
  check ((action='reminder_prepared' and reminder_kind is not null and reminder_on is not null)
    or (action<>'reminder_prepared' and reminder_kind is null and reminder_on is null))
);
create index fee_events_entity on public.fee_events(source_table,entity_id,id);
create unique index fee_operation_retries on public.fee_events(action,request_id)
  where action in ('concession_changed','reminder_prepared');
create unique index fee_reminder_daily on public.fee_events(entity_id,reminder_kind,reminder_on)
  where action='reminder_prepared';
create index fee_bills_month on public.fee_bills(billing_month,student_id);
create index fee_payments_date on public.fee_payments(received_on,student_id);

create function public.fee_today() returns date
language sql stable set search_path='' as $$
  select (transaction_timestamp() at time zone 'Asia/Kolkata')::date;
$$;

create function public.fee_require_admin() returns uuid
language plpgsql stable security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception using errcode='42501', message='Administrator financial access required.';
  end if;
  return (select auth.uid());
end $$;

create function public.fee_paise(p_value numeric,p_zero_allowed boolean default true) returns bigint
language plpgsql immutable set search_path='' as $$
begin
  if p_value is null or p_value::text in ('NaN','Infinity','-Infinity')
    or p_value<0 or p_value>99999999999 or p_value<>trunc(p_value)
    or (not p_zero_allowed and p_value=0) then
    raise exception using errcode='22023', message='Amount must be exact whole paise within the reviewed limit.';
  end if;
  return p_value::bigint;
end $$;

create function public.fee_begin(p_request uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid;
begin
  v_actor:=public.fee_require_admin();
  if p_request is null then raise exception 'A stable request UUID is required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('arkaprajna.fee:'||p_request::text,0));
  perform set_config('app.fee_request_id',p_request::text,true);
  return v_actor;
end $$;

create function public.fee_net_paid(p_bill uuid) returns bigint
language sql stable security definer set search_path='' as $$
  select coalesce(sum(a.amount_paise),0)::bigint from public.fee_allocations a
  join public.fee_payments p on p.id=a.payment_id
  where a.bill_id=p_bill and p.reversed_at is null;
$$;

-- Immutable source records; only concession/version and the one-way reversal
-- marker may change. A reversal must already exist in the SAME transaction.
create function public.fee_guard_row() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform public.fee_require_admin();
  if nullif(current_setting('app.fee_request_id',true),'') is null then raise exception 'Use the checked financial RPCs.'; end if;
  if tg_op='DELETE' then raise exception 'Financial records cannot be deleted.'; end if;
  if tg_op='INSERT' and tg_table_name<>'fee_allocations' then
    if new.created_by is distinct from (select auth.uid()) then raise exception 'Financial actor identity differs from the verified administrator.'; end if;
  end if;
  if tg_op='UPDATE' then
    if tg_table_name='fee_bills' then
      -- Stored generated columns are NULL in BEFORE UPDATE's NEW record;
      -- PostgreSQL recomputes them after this trigger. Their source inputs
      -- remain protected below and by table constraints.
      if (to_jsonb(new)-array['concession_paise','concession_reason','ledger_version','due_on','due_paise'])
        is distinct from (to_jsonb(old)-array['concession_paise','concession_reason','ledger_version','due_on','due_paise'])
        or new.ledger_version<>old.ledger_version+1 then raise exception 'Only a reviewed bill adjustment/version change is allowed.'; end if;
    elsif tg_table_name='fee_payments' then
      if (to_jsonb(new)-'reversed_at') is distinct from (to_jsonb(old)-'reversed_at')
        or old.reversed_at is not null or new.reversed_at is null
        or not exists(select 1 from public.fee_reversals r where r.payment_id=old.id and r.created_at=new.reversed_at) then
        raise exception 'Only an audited one-way payment reversal marker is allowed.';
      end if;
    else raise exception 'This financial record is append-only.';
    end if;
  end if;
  return new;
end $$;

create function public.fee_audit_row() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_action text; v_entity uuid; v_request uuid;
begin
  v_request:=nullif(current_setting('app.fee_request_id',true),'')::uuid;
  if v_request is null then raise exception 'Financial writes require a checked RPC request context.'; end if;
  if tg_table_name='fee_bills' then
    if tg_op='UPDATE' and new.concession_paise=old.concession_paise and new.concession_reason is not distinct from old.concession_reason then return new; end if;
    v_action:=case when tg_op='INSERT' then 'bill_created' else 'concession_changed' end; v_entity:=new.id;
  elsif tg_table_name='fee_payments' then
    v_action:=case when tg_op='INSERT' then 'payment_recorded' else 'payment_marked_reversed' end; v_entity:=new.id;
  elsif tg_table_name='fee_allocations' then v_action:='allocation_recorded'; v_entity:=new.payment_id;
  else v_action:='payment_reversed'; v_entity:=new.id;
  end if;
  insert into public.fee_events(request_id,source_table,entity_id,action,details,created_by)
  values(v_request,tg_table_name,v_entity,v_action,jsonb_build_object('before',case when tg_op='UPDATE' then to_jsonb(old) else null end,'after',to_jsonb(new)),public.fee_require_admin());
  return new;
end $$;

create function public.fee_assert_integrity() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_payment uuid; v_bills uuid[]; v_bill record; v_total numeric; v_p public.fee_payments%rowtype;
begin
  if tg_table_name='fee_bills' then v_bills:=array[new.id];
  elsif tg_table_name='fee_allocations' then v_payment:=new.payment_id; v_bills:=array[new.bill_id];
  elsif tg_table_name='fee_payments' then v_payment:=new.id;
  else v_payment:=new.payment_id;
  end if;
  if v_payment is not null then
    select * into strict v_p from public.fee_payments where id=v_payment;
    select coalesce(sum(amount_paise),0) into v_total from public.fee_allocations where payment_id=v_payment;
    if v_total<>v_p.amount_paise then raise exception 'Every payment must be fully and explicitly allocated.'; end if;
    if (v_p.reversed_at is null) is distinct from (not exists(select 1 from public.fee_reversals r where r.payment_id=v_payment))
      or (v_p.reversed_at is not null and not exists(select 1 from public.fee_reversals r where r.payment_id=v_payment and r.created_at=v_p.reversed_at)) then
      raise exception 'Payment/reversal markers are inconsistent.';
    end if;
    if v_bills is null then select array_agg(bill_id) into v_bills from public.fee_allocations where payment_id=v_payment; end if;
  end if;
  for v_bill in select b.id,b.due_paise from public.fee_bills b where b.id=any(v_bills) order by b.id loop
    v_total:=public.fee_net_paid(v_bill.id);
    if v_total<0 or v_total>v_bill.due_paise then raise exception 'Allocated settlement exceeds the bill or is negative.'; end if;
  end loop;
  return null;
end $$;

do $triggers$
declare t text;
begin
  foreach t in array array['fee_bills','fee_payments','fee_allocations','fee_reversals','fee_events'] loop
    execute format('create trigger fee_guard before insert or update or delete on public.%I for each row execute function public.fee_guard_row()',t);
    if t<>'fee_events' then
      execute format('create trigger fee_audit after insert or update on public.%I for each row execute function public.fee_audit_row()',t);
      execute format('create constraint trigger fee_integrity after insert or update on public.%I deferrable initially deferred for each row execute function public.fee_assert_integrity()',t);
    end if;
  end loop;
end $triggers$;

-- Checked public write RPCs follow. No API role receives direct table writes.

create function public.fee_create_bill(
  p_request uuid,p_student uuid,p_month date,p_source text,p_program uuid,
  p_base_paise numeric,p_concession_paise numeric,p_concession_reason text,
  p_opening_reference text,p_exception_reason text,p_confirm boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_base bigint; v_discount bigint; v_request jsonb; v_existing public.fee_bills%rowtype;
  v_student public.students%rowtype; v_program public.programs%rowtype;
begin
  v_actor:=public.fee_begin(p_request); v_base:=public.fee_paise(p_base_paise); v_discount:=public.fee_paise(p_concession_paise);
  if p_confirm is distinct from true or p_month is null or extract(day from p_month)<>1
    or p_source is null or p_source not in ('program','opening') or v_discount>v_base then raise exception 'Confirm a valid calendar-month bill.'; end if;
  if v_discount>0 and coalesce(length(btrim(p_concession_reason)),0) not between 3 and 1000 then raise exception 'A concession reason is required.'; end if;
  v_request:=jsonb_build_object('student',p_student,'month',p_month,'source',p_source,'program',p_program,'base',v_base,'concession',v_discount,'concession_reason',nullif(btrim(p_concession_reason),''),'opening_reference',nullif(btrim(p_opening_reference),''),'exception_reason',nullif(btrim(p_exception_reason),''));
  select * into v_existing from public.fee_bills where id=p_request;
  if found then
    if v_existing.creation_request<>v_request then raise exception 'Request UUID was reused for different bill input.'; end if;
    return v_existing.id;
  end if;
  select * into strict v_student from public.students where id=p_student for update;
  if exists(select 1 from public.fee_bills where student_id=p_student and billing_month=p_month) then raise exception using errcode='23505',message='A bill already exists for this student/month; it was not repriced.'; end if;
  if p_source='opening' then
    if p_month>=date_trunc('month',public.fee_today())::date or coalesce(length(btrim(p_opening_reference)),0) not between 3 and 1000 or p_program is not null then
      raise exception 'Opening balances require a past month, source reference and explicit historical amount, not a current program rate.';
    end if;
  else
    if p_program is null or p_program is distinct from v_student.program_id then raise exception 'Enrollment changed or has no program. Review the preview.'; end if;
    select * into strict v_program from public.programs where id=p_program for share;
    if public.fee_paise(v_program.monthly_fee*100)<>v_base then raise exception 'Program fee changed or is invalid. Refresh the preview.'; end if;
    if p_month<date_trunc('month',v_student.joining_date)::date then raise exception 'Do not generate normal bills before admission; review a referenced opening balance instead.'; end if;
    if (v_student.status<>'active' or not v_program.is_active) and coalesce(length(btrim(p_exception_reason)),0) not between 3 and 1000 then raise exception 'Inactive enrollment needs explicit administrator review and a reason.'; end if;
  end if;
  insert into public.fee_bills(id,student_id,billing_month,source,source_program_id,student_code_snapshot,student_name_snapshot,program_name_snapshot,base_paise,concession_paise,concession_reason,opening_reference,exception_reason,creation_request,created_by)
  values(p_request,p_student,p_month,p_source,p_program,v_student.student_code,v_student.full_name,v_program.name,v_base,v_discount,nullif(btrim(p_concession_reason),''),nullif(btrim(p_opening_reference),''),nullif(btrim(p_exception_reason),''),v_request,v_actor);
  return p_request;
end $$;

create function public.fee_set_concession(p_request uuid,p_bill uuid,p_expected_version bigint,p_amount_paise numeric,p_reason text,p_confirm boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_bill public.fee_bills%rowtype; v_amount bigint; v_event public.fee_events%rowtype;
begin
  perform public.fee_begin(p_request); v_amount:=public.fee_paise(p_amount_paise);
  if p_confirm is distinct from true or coalesce(length(btrim(p_reason)),0) not between 3 and 1000 then raise exception 'Confirm the concession with a reason.'; end if;
  select * into v_event from public.fee_events where action='concession_changed' and request_id=p_request;
  if found then
    if v_event.entity_id is distinct from p_bill or (v_event.details->'after'->>'concession_paise')::bigint<>v_amount or v_event.details->'after'->>'concession_reason'<>btrim(p_reason) then raise exception 'Request UUID reused for different concession input.'; end if;
    return p_bill;
  end if;
  select * into strict v_bill from public.fee_bills where id=p_bill for update;
  if p_expected_version is distinct from v_bill.ledger_version then raise exception 'Bill changed. Refresh before adjusting.'; end if;
  if v_amount>v_bill.base_paise or v_bill.base_paise-v_amount<public.fee_net_paid(p_bill) then raise exception 'Concession would exceed the bill or create an unallocated overpayment.'; end if;
  if v_amount=v_bill.concession_paise and btrim(p_reason) is not distinct from v_bill.concession_reason then raise exception 'No concession change was requested.'; end if;
  update public.fee_bills set concession_paise=v_amount,concession_reason=btrim(p_reason),ledger_version=ledger_version+1 where id=p_bill;
  return p_bill;
end $$;

create function public.fee_record_payment(
  p_request uuid,p_student uuid,p_amount_paise numeric,p_method text,p_received_on date,
  p_reference text,p_note text,p_allocations jsonb,p_verified boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_amount bigint; v_allocations jsonb; v_payload jsonb; v_row jsonb; v_bill record;
  v_existing public.fee_payments%rowtype; v_student public.students%rowtype; v_count integer:=0;
begin
  v_actor:=public.fee_begin(p_request); v_amount:=public.fee_paise(p_amount_paise,false);
  if p_verified is distinct from true or p_method is null or p_method not in ('cash','upi','bank_transfer')
    or p_received_on is null or p_received_on>public.fee_today() or coalesce(length(p_note),0)>2000 then raise exception 'Confirm a valid received offline payment; no future payment dates or gateways are accepted.'; end if;
  if p_method<>'cash' and coalesce(length(btrim(p_reference)),0) not between 3 and 200 then raise exception 'A bank/UPI reference is required in addition to administrator verification.'; end if;
  if p_allocations is null or jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)=0 then raise exception 'Explicit month allocations are required.'; end if;
  for v_row in select value from jsonb_array_elements(p_allocations) loop
    if jsonb_typeof(v_row)<>'object' or not (v_row ?& array['bill_id','amount_paise']) or v_row-array['bill_id','amount_paise']<>'{}'::jsonb
      or jsonb_typeof(v_row->'amount_paise')<>'number' then raise exception 'Each allocation must contain only bill_id and numeric whole amount_paise.'; end if;
    perform public.fee_paise((v_row->>'amount_paise')::numeric,false);
    if (v_row->>'bill_id') is null then raise exception 'Allocation bill is missing.'; end if;
    perform (v_row->>'bill_id')::uuid;
  end loop;
  if (select count(distinct (value->>'bill_id')::uuid) from jsonb_array_elements(p_allocations))<>jsonb_array_length(p_allocations) then raise exception 'Combine repeated allocations to the same bill explicitly.'; end if;
  select jsonb_agg(jsonb_build_object('bill_id',(value->>'bill_id')::uuid,'amount_paise',public.fee_paise((value->>'amount_paise')::numeric,false)) order by (value->>'bill_id')::uuid)
    into v_allocations from jsonb_array_elements(p_allocations);
  if (select sum((value->>'amount_paise')::numeric) from jsonb_array_elements(v_allocations))<>v_amount then raise exception 'Every paise must be explicitly allocated; no silent excess or reallocation.'; end if;
  v_payload:=jsonb_build_object('student',p_student,'amount',v_amount,'method',p_method,'received_on',p_received_on,'reference',nullif(btrim(p_reference),''),'note',nullif(btrim(p_note),''),'allocations',v_allocations);
  select * into v_existing from public.fee_payments where id=p_request;
  if found then
    if v_existing.request_payload<>v_payload then raise exception 'Request UUID reused for different payment input.'; end if;
    return v_existing.id;
  end if;
  select * into strict v_student from public.students where id=p_student for share;
  for v_bill in select b.*, (j.value->>'amount_paise')::bigint as allocated
    from public.fee_bills b join jsonb_array_elements(v_allocations) j on b.id=(j.value->>'bill_id')::uuid
    order by b.id for update of b loop
    v_count:=v_count+1;
    if v_bill.student_id<>p_student or v_bill.allocated>v_bill.due_paise-public.fee_net_paid(v_bill.id) then raise exception 'Allocation belongs to another student or exceeds current outstanding balance.'; end if;
    -- The actual row write also forces a serialization conflict for stale RR snapshots.
    update public.fee_bills set ledger_version=ledger_version+1 where id=v_bill.id;
  end loop;
  if v_count<>jsonb_array_length(v_allocations) then raise exception 'An allocated bill no longer exists.'; end if;
  insert into public.fee_payments(id,student_id,amount_paise,method,received_on,external_reference,note,receipt_number,student_code_snapshot,student_name_snapshot,request_payload,created_by)
  values(p_request,p_student,v_amount,p_method,p_received_on,nullif(btrim(p_reference),''),nullif(btrim(p_note),''),'AYR-'||extract(year from public.fee_today())::text||'-'||nextval('public.fee_receipt_seq'::regclass)::text,v_student.student_code,v_student.full_name,v_payload,v_actor);
  insert into public.fee_allocations(payment_id,bill_id,student_id,amount_paise)
    select p_request,(value->>'bill_id')::uuid,p_student,(value->>'amount_paise')::bigint from jsonb_array_elements(v_allocations);
  return p_request;
end $$;

create function public.fee_reverse_payment(p_request uuid,p_payment uuid,p_kind text,p_reason text,p_refund_reference text,p_refund_verified boolean,p_confirm boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_payload jsonb; v_existing public.fee_reversals%rowtype;
  v_payment public.fee_payments%rowtype; v_bill record; v_when timestamptz;
begin
  v_actor:=public.fee_begin(p_request);
  if p_confirm is distinct from true or p_kind is null or p_kind not in ('entry_correction','verified_refund') or coalesce(length(btrim(p_reason)),0) not between 3 and 2000 then raise exception 'An explicit full-payment reversal and reason are required.'; end if;
  if p_kind='verified_refund' and (p_refund_verified is distinct from true or coalesce(length(btrim(p_refund_reference)),0) not between 3 and 200) then raise exception 'Refund disbursement must be separately verified and referenced; this function does not transfer money.'; end if;
  v_payload:=jsonb_build_object('payment',p_payment,'kind',p_kind,'reason',btrim(p_reason),'refund_reference',nullif(btrim(p_refund_reference),''));
  select * into v_existing from public.fee_reversals where id=p_request;
  if found then
    if v_existing.request_payload<>v_payload then raise exception 'Request UUID reused for another reversal.'; end if;
    return v_existing.id;
  end if;
  select * into strict v_payment from public.fee_payments where id=p_payment for update;
  if v_payment.reversed_at is not null or exists(select 1 from public.fee_reversals where payment_id=p_payment) then raise exception 'Payment already reversed; its receipt is preserved.'; end if;
  for v_bill in select b.id from public.fee_bills b join public.fee_allocations a on a.bill_id=b.id where a.payment_id=p_payment order by b.id for update of b loop
    update public.fee_bills set ledger_version=ledger_version+1 where id=v_bill.id;
  end loop;
  v_when:=clock_timestamp();
  insert into public.fee_reversals(id,payment_id,student_id,kind,reason,refund_reference,request_payload,created_at,created_by)
    values(p_request,p_payment,v_payment.student_id,p_kind,btrim(p_reason),nullif(btrim(p_refund_reference),''),v_payload,v_when,v_actor);
  update public.fee_payments set reversed_at=v_when where id=p_payment;
  return p_request;
end $$;

create function public.fee_bill_balances() returns table(
  id uuid,student_id uuid,billing_month date,due_on date,base_paise bigint,concession_paise bigint,
  due_paise bigint,paid_paise bigint,outstanding_paise bigint,payment_status text,overdue boolean,grace boolean,ledger_version bigint
) language plpgsql stable security definer set search_path='' as $$
begin
  perform public.fee_require_admin();
  return query select b.id,b.student_id,b.billing_month,b.due_on,b.base_paise,b.concession_paise,b.due_paise,
    p.paid,b.due_paise-p.paid,
    case when p.paid=b.due_paise then 'paid' when p.paid=0 then 'unpaid' else 'partially_paid' end,
    (b.due_paise>p.paid and public.fee_today()>=b.billing_month+15),
    (b.due_paise>p.paid and public.fee_today() between b.billing_month+10 and b.billing_month+14),b.ledger_version
  from public.fee_bills b cross join lateral (select public.fee_net_paid(b.id) as paid) p
  order by b.billing_month,b.student_id;
end $$;

create function public.fee_prepare_reminder(p_request uuid,p_bill uuid,p_kind text,p_payment uuid default null)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_bill public.fee_bills%rowtype; v_entity uuid; v_id bigint;
  v_today date; v_day integer; v_existing public.fee_events%rowtype; v_details jsonb;
begin
  v_actor:=public.fee_begin(p_request); v_today:=public.fee_today(); v_day:=extract(day from v_today)::integer;
  if p_kind is null or p_kind not in ('upcoming','grace','overdue','payment_confirmation') then raise exception 'Choose a supported manual reminder kind.'; end if;
  v_entity:=case when p_kind='payment_confirmation' then p_payment else p_bill end;
  v_details:=jsonb_build_object('bill_id',p_bill,'kind',p_kind,'payment_id',p_payment,'prepared_on',v_today,'delivery','not_sent');
  select * into v_existing from public.fee_events where action='reminder_prepared' and request_id=p_request;
  if found then
    if v_existing.entity_id is distinct from v_entity or v_existing.details-'prepared_on' is distinct from v_details-'prepared_on' then raise exception 'Request UUID reused for a different reminder.'; end if;
    return v_existing.id;
  end if;
  select * into strict v_bill from public.fee_bills where id=p_bill for share;
  if p_kind='payment_confirmation' then
    if p_payment is null or not exists(select 1 from public.fee_allocations a join public.fee_payments p on p.id=a.payment_id where a.bill_id=p_bill and a.payment_id=p_payment and p.reversed_at is null) then raise exception 'A confirmed non-reversed allocated payment is required.'; end if;
  else
    if p_payment is not null or v_bill.due_paise<=public.fee_net_paid(p_bill) then raise exception 'No outstanding balance to remind.'; end if;
    if (p_kind='upcoming' and (v_day<>8 or v_bill.billing_month<>date_trunc('month',v_today)::date))
      or (p_kind='grace' and (v_day<>11 or v_bill.billing_month<>date_trunc('month',v_today)::date))
      or (p_kind='overdue' and (v_day<>16 or v_today<v_bill.billing_month+15)) then raise exception 'This bill is not eligible for the approved manual reminder date.'; end if;
  end if;
  select id into v_id from public.fee_events where action='reminder_prepared' and entity_id=v_entity and reminder_kind=p_kind and reminder_on=v_today;
  if found then return v_id; end if;
  insert into public.fee_events(request_id,source_table,entity_id,action,details,reminder_kind,reminder_on,created_by)
    values(p_request,'reminder',v_entity,'reminder_prepared',v_details,p_kind,v_today,v_actor) returning id into v_id;
  return v_id;
end $$;

-- New objects only. Normal admin sessions SELECT through RLS and mutate via RPC.
do $permissions$
declare t text; f record; q text;
begin
  foreach t in array array['fee_bills','fee_payments','fee_allocations','fee_reversals','fee_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select on table public.%I to authenticated',t);
    execute format('create policy "Financial admin read" on public.%I for select to authenticated using ((select public.is_admin()))',t);
    execute format('comment on table public.%I is %L',t,'arkaprajna.phase5.financial.v1');
  end loop;
  revoke all on sequence public.fee_receipt_seq, public.fee_events_id_seq from public,anon,authenticated,service_role;
  for f in select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) as arguments
    from pg_proc p where p.oid=any(array[
      'public.fee_today()'::regprocedure,'public.fee_require_admin()'::regprocedure,
      'public.fee_paise(numeric,boolean)'::regprocedure,'public.fee_begin(uuid)'::regprocedure,
      'public.fee_net_paid(uuid)'::regprocedure,'public.fee_guard_row()'::regprocedure,
      'public.fee_audit_row()'::regprocedure,'public.fee_assert_integrity()'::regprocedure,
      'public.fee_create_bill(uuid,uuid,date,text,uuid,numeric,numeric,text,text,text,boolean)'::regprocedure,
      'public.fee_set_concession(uuid,uuid,bigint,numeric,text,boolean)'::regprocedure,
      'public.fee_record_payment(uuid,uuid,numeric,text,date,text,text,jsonb,boolean)'::regprocedure,
      'public.fee_reverse_payment(uuid,uuid,text,text,text,boolean,boolean)'::regprocedure,
      'public.fee_bill_balances()'::regprocedure,'public.fee_prepare_reminder(uuid,uuid,text,uuid)'::regprocedure
    ]) loop
    q:=format('public.%I(%s)',f.proname,f.arguments);
    execute format('revoke all on function %s from public,anon,authenticated,service_role',q);
    if f.proname in ('fee_create_bill','fee_set_concession','fee_record_payment','fee_reverse_payment','fee_prepare_reminder','fee_bill_balances') then
      execute format('grant execute on function %s to authenticated',q);
      execute format('comment on function %s is %L',q,case when f.proname='fee_bill_balances' then 'arkaprajna.phase5.financial.v1:read' else 'arkaprajna.phase5.financial.v1:write' end);
    else execute format('comment on function %s is %L',q,'arkaprajna.phase5.financial.v1:internal'); end if;
  end loop;
end $permissions$;

-- Unexpected default/inherited privileges abort the whole transaction.
do $postconditions$
begin
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) a
    where n.nspname='public' and c.relname like 'fee_%' and c.relkind in ('r','S')
      and not (a.grantee=c.relowner or (c.relkind='r' and a.grantee='authenticated'::regrole and a.privilege_type='SELECT'))) then
    raise exception 'Unexpected table/sequence grant remains; review defaults/inheritance.';
  end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where n.nspname='public' and p.proname like 'fee_%'
      and not (a.grantee=p.proowner or (a.grantee='authenticated'::regrole
        and obj_description(p.oid,'pg_proc') in ('arkaprajna.phase5.financial.v1:read','arkaprajna.phase5.financial.v1:write')))) then
    raise exception 'Unexpected financial function EXECUTE grant remains.';
  end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'fee_%' and has_function_privilege('anon',p.oid,'EXECUTE'))
    or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname like 'fee_%' and c.relkind='r'
      and (has_table_privilege('anon',c.oid,'SELECT') or has_table_privilege('authenticated',c.oid,'INSERT')
        or has_table_privilege('authenticated',c.oid,'UPDATE') or has_table_privilege('authenticated',c.oid,'DELETE')
        or has_table_privilege('authenticated',c.oid,'TRUNCATE') or has_any_column_privilege('authenticated',c.oid,'REFERENCES'))) then
    raise exception 'Effective inherited financial privileges are unsafe.';
  end if;
end $postconditions$;
-- No financial records are created by this migration. No external sends/gateway.
commit;
