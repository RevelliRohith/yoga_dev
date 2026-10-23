# Stage 3B preparation and guided verification

CURRENT UPDATE: The user reports manually executing the complete approved trainer-access migration successfully in project ogzdhmptzeyinhgxcgii as postgres. Treat execution as completed; DO NOT rerun any migration or rollback. Post-migration results have not yet been supplied. First run module_3_capture_baseline_readonly.sql to capture current metadata and provide the full export; preserve the before file. Earlier execution instructions below are historical, not instructions to apply again. Active/inactive/cross-trainer sessions remain pending because no trainer accounts exist.

Status: preparation only. No trainer-access SQL, account creation, or Auth settings changes have been executed. Grant hardening and trainer profile fields are already completed; do not rerun them. No trainer accounts currently exist.

Baseline now saved and validated: `supabase/review/baselines/module_3_before_migration.json`, supplied from the user's Downloads export. Capture timestamp: `2026-10-22T06:44:37Z` (12:14:37 IST on 22 October 2026); database role postgres. Verified 4 tables, 41 columns, 8 policies, 8 effective-grant records, 2 original helpers, 14 validated constraints, 18 internal triggers, and 4 roles. The two proposed RPCs/restrictive policies are absent, grants are hardened, and is_trainer is still role-only. All original JSON values were preserved, including literal escaped line breaks; comparison decoded these escapes only in memory. The adjacent ignored validation report records artifact hashes. The export's project-reference label matches the confirmed local configuration; the label alone cannot independently establish database origin. Read the checklist below as execution guidance; baseline capture is now completed and must not overwrite this saved original.

## Before execution approval

1. Confirm Dashboard project reference `ogzdhmptzeyinhgxcgii`. The local public URL matches `https://ogzdhmptzeyinhgxcgii.supabase.co`; this does not prove which project is open in SQL Editor.
2. Preserve the validated `supabase/review/baselines/module_3_before_migration.json` and its validation report. Keep a private, encrypted backup. The agent saved the supplied export, not a fresh live capture. The embedded project label is not independent project verification.
3. Review the complete `supabase/review/module_3_trainer_access.proposed.sql` and `supabase/review/module_3_trainer_access.rollback.proposed.sql`. Save the reviewed versions with the baseline. Do not bypass baseline guards.
4. Obtain explicit approval to execute ONLY the trainer-access proposal. Preparation approval does not authorize execution. Do not proceed to Stage 3C before results are reviewed.

## Reviewed permission changes

Existing admin policies and CRUD grants remain. Two new restrictive SELECT policies on programs/students permit admins and block direct trainer reads, including private student columns. Existing direct active-trainer access to assigned batches remains. The updated is_trainer helper requires the current profile to be active; it affects all policies already using that helper, but does not disable password authentication itself.

The two new read RPCs use the authenticated UUID, explicit active-trainer and assignment checks, fixed result columns, postgres ownership, SECURITY DEFINER, empty search_path, and qualified references. Only authenticated API callers receive EXECUTE; anonymous callers are denied. Admin and inactive callers receive no trainer RPC rows. The roster exposes only id, student_code, full_name, program_id, batch_id, status.

Supplied inspection found no application views, extra public application RPCs, or non-internal triggers. The exposed graphql_public wrapper is invoker-only and returns an extension-not-enabled error; pg_graphql is absent. No demonstrated alternate student-data path was found. Future GraphQL activation or new views/RPCs require review. This finding is bounded by the inspected objects, not a guarantee for future changes.

No records, Auth users, foreign keys, or triggers are changed by the proposal. Existing grant hardening stays in place. Direct trainer program/student consumers must use the new narrow RPCs after application implementation.

## Exact execution instructions: only after explicit approval

