-- REVIEW ONLY: NOT APPLIED. Requires separate explicit approval.
-- Remove unnecessary SQL capabilities from the two application API roles.
-- Does not execute TRUNCATE, drop tables, remove triggers/FKs, or modify rows.
-- Existing SELECT/INSERT/UPDATE/DELETE grants, RLS, and role helpers are unchanged.
-- Existing postgres/service_role grants are not modified.
-- Proposed execution step 1. Run only after explicit execution approval.
-- Repeatable, with baseline/postcondition assertions; no automatic ancestor-role changes.
begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Use the postgres role for this reviewed grant change.';
  end if;
  if exists(select 1 from pg_roles where rolname in ('anon', 'authenticated') and (rolsuper or rolbypassrls))
     or exists (
       select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
       cross join (values ('anon'::text), ('authenticated'::text)) api_role(role_name)
       where n.nspname = 'public' and c.relkind in ('r', 'p')
         and c.relname in ('profiles', 'programs', 'batches', 'students')
         and pg_has_role(api_role.role_name, c.relowner, 'USAGE')
     ) then
    raise exception 'An API role can bypass owner/RLS restrictions. Stop and review role ownership/membership.';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
        and c.relname in ('profiles', 'programs', 'batches', 'students')
        and c.relrowsecurity) <> 4 then
    raise exception 'Expected RLS-enabled tables are missing or changed. Review before execution.';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'::text), ('authenticated'::text)) api_role(role_name)
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and c.relname in ('profiles', 'programs', 'batches', 'students')
      and not (
        has_table_privilege(api_role.role_name, c.oid, 'SELECT')
        and has_table_privilege(api_role.role_name, c.oid, 'INSERT')
        and has_table_privilege(api_role.role_name, c.oid, 'UPDATE')
        and has_table_privilege(api_role.role_name, c.oid, 'DELETE')
      )
  ) then
    raise exception 'CRUD privileges differ from the supplied baseline. No automatic re-grants are permitted.';
  end if;
end $$;

revoke truncate, references, trigger
on table public.profiles, public.programs, public.batches, public.students
from anon, authenticated;

-- Do not claim success if PUBLIC, inherited roles, or column-level grants still
-- supply a removed privilege. Abort the transaction for a separate review instead.
do $$
begin
  if exists (
    select 1
    from pg_class rel join pg_namespace ns on ns.oid = rel.relnamespace
    cross join (values ('anon'::text), ('authenticated'::text)) api_role(role_name)
    where ns.nspname = 'public' and rel.relkind in ('r', 'p')
      and rel.relname in ('profiles', 'programs', 'batches', 'students')
      and (
        has_table_privilege(api_role.role_name, rel.oid, 'TRUNCATE')
        or has_table_privilege(api_role.role_name, rel.oid, 'TRIGGER')
        or has_table_privilege(api_role.role_name, rel.oid, 'REFERENCES')
        or has_any_column_privilege(api_role.role_name, rel.oid, 'REFERENCES')
      )
  ) then
    raise exception 'An inherited, PUBLIC, or column-level privilege remains. Transaction cancelled; inspect grants before proceeding.';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'::text), ('authenticated'::text)) api_role(role_name)
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and c.relname in ('profiles', 'programs', 'batches', 'students')
      and not (
        has_table_privilege(api_role.role_name, c.oid, 'SELECT')
        and has_table_privilege(api_role.role_name, c.oid, 'INSERT')
        and has_table_privilege(api_role.role_name, c.oid, 'UPDATE')
        and has_table_privilege(api_role.role_name, c.oid, 'DELETE')
      )
  ) then
    raise exception 'CRUD privilege preservation check failed. Transaction cancelled.';
  end if;
end $$;

-- Review output without attempting any destructive operation.
select api_role.role_name, rel.relname as table_name,
       has_table_privilege(api_role.role_name, rel.oid, 'SELECT') as can_select,
       has_table_privilege(api_role.role_name, rel.oid, 'INSERT') as can_insert,
       has_table_privilege(api_role.role_name, rel.oid, 'UPDATE') as can_update,
       has_table_privilege(api_role.role_name, rel.oid, 'DELETE') as can_delete,
       has_table_privilege(api_role.role_name, rel.oid, 'TRUNCATE') as can_truncate,
       has_table_privilege(api_role.role_name, rel.oid, 'TRIGGER') as can_create_trigger,
       has_any_column_privilege(api_role.role_name, rel.oid, 'REFERENCES') as can_reference_columns
from pg_class rel join pg_namespace ns on ns.oid = rel.relnamespace
cross join (values ('anon'::text), ('authenticated'::text)) api_role(role_name)
where ns.nspname = 'public' and rel.relkind in ('r', 'p')
  and rel.relname in ('profiles', 'programs', 'batches', 'students')
order by api_role.role_name, rel.relname;

-- Default privileges for future tables are outside this proposal.
commit;
