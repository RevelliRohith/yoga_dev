# Stage 3A — Trainer-access migration readiness

## Current status

The existing Next.js project and actual trainer-access apply/rollback SQL were inspected. Admin authorization still verifies Auth identity and the profile admin role. Programs/Batches use authenticated-session CRUD and existing admin RLS. No trainer management routes or trainer dashboard are implemented yet; proxy coverage is still `/admin` only. Those application changes belong to later stages.

The user confirms the profile-field and grant-hardening migrations were applied successfully, the unwanted effective API privileges were removed, CRUD grants remain, and existing Admin/Programs/Batches pages load. These are user-reported live results, not new agent-run tests. Do not rerun either completed migration. The grant-hardening file header now records its completed status; its SQL body is unchanged.

The supplied alternate-path inspection found no public application views/materialized views or non-internal application triggers and only the two reviewed public role helpers. Public and graphql_public are exposed; extensions and vault are not. Vault access is denied. pg_graphql is absent, and graphql_public.graphql is an invoker function returning an error only. No additional application/student disclosure path was demonstrated by these results. Broad statistics-view SELECT privileges remain an optional separately scoped least-privilege review, not part of this migration; no working GraphQL resolver or exposed application function was found that queries them.

## Proposal verdict

`supabase/review/module_3_trainer_access.proposed.sql` is ready for explicit execution approval against the supplied baseline. This is static review readiness, not a claim of live SQL parsing or authenticated-user testing. No functional SQL correction is currently required. Its guards will stop if live definitions, ownership, RLS settings, or completed grant-hardening conditions differ; do not bypass them.

The proposal:

- Adds the current profile's active-status requirement to is_trainer, without modifying is_admin or existing helper ownership/ACLs.
- Retains all existing admin policies and CRUD grants. Adds restrictive SELECT policies on programs/students that admins pass and trainers do not. Existing admin list/count/create/update paths remain permitted by design; loading pages alone is not a complete CRUD regression test.
- Retains direct active-trainer access to assigned batches. Inactive trainers fail existing trainer policies; assignments and Auth identities are preserved.
- Provides narrow trainer_dashboard_batches and trainer_student_roster read RPCs. They use current Auth UUID, explicit trainer role/active/assignment checks, no user-ID argument, fixed outputs, empty search_path, qualified references, and controlled EXECUTE grants. The student result is exactly id, student_code, full_name, program_id, batch_id, status.
- Blocks direct trainer reads of full program/student rows, including private contacts and fees. The later trainer UI must use the RPCs; an existing external consumer of direct trainer student/program queries would need adaptation.
- Does not update application rows, delete accounts, change foreign keys, add triggers, rerun profile fields, create uploads, or alter authentication configuration.

## Remaining concerns and later-stage configuration

- Actual REST/session tests still need to confirm active/inactive and cross-trainer isolation after the approved change. SQL Editor role/claim simulation checks database authorization only; it does not prove real Auth/JWT handling. If no existing trainer test identity is available, mark that verification pending and request a separately approved test arrangement; do not create accounts implicitly.
- Supabase password login does not automatically reject an inactive application profile. Later server-side trainer guards must check role and is_active on every protected page/action, and proxy refresh must cover trainer routes. No claim is made that these application features exist now.
- Batch assignment UI/actions currently validate trainer role but not active status. The later admin trainer interface must add active-trainer assignment checks while retaining visibility of existing inactive assignments.
- The earlier Auth settings check showed public signup enabled. Secure onboarding still needs a separately approved configuration decision for invitation-only access, server-only Admin API credentials, canonical site/redirect URLs, invite acceptance/password setup, and email delivery limits. Do not introduce keys or send invitations during this stage. With no Auth creation trigger, the later onboarding process must explicitly create the matching profile from the returned Auth UUID and handle partial failure without deleting/recreating accounts.
- New database functions/views or enabling GraphQL in future require another access review. This bounded inspection is not a permanent guarantee for future objects.

## Exact next steps — after approval only

1. Confirm the intended Supabase project and save current metadata with `module_3_verify_security_readonly.sql`. Keep the trainer-access rollback proposal available. No need to rerun grant hardening.
2. In Supabase SQL Editor as postgres, run the COMPLETE `module_3_trainer_access.proposed.sql` transaction once. This is the next pending migration. Stop on any error; do not remove its guards or proceed to trainer UI work on an unverified database state.
3. Recheck metadata: is_trainer includes active status; old policies remain plus two restrictive SELECT policies; both new RPCs have the expected return types/owner/search_path and grants; admin CRUD grants and original constraints/triggers remain unchanged.
4. Verify actual admin login, Programs/Batches listing/counts, and authorized create/edit operations in an approved testing arrangement. Verify anonymous denial. Test existing active/inactive trainer sessions and cross-trainer isolation against the real API using the published permissions matrix. Use the read-only SQL session template only as supplemental evidence.
5. Report results. Do not label Stage 3B fully verified if any required identity/API check is unavailable or fails. Resolve failures before progressing under the user's strict staged workflow.

## Rollback and rerun

The apply SQL is a guarded one-time migration: a repeated run intentionally aborts rather than replacing unknown objects. A failure within the transaction does not commit partial changes; issue ROLLBACK if the editor leaves an aborted transaction open. Previously committed grant hardening remains intact.

After commit, reversal requires separate explicit approval for `module_3_trainer_access.rollback.proposed.sql`. It validates helper/object identity, drops only the proposal's RPCs/policies without CASCADE, and restores the original helper body. It reopens the known private-column and inactive-trainer gaps, so do not run it automatically or roll back unrelated grant hardening for a trainer UI issue. It does not delete application records or accounts.

## Requested approval

Approve Stage 3B guidance to apply ONLY `supabase/review/module_3_trainer_access.proposed.sql` and verify its result. This approval does not cover account creation, privileged credential setup, Auth/email configuration, or later UI implementation stages. No SQL was executed by the agent during Stage 3A.
