-- REVIEW ONLY: NOT APPLIED. Requires explicit approval before execution.
-- Outside supabase/migrations: not picked up by automatic migration pushes.
-- No profile-field migration, account creation, row updates, deletions, or emails.
-- Existing admin policies, assignments, and public.is_admin() remain unchanged.
-- One-time migration, NOT silently idempotent: a second run aborts in preflight.
-- Pair with module_3_trainer_access.rollback.proposed.sql for a separately reviewed undo.
-- Review existing views/RPCs with module_3_alternate_paths_readonly.sql first.
-- Proposed execution step 2: the approved grant-hardening step must pass first.
begin;

-- Fail closed if execution context or previously reviewed prerequisites differ.
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Review this proposal using the postgres role in Supabase SQL Editor.';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname in ('profiles', 'programs', 'batches', 'students')
        and c.relkind in ('r', 'p') and c.relrowsecurity and not c.relforcerowsecurity) <> 4 then
    raise exception 'RLS settings differ from the reviewed baseline. No changes applied.';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'::text), ('authenticated'::text)) api_role(role_name)
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and c.relname in ('profiles', 'programs', 'batches', 'students')
      and (
        has_table_privilege(api_role.role_name, c.oid, 'TRUNCATE')
        or has_table_privilege(api_role.role_name, c.oid, 'TRIGGER')
        or has_any_column_privilege(api_role.role_name, c.oid, 'REFERENCES')
      )
  ) then
    raise exception 'Grant hardening is incomplete. Run only the separately approved grant proposal first.';
  end if;
  -- The narrow definer RPCs require the reviewed owner's ability to read these
  -- tables. Never weaken FORCE RLS or table ownership to make this check pass.
  if not exists(select 1 from pg_roles where rolname = 'postgres' and (rolsuper or rolbypassrls))
     and exists (
       select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p')
         and c.relname in ('profiles', 'programs', 'batches', 'students')
         and c.relowner <> 'postgres'::regrole
     ) then
    raise exception 'Definer ownership/RLS assumptions differ from the reviewed model. Review; do not alter ownership or RLS automatically.';
  end if;
  if to_regprocedure('public.is_admin()') is null
     or to_regprocedure('public.is_trainer()') is null then
    raise exception 'Expected role helpers are missing. No changes applied.';
  end if;
  if exists (
    select 1 from pg_proc p
    where p.oid in ('public.is_admin()'::regprocedure, 'public.is_trainer()'::regprocedure)
      and (p.proowner <> 'postgres'::regrole or not p.prosecdef
        or p.provolatile <> 's' or p.prorettype <> 'boolean'::regtype
        or not coalesce('search_path=""' = any(p.proconfig), false))
  ) then
    raise exception 'Role helper ownership/configuration differs from the reviewed baseline.';
  end if;
  -- Never replace an unrelated/future helper body, even if its signature matches.
  if (select lower(regexp_replace(prosrc, '[[:space:]]+', '', 'g'))
      from pg_proc where oid = 'public.is_trainer()'::regprocedure)
      <> lower(regexp_replace($baseline$
        SELECT EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = (SELECT auth.uid()) AND role = 'trainer'
        );
      $baseline$, '[[:space:]]+', '', 'g')) then
    raise exception 'is_trainer body differs from the supplied baseline. Review before replacing it.';
  end if;
  if to_regprocedure('public.trainer_dashboard_batches()') is not null
     or to_regprocedure('public.trainer_student_roster()') is not null then
    raise exception 'A proposed RPC already exists. Review instead of overwriting it.';
  end if;
  if exists(select 1 from pg_policies where schemaname = 'public'
      and policyname in ('Module 3 direct programs admin only', 'Module 3 direct students admin only')) then
    raise exception 'A proposed restriction already exists. Do not rerun this proposal.';
  end if;
end $$;

-- Keep the current helper signature, owner, STABLE behavior, search_path, and ACLs.
-- Inactive trainers no longer pass existing trainer policies, including batches.
create or replace function public.is_trainer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'trainer'
      and p.is_active = true
  );
