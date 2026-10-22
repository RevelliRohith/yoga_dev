-- HISTORICAL PROPOSAL. User confirmed these fields were successfully applied.
-- RETAINED FOR REFERENCE ONLY. DO NOT RERUN for Module 3 implementation.
-- This file lives outside supabase/migrations so a migration push will not pick it up.
-- Adds trainer display/status fields to the existing profiles table only.
-- Does not touch auth.users, existing role values, RLS, or batch assignments.
begin;

alter table public.profiles
  add column if not exists specialization text,
  add column if not exists qualifications text,
  add column if not exists biography text,
  add column if not exists years_of_experience integer,
  add column if not exists is_active boolean not null default true,
  add column if not exists photo_path text;

-- Fail rather than silently accepting a conflicting pre-existing column contract.
do $$
begin
  if exists (
    select 1
    from (values
      ('specialization', 'text'), ('qualifications', 'text'),
      ('biography', 'text'), ('years_of_experience', 'integer'),
      ('is_active', 'boolean'), ('photo_path', 'text')
    ) as expected(column_name, data_type)
    left join information_schema.columns actual
      on actual.table_schema = 'public' and actual.table_name = 'profiles'
      and actual.column_name = expected.column_name
    where actual.data_type is distinct from expected.data_type
  ) then
    raise exception 'Trainer column types differ from the reviewed proposal. Transaction cancelled.';
  end if;

  if exists(select 1 from public.profiles where is_active is null) then
    raise exception 'Existing NULL status values require a separate review. Transaction cancelled.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_years_of_experience_range'
  ) then
    alter table public.profiles
      add constraint profiles_years_of_experience_range
      check (years_of_experience is null or years_of_experience between 0 and 100);
  end if;
end $$;

-- Existing profiles (including the administrator) retain active status.
-- No foreign key or trigger is added here: Auth-link verification comes first.
-- No Storage bucket/policies are created. photo_path is an optional future private object path.
commit;
