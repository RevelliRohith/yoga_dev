# Module 3: combined SQL review and proposed runbook

> Current stage update: the user has confirmed grant hardening was applied, effective privilege checks passed, and Admin/Programs/Batches still load. Do not rerun that completed migration. The GraphQL inspection also completed: pg_graphql is absent and the exposed wrapper is an invoker error-only placeholder. The historical approval/order notes below are superseded by `MODULE_3_STAGE_3A.md` for the current next step. Trainer-access execution and account creation remain unapproved.

**Approval status:** roster fields, inactive-trainer blocking, and grant hardening are approved in principle only. Database execution, migrations, permission changes, Auth configuration, and account creation remain unapproved. None of the SQL in this runbook has been executed by the agent. All steps below are a future sequence for separate explicit approval, not an instruction to run them now.

## Combined findings

| Requirement | Finding from source and supplied schema/policies |
| --- | --- |
| Existing admin CRUD | Preserved by design. SELECT/INSERT/UPDATE/DELETE grants and all existing admin ALL policies remain. Admin passes both the existing permissive policies and new restrictive SELECT rules, including SELECT visibility used by updates/deletes/RETURNING. is_admin, Auth identity, and admin session flow are unchanged. Live regression testing is still required. |
| Programs/Batches | Current queries and actions use the admin session/RLS and CRUD, not SQL TRUNCATE, REFERENCES, or TRIGGER capabilities. Name lookups, counts, inserts, conditional updates, and assignment reads retain their access. The SQL does not add an active-trainer assignment rule to the current application; that remains a later application change. |
| Trainer isolation | is_trainer additionally requires is_active=true. The existing own-assignment batch policy remains. Both proposed RPCs also check current user, trainer role, active status, and assignment internally. No caller-supplied trainer ID is accepted. Inactive sessions may still authenticate to Auth, but fail database authorization; future trainer pages/actions also need active-status guards. |
| Student privacy | New restrictive policies deny non-admin direct student/program rows. Ordinary caller-context joins inherit this restriction. The proposed roster has only the approved six columns. Excluded private columns do not exist in the RPC return type. Existing owner-rights views, cached materialized views, and other privileged RPCs remain an unresolved alternate-path review, not an automatic guarantee. |
| Unnecessary grants | Direct TRUNCATE, REFERENCES, and TRIGGER grants are revoked from anon/authenticated. Effective checks include immediately inherited/PUBLIC and column-level REFERENCES privileges. If an unwanted capability remains, the transaction aborts: it does NOT silently revoke privileges from parent roles or alter role memberships. Such a source needs separate targeted approval. |
| Definer functions | Empty search_path, qualified references/casts, static SELECTs, fixed result types, active-role/assignment checks, postgres ownership, and explicit new-RPC EXECUTE grants. Anonymous effective access and unexpected ACL entries abort the transaction. Elevated reads are intentional and bounded by function code; unrelated definer routines still need review. |
| Records/FKs/triggers | No application-row DML, Auth writes, table drops, FK replacement, trigger replacement, or trigger disabling occurs. Revoking REFERENCES/TRIGGER creation privileges does not remove existing constraints/triggers or stop their normal operation. Existing profile fields are not migrated again. |

### Corrections included in the proposals

`module_3_table_grants.proposed.sql` now has executor/RLS/table guards, checks that ordinary API roles cannot bypass RLS through their own attributes or usable table-owner membership, and asserts CRUD privileges match the supplied baseline both before and after revocation. It never automatically re-grants missing CRUD rights or changes inherited role grants. REVOKE uses the default dependency-preserving behavior, not CASCADE.

`module_3_trainer_access.proposed.sql` now requires effective grant hardening to have passed before it proceeds. It checks role-helper configuration/body and the postgres definer-read assumptions; it never changes FORCE RLS or ownership to bypass a failed check. The owner/RLS and helper preconditions, narrow function bodies, explicit ACL postconditions, and guarded rollback remain in place. This proposal is a one-time migration; a rerun intentionally rejects before changes rather than overwriting names or silently reconciling unknown objects.

No automatic change to future-table default privileges, existing views, unrelated RPCs, API exposed schemas, or public signup configuration is included.

## Proposed execution order — only after explicit approval

### 0. Baseline and remaining security review

