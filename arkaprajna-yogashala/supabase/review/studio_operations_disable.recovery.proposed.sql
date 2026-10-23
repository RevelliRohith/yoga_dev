-- PROPOSAL ONLY. Separate explicit approval required. Preserves data and read access.
-- Quarantine new writes/public RPCs; disable only this proposal's enrollment trigger
-- if it disrupts existing registration. Record the resulting history gap.
begin;
do $$begin if current_user<>'postgres' then raise exception 'Verified postgres required.';end if;end$$;
revoke execute on function public.studio_public_content(),public.studio_submit_inquiry(uuid,text,text,text,date,text,text) from anon,authenticated;
revoke insert,update on public.studio_settings,public.studio_events from authenticated;
revoke update(status,notes,updated_at) on public.studio_inquiries from authenticated;
revoke insert on public.studio_certificates from authenticated;
alter table public.students disable trigger studio_enrollment_history;
commit;
