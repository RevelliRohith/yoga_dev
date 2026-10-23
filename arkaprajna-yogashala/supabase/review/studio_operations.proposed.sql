-- PROPOSAL ONLY. NOT APPLIED. Separate production approval required.
-- Independent of the Phase 5 financial migration. No rows seeded, services configured,
-- messages sent, uploads enabled or existing policies/functions/grants replaced.
-- Adds five tables and an approved enrollment-history trigger on existing students.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$begin
 if current_user<>'postgres' or to_regprocedure('public.is_admin()') is null then raise exception 'Verified postgres/admin helper required.';end if;
 if exists(select 1 from pg_class where relnamespace='public'::regnamespace and relname like 'studio_%') or exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname like 'studio_%') then raise exception 'Studio objects already exist; stop and review rather than rerun.';end if;
 if has_schema_privilege('anon','public','CREATE') or has_schema_privilege('authenticated','public','CREATE') or exists(select 1 from pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls)) or pg_has_role('anon','postgres','USAGE') or pg_has_role('authenticated','postgres','USAGE') then raise exception 'Unsafe API roles/schema grants.';end if;
end$$;
create table public.studio_settings(id text primary key check(id='studio'),content jsonb not null check(jsonb_typeof(content)='object' and octet_length(content::text)<=150000),updated_at timestamptz not null default clock_timestamp());
create table public.studio_events(id uuid primary key,title text not null check(length(btrim(title)) between 1 and 150),description text not null default '' check(length(description)<=10000),starts_at timestamptz not null,venue text not null default '' check(length(venue)<=300),published boolean not null default false,updated_at timestamptz not null default clock_timestamp());
create index studio_events_schedule on public.studio_events(starts_at,id) where published;
create table public.studio_inquiries(id uuid primary key,full_name text not null check(length(btrim(full_name)) between 1 and 150),mobile text not null check(mobile ~ '^\+91[6-9][0-9]{9}$'),program text not null default '' check(length(program)<=150),preferred_date date,message text not null default '' check(length(message)<=2000),status text not null default 'new' check(status in ('new','contacted','converted','closed')),notes text not null default '' check(length(notes)<=4000),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp());
create index studio_inquiries_rate on public.studio_inquiries(created_at,mobile);
create table public.studio_certificates(id uuid primary key,reference text not null unique check(reference ~ '^AYC-[0-9]{4}-[A-F0-9]{12}$'),participant_name text not null check(length(btrim(participant_name)) between 1 and 150),title text not null check(length(btrim(title)) between 1 and 200),issue_date date not null check(issue_date<=(current_timestamp at time zone 'Asia/Kolkata')::date),created_at timestamptz not null default clock_timestamp());
create table public.studio_audit(id uuid primary key default gen_random_uuid(),entity_id text not null,source text not null,action text not null,details jsonb not null,created_by uuid,created_at timestamptz not null default clock_timestamp());
create index studio_audit_entity on public.studio_audit(source,entity_id,created_at);
create function public.studio_audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare v_before jsonb;v_after jsonb;
begin
 if tg_table_name='students' then
  if tg_op='UPDATE' and new.program_id is not distinct from old.program_id and new.batch_id is not distinct from old.batch_id and new.status is not distinct from old.status then return new;end if;
  v_before:=case when tg_op='UPDATE' then jsonb_build_object('program_id',old.program_id,'batch_id',old.batch_id,'status',old.status) else null end;
  v_after:=jsonb_build_object('program_id',new.program_id,'batch_id',new.batch_id,'status',new.status);
 else
  -- Exclude inquiry contact/message content from duplicate audit storage.
  if tg_table_name='studio_inquiries' then v_before:=case when tg_op='UPDATE' then jsonb_build_object('status',old.status,'notes',old.notes) else null end;v_after:=jsonb_build_object('status',new.status,'notes',new.notes);
  else v_before:=case when tg_op='UPDATE' then to_jsonb(old) else null end;v_after:=to_jsonb(new);end if;
 end if;
 insert into public.studio_audit(entity_id,source,action,details,created_by) values(new.id::text,tg_table_name,tg_op,jsonb_build_object('before',v_before,'after',v_after),auth.uid());
 return new;