$function$;

-- Restrictive policies are ANDed with existing permissive policies.
-- These preserve admin access while preventing full-row student/program reads
-- by authenticated non-admins, even if existing permissive trainer policies pass.
-- The existing policies are retained, not dropped or replaced.
create policy "Module 3 direct programs admin only"
on public.programs as restrictive for select to authenticated
using ((select public.is_admin()));
comment on policy "Module 3 direct programs admin only" on public.programs
is 'arkaprajna.module3.trainer-access.v1';

create policy "Module 3 direct students admin only"
on public.students as restrictive for select to authenticated
using ((select public.is_admin()));
comment on policy "Module 3 direct students admin only" on public.students
is 'arkaprajna.module3.trainer-access.v1';

-- Narrow, read-only RPC. Definer rights intentionally bypass the base restrictions;
-- explicit active-role and assignment checks are therefore mandatory here.
-- No trainer_id argument: callers cannot request another trainer's identity.
-- Read only assigned batches; program names are included without monthly fees.
create function public.trainer_dashboard_batches()
returns table (
  id uuid,
  name text,
  program_id uuid,
  program_name text,
  start_time text,
  end_time text,
  days_of_week text[],
  is_active boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  select b.id, b.name, b.program_id, p.name,
         b.start_time::pg_catalog.text, b.end_time::pg_catalog.text, b.days_of_week, b.is_active
  from public.batches b
  left join public.programs p on p.id = b.program_id
  where (select public.is_trainer())
    and b.trainer_id = (select auth.uid())
    and exists (
      select 1 from public.profiles trainer
      where trainer.id = (select auth.uid())
        and trainer.role = 'trainer' and trainer.is_active = true
    )
  order by b.name, b.id;
$function$;
comment on function public.trainer_dashboard_batches()
is 'arkaprajna.module3.trainer-access.v1';

-- Proposed minimal student allowlist. No DOB, gender, phone/email, address,
-- guardian details, or future financial columns can be returned by this RPC.
create function public.trainer_student_roster()
returns table (
  id uuid,
  student_code text,
  full_name text,
  program_id uuid,
  batch_id uuid,
  status text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select s.id, s.student_code, s.full_name, s.program_id, s.batch_id, s.status
  from public.students s
  join public.batches b on b.id = s.batch_id
  where (select public.is_trainer())
    and b.trainer_id = (select auth.uid())
    and exists (
      select 1 from public.profiles trainer
      where trainer.id = (select auth.uid())
        and trainer.role = 'trainer' and trainer.is_active = true
    )
  order by s.full_name, s.id;
$function$;
comment on function public.trainer_student_roster()
is 'arkaprajna.module3.trainer-access.v1';

-- Explicit grants on NEW RPCs only. Existing helper grants stay unchanged.
-- Function ownership is postgres because the preflight requires that role.
revoke all on function public.trainer_dashboard_batches() from public, anon, authenticated, service_role;
revoke all on function public.trainer_student_roster() from public, anon, authenticated, service_role;
grant execute on function public.trainer_dashboard_batches() to authenticated;
grant execute on function public.trainer_student_roster() to authenticated;

-- Abort if custom default grants or inherited roles contradict the intended ACL.
do $$
begin
  if exists (
    select 1 from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid in ('public.trainer_dashboard_batches()'::regprocedure,
                    'public.trainer_student_roster()'::regprocedure)
      and a.privilege_type = 'EXECUTE'
      and a.grantee not in (p.proowner, 'authenticated'::regrole)
  ) or has_function_privilege('anon', 'public.trainer_dashboard_batches()', 'EXECUTE')
    or has_function_privilege('anon', 'public.trainer_student_roster()', 'EXECUTE') then
    raise exception 'Unexpected EXECUTE privilege remains. Transaction cancelled; inspect inherited/default grants.';
  end if;
end $$;

-- Next.js must still check verified user + current role/is_active on every page/action.
-- This proposal does not configure signups, invitations, SMTP, or server credentials.
commit;