1. Save current definitions/grants before any change using `supabase/review/module_3_verify_security_readonly.sql`. It returns metadata, not private rows. Save all numbered result grids; run a numbered SELECT separately if the editor only displays its last result.
2. Run `module_3_alternate_paths_readonly.sql` and review accessible views/materialized views, routines including wrappers, and triggers. Confirm all configured Data API exposed application schemas, not just public. Any other privileged path exposing private fields must be addressed with its own reviewed SQL before enabling trainer access.
3. Capture a schema backup of the reviewed objects. Confirm there are existing, authorized staging/test identities for admin, active trainers A/B, and inactive trainer. Do not create accounts or change real statuses without separate approval. Empty datasets alone cannot demonstrate cross-trainer isolation.
4. Check for existing trainer consumers that query students/programs directly. They must move to the narrow RPCs as part of a coordinated application rollout. No trainer dashboard implementation has been deployed by this review.

### 1. Grant hardening

Execute only the explicitly approved `module_3_table_grants.proposed.sql`, as postgres. It is its own atomic transaction. If any pre/postcondition fails, stop and ROLLBACK an open aborted transaction; investigate the actual grant source. Do not edit the script to skip checks or revoke broad parent-role privileges casually.

Run the metadata verification file again. Expected: eight role/table rows; CRUD true throughout; TRUNCATE, TRIGGER, and REFERENCES false throughout; API role superuser/BYPASSRLS false; no usable API table-owner rights. Policies, helper definitions, FK definitions/OIDs, and trigger definitions/OIDs/enabled flags remain the baseline. Confirm the admin can still load Programs and Batches. Existing child-table FK inserts must work because runtime FK enforcement does not require the caller to have FK-creation privilege.

### 2. Trainer-access restriction and narrow RPCs

After step 1 verification and separate approval, execute `module_3_trainer_access.proposed.sql`. This is a second atomic transaction; both files together are not a single transaction. It replaces only the reviewed is_trainer body, adds two restrictive policies, and adds the two narrow RPCs. Existing policies are not removed.

If step 2 fails, its changes roll back, while committed step 1 remains in effect. Do not undo grant hardening automatically: it does not prevent ordinary admin CRUD and remains an independent improvement.

Run metadata verification again. Expected: all old policies plus the two restrictive authenticated SELECT rules; is_admin definition/grants unchanged; is_trainer includes active status; both new RPCs postgres-owned SECURITY DEFINER with empty search_path, anonymous EXECUTE false and authenticated EXECUTE true; the roster return type contains exactly the six approved fields; no changes to original FK/trigger definitions or OIDs. The new routine/policy comments identify proposal-owned objects for rollback.

### 3. Authorization and application verification

The review-only `module_3_verify_sessions_readonly.sql` contains two read-only test transactions. Substitute one existing Auth UUID in its identity block and run the entire block from BEGIN through ROLLBACK together; do not execute the test SELECTs alone as postgres. Repeat for each test identity. The second block tests anon. No real JWT/password is needed or printed: privileged SQL Editor session-claim simulation tests database authorization, NOT real HTTP authentication. If only one result grid is shown, run the identity and anonymous blocks separately.

| Identity | Direct programs/students | Direct batches | New RPCs |
| --- | --- | --- | --- |
| Admin | Existing visible records | All permitted admin records | No rows for admin-only role; admin CRUD uses base tables |
| Active trainer A | Zero rows | A's assignments only | A's assigned schedules and six-field roster only |
| Active trainer B | Zero rows | B's assignments only | B's assigned schedules and six-field roster only |
| Inactive trainer with existing session | Zero rows | Zero rows | Zero rows |
| Anonymous | Zero rows on all four base tables | Zero rows | No EXECUTE privilege |

`other_trainer_batch_rows` must be zero for trainers and `roster_rows_outside_assigned_batches` must always be zero. Independently compare each populated trainer result to known assignments; count-only checks alone do not prove every returned row is correct. Inspect RPC result metadata for the fixed allowlist; an excluded field such as email must not be selectable from the new roster return type. Test direct base-table access and actual Supabase HTTP/JWT behavior as well. Do not share names, contact details, session tokens, or keys in diagnostics.

Metadata and read-only tests cannot prove INSERT/UPDATE/DELETE regression behavior. On an approved staging copy or with separately authorized disposable records, test Programs create/edit/active filtering, Batch create/edit/valid references/assignment/unassignment, admin profile CRUD, FK enforcement, normal existing-trigger behavior, and login/logout/session refresh. Do not insert/delete live test records or execute a destructive TRUNCATE merely to test privileges. No such live CRUD tests have been performed in this review.

