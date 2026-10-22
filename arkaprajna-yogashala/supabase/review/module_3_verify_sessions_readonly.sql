-- FUTURE MANUAL VERIFICATION TEMPLATE ONLY. Not executed by the agent.
-- Run AFTER an explicitly approved trainer-access change, preferably in staging.
-- Uses existing identities only; no accounts, status updates, or table writes.
-- Replace the ONE UUID placeholder with an existing user's Auth UUID.
-- Repeat with admin, active trainer A, active trainer B, and an existing inactive
-- trainer. If an identity does not exist, that case remains untested; do not create
-- or deactivate anyone solely to run this template without separate approval.
-- SQL Editor impersonation tests database authorization, NOT password/JWT validation.
begin read only;

do $identity$
declare
  test_user constant uuid := 'REPLACE_WITH_EXISTING_AUTH_USER_UUID';
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', test_user::pg_catalog.text, true);
  perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
  perform pg_catalog.set_config('request.jwt.claims',
    pg_catalog.json_build_object('sub', test_user, 'role', 'authenticated')::pg_catalog.text, true);
end $identity$;
set local role authenticated;

-- One result grid. Interpret by the selected identity, using the runbook matrix.
-- Admin: real base-table counts. Trainers: zero direct students/programs.
-- Active trainer: own batches/RPC results only. Inactive trainer: none.
-- roster_rows_outside_assigned_batches must always be zero.
select public.is_admin() as caller_is_admin,
       public.is_trainer() as caller_is_active_trainer,
       (select count(*) from public.students) as direct_student_rows,
       (select count(*) from public.programs) as direct_program_rows,
       (select count(*) from public.batches) as visible_batch_rows,
       (select count(*) from public.batches where trainer_id is distinct from (select auth.uid())) as other_trainer_batch_rows,
       (select count(*) from public.trainer_dashboard_batches()) as rpc_batch_rows,
       (select count(*) from public.trainer_student_roster()) as rpc_roster_rows,
       (select count(*) from public.trainer_student_roster() r
        where not exists(select 1 from public.trainer_dashboard_batches() b where b.id = r.batch_id)) as roster_rows_outside_assigned_batches;

-- No names, contact details, keys, tokens, or private column values are printed.
rollback;

-- Separate anonymous read-only test. No trainer RPC invocation should be allowed.
begin read only;
do $anonymous$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  perform pg_catalog.set_config('request.jwt.claim.role', 'anon', true);
  perform pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
end $anonymous$;
set local role anon;

select (select count(*) from public.profiles) as profile_rows,
       (select count(*) from public.programs) as program_rows,
       (select count(*) from public.batches) as batch_rows,
       (select count(*) from public.students) as student_rows,
       has_function_privilege(current_user, 'public.trainer_dashboard_batches()', 'EXECUTE') as can_execute_batch_rpc,
       has_function_privilege(current_user, 'public.trainer_student_roster()', 'EXECUTE') as can_execute_roster_rpc;
-- Expect all row counts zero and both EXECUTE checks false.
rollback;
