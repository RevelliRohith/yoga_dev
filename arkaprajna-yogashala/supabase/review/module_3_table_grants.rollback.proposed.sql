-- REVIEW ONLY. NOT EXECUTED. Requires separate explicit approval.
-- WARNING: restores the supplied baseline's unnecessary API-role SQL capabilities.
-- It re-grants TRUNCATE, REFERENCES, and TRIGGER; it is not a recommended steady state.
-- This is NOT part of the trainer-access rollback and must not be run automatically.
-- No rows, existing triggers, constraints, CRUD grants, or RLS policies are changed.
begin;
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Use the postgres role for this separately reviewed grant rollback.';
  end if;
end $$;

grant truncate, references, trigger
on table public.profiles, public.programs, public.batches, public.students
to anon, authenticated;

commit;