1. Open the confirmed project's SQL Editor, choose the postgres role, and create a new query.
2. Paste the ENTIRE `supabase/review/module_3_trainer_access.proposed.sql`, including BEGIN, guards, and COMMIT. Run it once. Do not run selected fragments or the completed grant-hardening/profile-fields files.
3. On any error, stop and share the error code and safe message. Do not remove guards or retry modified fragments. If an aborted transaction remains open, issue ROLLBACK. A failed transaction does not commit partial changes.
4. On success, run `supabase/review/module_3_verify_security_readonly.sql` and save its metadata results. Run the baseline capture query again and export separately as `module_3_security_after.csv` or `.json`. Never overwrite the before export.

The migration is guarded for one-time application; rerunning intentionally fails rather than replacing unknown objects.

## Post-migration metadata acceptance

- Both API roles retain effective SELECT/INSERT/UPDATE/DELETE on all four tables; TRUNCATE, TRIGGER, and table/column REFERENCES remain false.
- is_admin remains unchanged. is_trainer retains owner/ACL/search_path and adds is_active = true.
- All original policies remain, plus the two named restrictive SELECT policies on programs/students. RLS remains enabled; no ownership or FORCE RLS changes occur.
- Both new RPCs have the reviewed fixed result types, postgres owner, SECURITY DEFINER, empty search_path, authenticated EXECUTE true, and anonymous EXECUTE false, with no unexpected grantees.
- Compare before/after metadata: application column contracts, existing foreign keys, and trigger identifiers/definitions are unchanged. Only the intended helper, two policies, and two RPCs differ.

## Prepared real-session security tests

Run from the existing project directory after the approved migration. These commands use only the configured public key; account passwords are prompted invisibly in an interactive terminal. No account is created, application rows are not written, and sensitive response values are not printed. Syntax and ESLint checks passed; the runner has NOT been executed against Supabase.

```powershell
node scripts/verify-trainer-access.mjs --mode=admin
node scripts/verify-trainer-access.mjs --mode=anonymous
```

Admin: read requests to all four tables succeed; trainer-only RPCs return no rows. Also confirm existing admin login and Programs/Batches lists and counts. Full create/edit/delete regression needs separately agreed disposable test records; read tests alone cannot prove writes.

Anonymous: direct table reads expose zero rows and both RPCs reject execution.

The following cases are prepared but BLOCKED because no trainer accounts exist. Do not create accounts implicitly or mark these tests passed:

```powershell
# Run separately for existing active trainer A and active trainer B.
node scripts/verify-trainer-access.mjs --mode=active-trainer
# Run for an existing inactive trainer.
node scripts/verify-trainer-access.mjs --mode=inactive-trainer
```

Active A/B: each has a distinct assigned batch and test student. Direct batches and batch RPC results stay within that trainer's assignments; roster contains exactly the six allowed fields, all from assigned batches. Direct programs/students and another profile expose zero rows. Selecting email from the roster RPC fails. Repeat for both identities and compare with expected assignments; empty fixtures are INCOMPLETE, not proof of isolation. The runner checks returned rows subject to API result limits; compare with known fixtures rather than treating it as a full database audit.

Inactive: Auth sign-in may succeed, but direct batches/programs/students and both trainer RPCs return zero rows. Own profile may remain readable. No active-trainer functionality should be granted. Later application server guards are still required.

`supabase/review/module_3_verify_sessions_readonly.sql` provides supplementary SQL role/claim simulation with an existing UUID. It does not replace real Auth/JWT tests. No fabricated identities, profile rows, or assignments should be added during this stage.

Without trainers, admin/anonymous and metadata tests can proceed after approval, but Stage 3B cannot be reported fully verified. A separately approved test arrangement is required before completing the trainer cases and proceeding to Stage 3C.

## Rollback plan

Before COMMIT, any guard/error rolls back this transaction; prior grant hardening remains committed. After successful COMMIT, rollback requires separate explicit approval for `module_3_trainer_access.rollback.proposed.sql`. It validates object markers/helper state, drops only this proposal's policies/RPCs without CASCADE, and restores the prior role-only helper. Dependencies cause failure rather than cascading deletion.

Rollback restores the known inactive-trainer/private-column exposure under the old policies, so it must not run automatically. It does not undo grant hardening or change records, foreign keys, triggers, or Auth users. After any approved rollback, repeat metadata comparison and admin checks.
