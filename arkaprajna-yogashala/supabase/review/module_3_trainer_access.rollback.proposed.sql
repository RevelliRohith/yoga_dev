-- REVIEW ONLY: NOT EXECUTED. Requires separate explicit approval before execution.
-- WARNING: restores the previous, LESS RESTRICTIVE access behavior.
-- Inactive trainers will pass is_trainer again, and the old permissive policies
-- will again expose full active program/assigned student rows.
-- Coordinate with the app rollout; new RPC-dependent pages must be disabled first.
-- Does not touch the separately proposed table-grant hardening.
begin;

do $$
declare
  target record;
  found_oid oid;
  current_body text;
begin
  if current_user <> 'postgres' then
    raise exception 'Use the postgres role for this reviewed rollback.';
  end if;

  -- Refuse to remove same-named objects not marked as belonging to this proposal.
  for target in select * from (values
    ('programs', 'Module 3 direct programs admin only'),
    ('students', 'Module 3 direct students admin only')
  ) as targets(table_name, policy_name) loop
    select p.oid into found_oid from pg_policy p
    where p.polrelid = to_regclass('public.' || target.table_name)
      and p.polname = target.policy_name;
    if found_oid is not null
       and obj_description(found_oid, 'pg_policy') is distinct from 'arkaprajna.module3.trainer-access.v1' then
      raise exception 'Unrecognized policy; rollback cancelled.';
    end if;
  end loop;

  for target in select * from (values
    ('public.trainer_dashboard_batches()'), ('public.trainer_student_roster()')
  ) as targets(signature) loop
    found_oid := to_regprocedure(target.signature);
    if found_oid is not null
       and obj_description(found_oid, 'pg_proc') is distinct from 'arkaprajna.module3.trainer-access.v1' then
      raise exception 'Unrecognized RPC; rollback cancelled.';
    end if;
  end loop;

  -- Only restore the exact reviewed helper, not a subsequent unrelated change.
  select lower(regexp_replace(prosrc, '[[:space:]]+', '', 'g')) into current_body
  from pg_proc where oid = to_regprocedure('public.is_trainer()');
  if current_body is null or current_body not in (
    lower(regexp_replace($old$
      SELECT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'trainer');
    $old$, '[[:space:]]+', '', 'g')),
    lower(regexp_replace($new$
      select exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'trainer' and p.is_active = true);
    $new$, '[[:space:]]+', '', 'g'))
  ) then
    raise exception 'is_trainer changed outside this proposal; rollback cancelled.';
  end if;
  if exists (
    select 1 from pg_proc p where p.oid = 'public.is_trainer()'::regprocedure
    and (p.proowner <> 'postgres'::regrole or not p.prosecdef
      or p.provolatile <> 's' or p.prorettype <> 'boolean'::regtype
      or not coalesce('search_path=""' = any(p.proconfig), false))
  ) then
    raise exception 'is_trainer configuration changed; rollback cancelled.';
  end if;
end $$;

-- Never use CASCADE: unexpected dependent objects must cause a full rollback.
drop function if exists public.trainer_student_roster();
drop function if exists public.trainer_dashboard_batches();
drop policy if exists "Module 3 direct students admin only" on public.students;
drop policy if exists "Module 3 direct programs admin only" on public.programs;

-- Exact supplied baseline. CREATE OR REPLACE retains the current owner and ACLs.
create or replace function public.is_trainer()
returns boolean language sql stable security definer set search_path = ''
as $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'trainer'
  );
$function$;

commit;