## Rollback plan

- **Before COMMIT / on transaction error:** ROLLBACK that transaction. No partial changes from that transaction persist. Ensure the SQL client has exited any aborted transaction before retrying anything.
- **After grant hardening only:** it can remain in place if trainer-access work is delayed or fails. It has not changed admin CRUD/RLS or existing constraints/triggers.
- **After trainer-access commit:** stop/disable new RPC-dependent trainer functionality, review current definitions for drift, and obtain explicit approval for `module_3_trainer_access.rollback.proposed.sql`. It validates markers/helper body, drops only proposal-owned objects without CASCADE, and restores the supplied is_trainer baseline. Any unexpected dependency aborts the entire rollback. This restores weaker inactive-trainer/private-column behavior, so it is operational recovery, not the preferred security state. Grant hardening remains intact.
- **If full baseline restoration is separately required:** reverse the application order: trainer-access rollback first, then the separately approved `module_3_table_grants.rollback.proposed.sql`. The latter restores only the three known original grants, reintroducing those capabilities. It is not an automatic fallback for an application error and does not undo unrelated permission changes.
- Repeat metadata verification against saved baseline and confirm application behavior. No accounts, records, FKs, or original triggers are deleted by either rollback. The grant rollback does not restore unknown inherited/default grants because the forward script never changed them.

## Review limitations and current boundary

### Subsequent alternate-path results

The user reports no public application views/materialized views, no non-internal triggers on the four application tables, and only the two already-reviewed role helpers among public functions. Data API exposed schemas are public and graphql_public; extensions and vault are not exposed. Vault decrypted_secrets SELECT is false for both API roles. This closes the reported public application-view/trigger paths and identifies no additional public function bypass.

Both API roles can SELECT extensions.pg_stat_statements and pg_stat_statements_info. Non-exposure prevents a straightforward REST table request to that schema, but is not equivalent to revoking SQL privileges. Query statistics deserve least-privilege review: statement text can contain sensitive literals, and other SQL/GraphQL reflection paths must not make these views reachable. The fact that extensions is not REST-exposed alone is not a complete GraphQL exposure test.

Supabase documents that pg_graphql respects caller PostgreSQL permissions and RLS, and can reflect database functions. Therefore GraphQL is not inherently a bypass of the proposed restrictive policies. With authenticated table SELECT retained for admin functionality, private column names/types may remain in a trainer-visible GraphQL schema even though the trainer gets zero base-table rows. Disabling introspection or hiding a field is not an authorization substitute. Relationships/joins and reflected functions need the same caller-context checks as REST.

The public-only function inventory did not inspect the separately exposed graphql_public entry point. A focused, metadata-only follow-up is prepared in `module_3_graphql_readonly.sql`: extension version, graphql_public wrapper/engine definitions and execution context, schema privileges, reported-view directives, and only non-secret persisted API/search-path configuration. Nothing from Vault or query-statistics rows is read. Review the actual wrapper/callee path and GraphQL reflection configuration before certifying that the broader statistics SELECT grants are unreachable. Any custom wrapper running as a privileged owner is a blocker until separately reviewed. Missing persisted settings do not prove what the live API uses.

Remaining gates are that focused GraphQL metadata review, actual post-approval REST/GraphQL identity tests (anonymous, active trainers, inactive trainers, admin), and explicit SQL-execution approval. No additional database modifications are automatically authorized by these findings. Public signup remains enabled per the earlier settings probe and still requires a separate invitation-only onboarding configuration decision before account creation is implemented.

References: [Supabase GraphQL security](https://supabase.com/docs/guides/graphql/security), [GraphQL functions](https://supabase.com/docs/guides/graphql/functions), [configuration](https://supabase.com/docs/guides/graphql/configuration).

Only review SQL/docs were changed. SQL has not been executed or database-tested, no permissions have changed, no profiles/accounts were provisioned, and no existing application code was altered. The six-field roster and hardening principles are accepted, but execution still needs explicit approval. Existing alternate view/RPC access is not yet certified; that remains a release gate for the privacy claim.

Sources: [PostgreSQL privileges](https://www.postgresql.org/docs/current/ddl-priv.html), [policy composition](https://www.postgresql.org/docs/current/sql-createpolicy.html), [definer functions](https://www.postgresql.org/docs/current/sql-createfunction.html), [view security](https://www.postgresql.org/docs/current/sql-createview.html).
