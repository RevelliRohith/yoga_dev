-- PROPOSAL ONLY: separate explicit approval before production use.
begin;
do $$begin if current_user<>'postgres' then raise exception 'Verified postgres required';end if;end$$;
revoke execute on function public.studio_set_reminder(text,boolean) from anon,authenticated;
revoke insert(id,handled),update(handled) on public.studio_reminders from authenticated;
-- Quarantine issuance including new snapshot/template fields; retain records and reads.
revoke insert on public.studio_certificates from authenticated;
commit;
