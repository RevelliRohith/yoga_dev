# Module 3 security proposal: final review

> For the combined grant-hardening/trainer-access execution order, added pre/postconditions, verification templates, and rollback sequence, see `MODULE_3_EXECUTION_REVIEW.md`. Hardening is also approved in principle only; no SQL execution is approved or performed.

Status: the user approved the six-field roster and the principle of blocking inactive trainers. SQL execution, onboarding implementation/accounts, and changes to Auth configuration are NOT approved. No database changes have been executed. The profile-field migration remains already applied and must not be rerun.

This review uses the user's supplied catalog results and inspected application source. SQL was statically reviewed, not executed or live-tested. This is a bounded review of the four known tables/helpers; alternate views/RPCs still need inspection.

## 1. Administrator CRUD preservation

The existing admin ALL policies remain unchanged on profiles, programs, batches, and students. Existing SELECT/INSERT/UPDATE/DELETE grants also remain unchanged. For an authenticated account whose profile has role admin, `is_admin()` is true, so both the original permissive ALL policy and the new restrictive SELECT condition pass. This includes SELECT visibility needed by UPDATE/DELETE filters, INSERT RETURNING, and the current upsert-style authorization paths. Profiles/batches get no new restrictive policy; `is_admin()` and the administrator account are not changed.

Therefore these changes preserve the existing administrator CRUD access shown in the supplied policies. Existing constraints/triggers or unreviewed policies could independently affect operations; live regression tests are still needed. The separately proposed grant hardening removes only TRUNCATE, REFERENCES, and TRIGGER, not normal CRUD or existing database triggers/foreign keys.

The two new trainer-only RPCs deliberately return no rows for admin-only profiles. Admin pages continue using normal authenticated table queries; this does not remove any existing admin CRUD capability.

## 2. Assigned batches

The existing `Trainers view assigned batches` policy is preserved. Active trainers still pass `is_trainer()` and must satisfy `trainer_id = auth.uid()`. They can read their assigned batches directly and through the new `trainer_dashboard_batches()` RPC. The latter adds the associated program name without returning monthly_fee.

Inactive trainers will fail `is_trainer()` on subsequent database statements. Existing sessions are not deleted or invalidated; authorization changes, not password-login validity. A statement already executing uses its transaction snapshot, and cached browser information cannot be retroactively erased. Application guards will also check active status on every protected page/action. Existing assignments are retained, including assignments to inactive trainers/batches; the proposal does not silently reassign or delete them.

## 3. Student privacy and alternate paths

| Path | Expected behavior after the proposed SQL |
| --- | --- |
| Trainer direct SELECT of students/programs | No rows, because restrictive admin-only SELECT conditions fail |
| Direct invoker-context join involving those base tables | Same RLS conditions apply; no private rows returned |
| `trainer_student_roster()` | Only own assigned students and six fixed fields: id, student_code, full_name, program_id, batch_id, status |
| Asking the new roster RPC for excluded columns | Those columns are absent from its return type |
| `trainer_dashboard_batches()` | Own assigned schedules and program name; no fee/contact columns |
| Caller-rights (`security_invoker`) view | Underlying caller RLS applies |
| Existing owner-rights view, materialized view, or other privileged RPC | Cannot certify without inspecting definitions, grants, and called routines |

DOB, gender, mobile, email, guardian contacts, address, joining_date, and created_at are not in the approved roster. No financial columns or trainer contacts are included. Future table columns will not automatically appear in the fixed RPC return type. Joins inside an unreviewed privileged RPC/view can bypass base-table RLS and are a separate access path.

Run the new read-only `supabase/review/module_3_alternate_paths_readonly.sql` before declaring all private-column paths closed. It inventories public views/materialized views, all public functions including wrappers, and table triggers. Confirm the configured Data API exposed-schema list; inspect any additional exposed application schemas too. Any unsafe alternate path requires its own explained proposal and approval. The new migration does not silently change unrelated views/RPCs.

## 4. SECURITY DEFINER boundaries

