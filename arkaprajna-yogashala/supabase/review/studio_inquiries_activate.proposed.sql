-- SEPARATE APPROVAL ONLY. Enables public inquiry collection at the database API.
-- Require confirmed public contact/privacy/retention policy, spam review and UI activation.
begin;
do $$begin if current_user<>'postgres' then raise exception 'Verified postgres required.';end if; if to_regprocedure('public.studio_submit_inquiry(uuid,text,text,text,date,text,text)') is null then raise exception 'Review and apply operations schema first.';end if;end$$;
grant execute on function public.studio_submit_inquiry(uuid,text,text,text,date,text,text) to anon,authenticated;
commit;