end$$;
create trigger studio_enrollment_history after insert or update on public.students for each row execute function public.studio_audit_change();
do $$declare t text;begin foreach t in array array['studio_settings','studio_events','studio_inquiries','studio_certificates'] loop execute format('create trigger studio_change after insert or update on public.%I for each row execute function public.studio_audit_change()',t);end loop;end$$;
create function public.studio_public_content() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('settings',coalesce((select jsonb_object_agg(k,case when k='trainers' then coalesce((select jsonb_agg(jsonb_build_object('name',a.item->>'name','specialization',a.item->>'specialization','qualifications',a.item->>'qualifications','biography',a.item->>'biography')) from jsonb_array_elements(case when jsonb_typeof(v)='array' then v else '[]'::jsonb end) a(item) where exists(select 1 from public.profiles p where p.id::text=a.item->>'profile_id' and p.role='trainer' and p.is_active=true)),'[]'::jsonb) when k='programs' then coalesce((select jsonb_agg(jsonb_build_object('name',a.item->>'name','description',a.item->>'description','audience',a.item->>'audience')) from jsonb_array_elements(case when jsonb_typeof(v)='array' then v else '[]'::jsonb end) a(item)),'[]'::jsonb) else v end) from public.studio_settings s cross join lateral jsonb_each(s.content) e(k,v) where s.id='studio' and k=any(array['name','intro','mission','phone','email','address','whatsapp','social_url','logo_url','receipt_footer','certificate_footer','programs','trainers'])),'{}'::jsonb),'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'description',e.description,'starts_at',e.starts_at,'venue',e.venue,'published',e.published,'updated_at',e.updated_at) order by e.starts_at,e.id) from public.studio_events e where e.published),'[]'::jsonb));
$$;
create function public.studio_submit_inquiry(p_id uuid,p_name text,p_mobile text,p_program text,p_date date,p_message text,p_honeypot text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_id is null or p_name is null or length(btrim(p_name)) not between 1 and 150 or p_mobile is null or p_mobile !~ '^\+91[6-9][0-9]{9}$' or p_program is null or length(p_program)>150 or p_message is null or length(p_message)>2000 or coalesce(p_honeypot,'')<>'' or p_date<(current_timestamp at time zone 'Asia/Kolkata')::date then raise exception 'Invalid inquiry.';end if;
 -- Global durable limiter also applies to direct RPC calls; client IP is not trusted.
 perform pg_advisory_xact_lock(hashtextextended('arkaprajna.studio.inquiry',0));
 if exists(select 1 from public.studio_inquiries where id=p_id) then return true;end if;
 if (select count(*) from public.studio_inquiries where created_at>clock_timestamp()-interval '1 hour')>=50 or (select count(*) from public.studio_inquiries where mobile=p_mobile and created_at>clock_timestamp()-interval '1 hour')>=3 then raise exception 'Submission could not be accepted. Try later.';end if;
 insert into public.studio_inquiries(id,full_name,mobile,program,preferred_date,message) values(p_id,btrim(p_name),p_mobile,p_program,p_date,p_message);return true;
end$$;
-- No broad API table access. Anonymous access is limited to the two projections.
do $$declare t text;begin foreach t in array array['studio_settings','studio_events','studio_inquiries','studio_certificates','studio_audit'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on table public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on table public.%I to authenticated',t);
 execute format('create policy "Studio admin read" on public.%I for select to authenticated using ((select public.is_admin()))',t);
 if t in ('studio_settings','studio_events') then
  execute format('grant insert,update on table public.%I to authenticated',t);
  execute format('create policy "Studio admin insert" on public.%I for insert to authenticated with check ((select public.is_admin()))',t);
  execute format('create policy "Studio admin update" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',t);
 end if;
end loop;end$$;
grant update(status,notes,updated_at) on public.studio_inquiries to authenticated;
create policy "Studio admin followup" on public.studio_inquiries for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant insert on public.studio_certificates to authenticated;
create policy "Studio admin certificate issue" on public.studio_certificates for insert to authenticated with check ((select public.is_admin()));
revoke all on function public.studio_audit_change(),public.studio_public_content(),public.studio_submit_inquiry(uuid,text,text,text,date,text,text) from public,anon,authenticated,service_role;
grant execute on function public.studio_public_content() to anon,authenticated;
-- Inquiry collection remains DB-disabled until the separate activation is approved.
-- Abort on unexpected default ACL grants; inherited permissions need separate review.
do $$begin
 if exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where c.relnamespace='public'::regnamespace and c.relname like 'studio_%' and c.relkind='r' and a.grantee not in(c.relowner,'authenticated'::regrole)) then raise exception 'Unexpected studio table ACL. Review default privileges.';end if;
 if exists(select 1 from pg_class c where c.relnamespace='public'::regnamespace and c.relname like 'studio_%' and c.relkind='r' and (has_table_privilege('anon',c.oid,'SELECT') or has_table_privilege('anon',c.oid,'INSERT') or has_table_privilege('anon',c.oid,'UPDATE') or has_table_privilege('authenticated',c.oid,'DELETE') or has_table_privilege('authenticated',c.oid,'TRUNCATE') or has_table_privilege('authenticated',c.oid,'TRIGGER') or has_any_column_privilege('authenticated',c.oid,'REFERENCES'))) then raise exception 'Unsafe inherited studio privileges.';end if;
 if has_function_privilege('anon','public.studio_submit_inquiry(uuid,text,text,text,date,text,text)','EXECUTE') or has_function_privilege('authenticated','public.studio_submit_inquiry(uuid,text,text,text,date,text,text)','EXECUTE') or has_function_privilege('authenticated','public.studio_audit_change()','EXECUTE') then raise exception 'Unexpected inherited internal or unapproved inquiry EXECUTE.';end if;
end$$;
commit;