- Execution is deliberately elevated to postgres to read narrow fields behind the restrictive base-table policies. This bypass is intentional; RLS alone is not the RPC's authorization boundary.
- Both RPCs use `SET search_path = ''`, schema-qualified relations/helpers, and qualified text casts. They contain static SELECT statements only.
- Both derive identity from `auth.uid()`; neither accepts a trainer/user ID argument. They require `is_trainer()`, verify the matching profile has trainer role and active status directly, and restrict batches by the same Auth UUID. No role comes from metadata or client-supplied form values.
- New RPC EXECUTE is revoked from PUBLIC, anon, authenticated, and service_role, then granted to authenticated only. The owner retains ownership rights. A final assertion rejects unexpected explicit/default grants and effective anonymous execution, including inheritance. Authenticated callers still need to pass the internal role/active/assignment checks.
- Existing role-helper owners/ACLs are preserved by CREATE OR REPLACE. The supplied is_admin definition remains unchanged.

These safeguards apply to the proposed functions, not automatically to every pre-existing SECURITY DEFINER function in the database. Privileged credentials and table owners remain trusted operators.

## 5. Effect of is_trainer change

Every caller now requires an active trainer profile. The supplied policies for assigned batches, active programs, and assigned students all reference this helper. Active batch reads continue working; inactive trainer reads stop. Direct programs/students reads are further intentionally blocked for all non-admins and must move to the safe RPCs in the new dashboard. Coordinate that deployment to avoid breaking any existing trainer consumer that queries those tables directly.

No Auth signup, password, user ID, invitation, or session cookie is changed. Current admin sign-in verifies role using the application helper and does not call is_trainer; admin policies use is_admin. The new trainer login/dashboard must enforce role and is_active separately, because Supabase password authentication does not automatically deny an inactive application profile. Existing unknown functions/views/policies that call is_trainer must be inventoried before rollout.

## 6. Rerun, failure, and rollback

`module_3_trainer_access.proposed.sql` is a guarded ONE-TIME migration, not an idempotent reconciler. It checks the supplied helper definition/configuration and aborts if its RPCs/policies already exist. Running it a second time rejects before making changes. It never overwrites an unknown same-named RPC or unrelated helper body. This is intentional; silently dropping/recreating policies or unknown routines during retries would be riskier.

All changes are in one transaction. An error aborts it; issue ROLLBACK if the SQL client leaves an aborted transaction open. Before COMMIT, ROLLBACK discards all changes. After a successful COMMIT, ROLLBACK alone cannot undo it.

For a post-commit undo, `module_3_trainer_access.rollback.proposed.sql` is a separately reviewable transaction. It validates ownership markers and the expected helper body, removes only proposal-owned policies/RPCs, and restores the supplied role-only is_trainer body while retaining its owner/ACLs. There is no CASCADE; unexpected dependencies abort the rollback. A repeated rollback tolerates already-absent owned objects and the original helper body. Review definitions for drift and disable the new RPC-dependent trainer UI before rollback. No accounts or rows are deleted.

WARNING: restoring the old helper/policies also restores the known inactive-trainer/private-column exposure. Post-commit rollback is operational recovery, not the preferred security state. It requires explicit approval.

The separate table-grant hardening proposal is normally repeatable: REVOKE of an already absent grant is harmless; its effective-privilege assertions still run and abort if inherited/column grants remain. Its separate `module_3_table_grants.rollback.proposed.sql` restores only the three supplied baseline grants, intentionally reintroducing those capabilities. It is not automatically bundled with trainer-access rollback. Default privileges for future tables remain outside this scope.

## Approval and verification still required

No application code or account creation was implemented in this review. Both apply proposals and both rollback proposals remain unexecuted. Execute nothing solely because the roster/active-status principles were approved.

Before deployment, inspect alternate access paths and test with existing authorized test identities (or separately approved test accounts): admin CRUD on all four tables, active trainer own versus another trainer's batches/roster, anonymous calls, inactive trainer with a previously issued session, direct private-column queries/joins, and rollback/dependency behavior in a disposable/staging database. No destructive TRUNCATE test is needed. Current working Programs/Batches/admin login/logout should be regression-tested. No live SQL execution/test claim is made here.

Sources: [PostgreSQL policy composition](https://www.postgresql.org/docs/current/sql-createpolicy.html), [function replacement and definer security](https://www.postgresql.org/docs/current/sql-createfunction.html), [view security](https://www.postgresql.org/docs/current/sql-createview.html).
