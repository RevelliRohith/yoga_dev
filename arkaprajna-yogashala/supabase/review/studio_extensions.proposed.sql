-- PROPOSAL ONLY. Not applied. Requires separate approval after operations proposal.
-- Preserves existing auth/RLS and financial proposal. No payments or messaging.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$begin
 if current_user <> 'postgres' or to_regprocedure('public.is_admin()') is null or to_regclass('public.studio_certificates') is null then raise exception 'Verified operations schema and postgres required'; end if;
 if to_regclass('public.studio_reminders') is not null then raise exception 'Extension already exists: stop and review'; end if;
end$$;
alter table public.studio_certificates
 add column template text not null default 'classic' check(template in ('classic','minimal')),
 add column studio_name_snapshot text check(length(studio_name_snapshot) between 1 and 150),
 add column footer_snapshot text check(length(footer_snapshot)<=2000);
-- Historical records remain NULL: their original settings cannot be reconstructed.
create table public.studio_reminders(
 id text primary key check(id ~ '^(fee|payment|inquiry|event):[0-9a-fA-F-]{36}:[0-9T.Z-]{1,40}$'),
 handled boolean not null,
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid not null default auth.uid()
);
alter table public.studio_reminders enable row level security;
revoke all on public.studio_reminders from public,anon,authenticated,service_role;
grant select,insert(id,handled),update(handled) on public.studio_reminders to authenticated;
create policy "Reminder admin read" on public.studio_reminders for select to authenticated using ((select public.is_admin()));
create policy "Reminder admin insert" on public.studio_reminders for insert to authenticated with check ((select public.is_admin()));
create policy "Reminder admin update" on public.studio_reminders for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create function public.studio_reminder_stamp() returns trigger language plpgsql set search_path='' as $$begin new.updated_by:=auth.uid();new.updated_at:=clock_timestamp();return new;end$$;
revoke all on function public.studio_reminder_stamp() from public,anon,authenticated,service_role;
create trigger reminder_stamp before insert or update on public.studio_reminders for each row execute function public.studio_reminder_stamp();
create trigger studio_change after insert or update on public.studio_reminders for each row execute function public.studio_audit_change();
create function public.studio_set_reminder(p_id text,p_handled boolean) returns boolean language plpgsql security invoker set search_path='' as $$begin
 insert into public.studio_reminders(id,handled) values(p_id,p_handled) on conflict(id) do update set handled=excluded.handled;return true;
end$$;
revoke all on function public.studio_set_reminder(text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.studio_set_reminder(text,boolean) to authenticated;
create or replace function public.studio_public_content() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('settings',coalesce((select jsonb_object_agg(k,case when k='trainers' then coalesce((select jsonb_agg(jsonb_build_object('name',a.item->>'name','specialization',a.item->>'specialization','qualifications',a.item->>'qualifications','biography',a.item->>'biography')) from jsonb_array_elements(case when jsonb_typeof(v)='array' then v else '[]'::jsonb end) a(item) where exists(select 1 from public.profiles p where p.id::text=a.item->>'profile_id' and p.role='trainer' and p.is_active=true)),'[]'::jsonb) when k='programs' then coalesce((select jsonb_agg(jsonb_build_object('name',a.item->>'name','description',a.item->>'description','audience',a.item->>'audience')) from jsonb_array_elements(case when jsonb_typeof(v)='array' then v else '[]'::jsonb end) a(item)),'[]'::jsonb) else v end) from public.studio_settings s cross join lateral jsonb_each(s.content) e(k,v) where s.id='studio' and k=any(array['name','intro','mission','phone','email','address','whatsapp','social_url','logo_url','maps_url','receipt_footer','certificate_footer','programs','trainers'])),'{}'::jsonb),'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'description',e.description,'starts_at',e.starts_at,'venue',e.venue,'published',e.published,'updated_at',e.updated_at) order by e.starts_at,e.id) from public.studio_events e where e.published),'[]'::jsonb));
$$;

do $$begin
 if has_table_privilege('anon','public.studio_reminders','SELECT') or has_table_privilege('authenticated','public.studio_reminders','DELETE') or has_table_privilege('authenticated','public.studio_reminders','TRUNCATE') or has_function_privilege('anon','public.studio_reminder_stamp()','EXECUTE') then raise exception 'Unsafe inherited extension permissions';end if;
end$$;
commit;
