# Stage 3B post-migration verification report

Date: 22 October 2026. Status: Stage 3B verification completed for the current scope: metadata, anonymous API, and user-reported administrator page checks PASSED. Trainer-session cases are deferred to onboarding; production mutation execution was not tested. Stage 3C has not started.

## Evidence and saved artifacts

The user reports manually executing the complete approved trainer-access migration in project ogzdhmptzeyinhgxcgii as postgres, with Success / No rows returned. The agent did not execute or rerun migrations or rollback.

The supplied after export was read in full from C:/Users/My Files/Downloads/jyy.txt. It was a Markdown table with an additional backslash-escaping layer. Extraction removed the table wrapper and reversed that presentation escaping layer; it did not invent metadata. The original source and saved before snapshot remain unchanged. Literal line-break escape differences in the old export were normalized in memory only for comparison.

- Before: supabase/review/baselines/module_3_before_migration.json; captured 2026-10-22T06:44:37Z (12:14:37 IST).
- After: supabase/review/baselines/module_3_after_migration.json; captured 2026-10-22T07:27:21Z (12:57:21 IST).
- Both exports report database postgres and execution role postgres; expected project label ogzdhmptzeyinhgxcgii matches the configured app host. The embedded label alone is not independent proof of database origin.
- Detailed machine-readable checks and hashes: module_3_after_migration.validation.json in the same ignored directory.
- Both snapshots and validation reports are Git-ignored. Keep a private encrypted backup. Git-ignore is not encryption or an access-control guarantee.

## Confirmed metadata results

All 44 checks passed. No unexpected database differences were found within the captured metadata.

| Object group | Result |
| --- | --- |
| Four tables | Same identifiers, owners, ACLs, RLS enabled and FORCE RLS settings |
| 41 columns | Same types, defaults, nullability and order |
| Four captured roles | Same attributes; anon/authenticated do not bypass RLS |
| Eight effective grant records | Unchanged; CRUD true and TRUNCATE/TRIGGER/column REFERENCES false |
| Eight original policies | Preserved, including all four admin ALL policies and WITH CHECK predicates |
| Two new policies | Exactly the approved restrictive authenticated SELECT policies on programs and students, requiring is_admin() |
| is_admin | Unchanged body, OID, owner, ACL and settings |
| is_trainer | Same OID, owner, grants and settings; body matches approved active-status check |
| Two trainer RPCs | Exact approved SQL bodies and return types; no input user-ID arguments |
| 14 constraints | Same OIDs/definitions and validation state, including Auth FK and batch/student relationships |
| 18 triggers | Same OIDs/definitions/enabled states; all are internal FK triggers |

The changed is_trainer requires auth.uid() to match a profiles row with role = trainer AND is_active = true. Existing assigned-batch RLS depends on that helper and trainer_id = auth.uid(). Inactive trainers therefore no longer satisfy that policy. This does not itself stop password sign-in; later trainer application guards are still required.

Both new restrictive policies require admin authorization, so existing authenticated trainer SELECT policies cannot expose full students/programs rows. Admin SELECT passes these restrictions; existing admin INSERT/UPDATE/DELETE policies and effective CRUD grants are unchanged. This confirms administrator access is preserved by the captured policy design, not a live administrator session test.

The roster return type is exactly id uuid, student_code text, full_name text, program_id uuid, batch_id uuid, status text. Its body joins assigned batches and requires the current UUID, active trainer role and assignment. It exposes no contact, guardian, DOB, address or fee fields. The batch RPC includes the approved batch/schedule fields and program name without monthly fees. Both bodies match the approved proposal ignoring whitespace/case.

Both RPCs are postgres-owned, STABLE SECURITY DEFINER with empty search_path, qualified references and explicit authorization checks. ACLs contain only postgres and authenticated EXECUTE; effective anon EXECUTE is false and authenticated true. Original helper grants remain unchanged.

This comparison covers the supplied snapshot's fields. Fresh detailed ACL-source/role-membership queries and current alternate-object inventory were not run through an authenticated database connection. Previously reviewed alternate-path findings are historical and not a new global audit.

## Runtime and application checks

The latest completed local application checks from the preceding verification turn remain: TypeScript PASS, ESLint PASS, 23/23 regression tests PASS, production build PASS. No application code changed during this snapshot comparison, so these checks were not repeated unnecessarily. These are local tests, not live database CRUD proof.

The earlier anonymous status 0 was diagnosed: DNS resolves the Supabase host, while a direct HTTPS request from the restricted shell fails with nested cause EACCES. This is transport blocking, not an HTTP authorization response. The exact prepared anonymous verification command was then run outside that sandbox through the supported reviewed escalation workflow, without changing TLS, certificates, proxy settings, or application configuration. It completed successfully against ogzdhmptzeyinhgxcgii.supabase.co: profiles/programs/batches/students count requests each exposed zero rows, and both trainer RPCs returned 401/403 with PostgreSQL code 42501. All six anonymous checks PASSED. Only public credentials were used; no account or application rows changed.

Local HTTP checks without session cookies: /admin/login returned 200; /admin, /admin/programs, /admin/batches, /admin/programs/new, and /admin/batches/new each returned 307 redirecting to /admin/login. This verifies unauthenticated route protection, not successful admin access.

The existing saveProgram/saveBatch server actions were inspected: both requireAdmin before validation/database work. There is no hard-delete action in the current Programs/Batches UI; it uses activation/deactivation. Captured database admin ALL policies and effective INSERT/SELECT/UPDATE/DELETE grants remain intact. No production writes, deletes, no-op updates, or temporary records were issued. Successful real create/update/delete operations have not been claimed.

The user has been asked to sign in using the existing admin at localhost:3000/admin/login, check Dashboard/Programs/Batches and refresh, then open existing edit forms and cancel without saving. The user subsequently reported Dashboard: Passed, Programs: Passed, Batches: Passed, and confirmed no records were modified. These are user-reported results for the requested administrator checklist, not agent-observed browser sessions. No credentials were shared.

## Outstanding verification

- Live anonymous API denial: PASSED through the working unsandboxed connection; earlier sandbox transport limitation explained above.
- Administrator page checklist: PASSED per user report for Dashboard, Programs and Batches; no records modified. Database grants/policies confirm expected CRUD authorization. Actual create/update/delete execution remains deliberately untested on production records; no claim of successful write/delete transactions is made.
- Active trainer A/B assigned-batch and six-field roster access, inactive trainer denial, cross-trainer isolation and excluded-column probes: pending; no trainer accounts exist. Do not create or deactivate accounts implicitly for testing.
- Fresh execution of module_3_verify_security_readonly.sql for effective memberships and detailed ACL sources: not performed; the metadata comparison above uses the actual exported snapshot.

The prepared SQL session template uses existing identities only and has a UUID placeholder; do not execute it as-is. It is supplementary to real JWT/session tests.

## Completion boundary

The after snapshot is saved; metadata, anonymous API checks and the user-reported administrator checklist pass. Stage 3B is complete for the current agreed scope, with trainer-session cases explicitly deferred to onboarding when separately authorized accounts are available. Production writes/deletes and fresh detailed SQL membership queries were not executed; those limits remain documented above. No migration rerun, rollback or account creation occurred. Stage 3C requires separate explicit approval and has not begun.
