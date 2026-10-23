-- RECOVERY PROPOSAL ONLY. NOT APPLIED. Separate explicit approval required.
-- Stops authenticated financial write RPC entry points; preserves all rows,
-- SELECT policies, balances read RPC, receipts and audit history. No DROP/CASCADE.
begin;
do $$
declare f record; v_count integer:=0;
begin
  if current_user<>'postgres' then raise exception 'Use postgres in the verified project.'; end if;
  for f in select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) as arguments
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('fee_create_bill','fee_set_concession','fee_record_payment','fee_reverse_payment','fee_prepare_reminder') loop
    if obj_description(f.oid,'pg_proc') is distinct from 'arkaprajna.phase5.financial.v1:write' then raise exception 'Financial function marker changed; recovery cancelled.'; end if;
    execute format('revoke execute on function public.%I(%s) from authenticated',f.proname,f.arguments);
    v_count:=v_count+1;
  end loop;
  if v_count<>5 then raise exception 'Expected exactly five write RPCs. Stop for review.'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and obj_description(p.oid,'pg_proc')='arkaprajna.phase5.financial.v1:write'
      and has_function_privilege('authenticated',p.oid,'EXECUTE')) then raise exception 'Inherited EXECUTE remains. Transaction cancelled.'; end if;
end $$;
commit;
