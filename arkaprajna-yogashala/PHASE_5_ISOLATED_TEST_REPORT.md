# Phase 5 isolated PostgreSQL test report

Testing date: 2026-10-22. Production execution: NOT performed or authorized. No production connection, real records, credentials, payments or notifications were used. Razorpay remains disabled.

## Environment and installation

Portable PostgreSQL 17.11 x64 was downloaded from EDB, the binary provider linked from PostgreSQL.org's Windows download page. Source: https://www.enterprisedb.com/download-postgresql-binaries (Windows file ID 1260616). Resolved archive: https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip. Only bin/lib/share archive directories were extracted. No installer, Windows service, system PATH, application configuration or system-wide PostgreSQL setting was changed. No administrator privileges were required. The postgres executable was not Authenticode-signed; the official HTTPS download source was used. The recorded SHA-256 is a local integrity identifier, not independently verified vendor checksum metadata.

The installation, cluster, test-only driver and random local password are under ignored `.next/phase5-postgres` and `.next/sql-review-parser`; never commit or share the password. Database: phase5_disposable, server bound only to 127.0.0.1:55432, SCRAM-SHA-256 authentication. Password was generated locally, never printed or passed on a command line. No production environment files were loaded. Tests pin host, port and database and assert the connected server address/database before use.

The sandbox's pg_ctl startup failed with restricted-token errors 87/3; initdb completed, and launching postgres directly as a hidden ordinary-user process succeeded. This did not require an administrator, service registration, authentication bypass or disabling security software. A preliminary harness run also needed fixes for driver percent placeholders and Python UUID comparisons; those were test-harness issues.

## Synthetic security model

Existing four-table DDL, constraints, policies and helper definitions were reconstructed from saved schema metadata. All application/Auth rows were fictional UUIDs and SYNTHETIC labels. Local anon/authenticated roles are nonsuperuser/non-BYPASSRLS; service_role models BYPASSRLS. Admin, two active trainers and an inactive trainer are fictional local profiles only. No real Supabase accounts were created.

`auth.uid()` reads a session setting as a stub. Tests connect as the local owner, SET ROLE to API roles and supply synthetic identities. PostgreSQL executes real RLS, grants, constraints and SECURITY DEFINER code; the stub does NOT verify JWT signatures, run GoTrue, reproduce PostgREST connection-pool behavior, or exercise cookies/email/storage. Direct SQL access to that stub can impersonate identities; it is never suitable for an application deployment. Tests establish database authorization conditional on a trusted identity, not real Supabase authentication.

## Failure and correction

The original proposal's meaningful first run recorded 20 passed and 10 failed groups, including dependent failures. Root cause: fee_guard_row compared stored generated due_on/due_paise fields in BEFORE UPDATE, where NEW generated values are not yet computed. This blocked legitimate payment ledger-version updates and concessions (SQLSTATE P0001, message Only a reviewed bill adjustment/version change is allowed). Empty-table integrity counts did not detect the defect.

Correction: exclude due_on and due_paise from that BEFORE comparison, while retaining protection of billing_month, base_paise and all other immutable inputs. PostgreSQL owns/recomputes generated fields and table constraints remain enforced. No financial authorization was weakened. The corrected full migration was applied to a freshly recreated disposable database, not patched in production. An initial corrected run passed 30 groups; extended final coverage passed 38. Original failure evidence is preserved separately.

## Final results

**38 passed, 0 failed** test groups. Nine prepared financial integrity violation counts were all zero with synthetic populated data. The complete guarded migration and prepared verification/recovery scripts executed successfully locally.

| Test group | Result |
| --- | --- |
| synthetic baseline setup | PASS |
| complete guarded migration applies | PASS |
| existing columns/policies/helpers/constraints/grants unchanged | PASS |
| five RLS-enabled tables and fourteen checked functions | PASS |
| normal monthly bill and exact 10th due date | PASS |
| partial then complete settlement | PASS |
| overcollection rejected | PASS |
| idempotent payment retry preserves receipt | PASS |
| mismatched payment request rejected | PASS |
| duplicate student-month rejected | PASS |
| explicit future multi-month advance allocation | PASS |
| reasoned concession, replay, paid floor and stale preview | PASS |
| zero bill paid without payment/receipt | PASS |
| audited reversals/refund checks preserve original receipts | PASS |
| normalized duplicate reference and explicit reversed replacement | PASS |
| invalid multi-allocation and explicit transaction rollback are atomic | PASS |
| fractional/nonfinite/negative/out-of-range paise rejected | PASS |
| explicit historical opening bill | PASS |
| program fee changes preserve generated bills and reject stale previews | PASS |
| anonymous financial tables/RPC/sequence isolation | PASS |
| active trainer financial tables/RPC/sequence isolation | PASS |
| other trainer financial tables/RPC/sequence isolation | PASS |
| inactive trainer financial tables/RPC/sequence isolation | PASS |
| admin cannot write financial tables directly | PASS |
| existing trainer assignment, inactive restriction and private student isolation | PASS |
| concurrent READ COMMITTED overcollection protection | PASS |
| concurrent REPEATABLE READ stale snapshot protection | PASS |
| receipt uniqueness and numbering | PASS |
| constraints/index validity, deferred triggers, RLS and exact function grants | PASS |
| 10/11/15/16 boundaries, leap month, reminder dates and no sending | PASS |
| all five write RPCs reject anonymous/active/inactive trainer identities | PASS |
| deferred unallocated-payment rejection, immutable history, FK and append-only audit | PASS |
| simultaneous same-request retries create one payment | PASS |
| existing admin four-table CRUD on rolled-back synthetic fixtures | PASS |
| prepared read-only verification and all financial violation counts zero | PASS |
| recovery quarantine blocks writes and preserves admin reads/history | PASS |
| one-time migration guard rejects reapplication without mutation | PASS |
| India billing date remains independent of session timezone | PASS |

Concurrent READ COMMITTED attempts to collect 70000 paise each against a 100000-paise bill produced one commit and one P0001 rejection, leaving 70000 settled. REPEATABLE READ produced one commit and one SQLSTATE 40001 serialization failure, also leaving 70000 settled. Simultaneous retries sharing a request UUID produced a single 40000-paise payment. Multi-allocation errors and explicit transaction rollback left no partial business records. Receipt gaps on rollback remain expected.

The original four tables' columns, constraints, policies, grants and four helper/RPC definitions were unchanged. Four-table admin CRUD succeeded against rolled-back fictional fixtures. Trainer assignment isolation and the six-field student roster worked; inactive trainer RPCs returned no batches and direct private-student table access remained blocked. New parent-table internal financial FK triggers are expected additions. All financial indexes were valid/ready, constraints validated, deferred integrity triggers present, five RLS read policies present, and only six financial entry points were authenticated-executable before recovery. Anonymous and trainer identities failed all five write entry points.

Recovery quarantine was exercised last: all five write entry points lost authenticated EXECUTE; admin table/balance reads and payment/history rows remained available. The disposable database is intentionally left quarantined. Its AFTER metadata therefore reflects recovery permissions, not the normal post-migration permission state; normal permissions are recorded in the earlier verification output. The migration rerun guard subsequently rejected reapplication.

## Evidence and reproducibility

Tracked harness: scripts/phase5-isolated-test.py. It reads only schema metadata and the local test secret; fresh cluster roles/database are required for bootstrap. Do not point it at Supabase or weaken its pinned connection checks. Run from project root using `python scripts/phase5-isolated-test.py` with the portable cluster running and the ignored psycopg driver present. The tested corrected migration SHA-256 is b6d596e86286abec19a4ff37970a05dd4c472debce10af19ae2d58279c474d23. SQL proposal hashes and parser results are in ignored phase_5_sql_validation.json. Runtime artifacts are preserved in ignored baselines under phase_5_isolated_* filenames, including original errors, final results, normal verification, before schema, download evidence and AFTER-recovery metadata. The security-capture script embeds an expected production project label; its isolated export is explicitly wrapped with the actual local origin to avoid misidentifying it as production evidence.

## Untested and remaining risks

- Real Supabase JWT/Auth/PostgREST/GraphQL behavior, live trainer sessions, pooled connections and production-specific grants/extensions/default privileges. No production connection was made.
- Financial UI/server-action integration, browser preview/confirmation and receipts/reminder presentation are not implemented/tested by this database harness.
- Concurrent concession-versus-payment and reversal-versus-payment races, SERIALIZABLE isolation, sustained load and crash/power-loss durability were not separately exercised. Ordered locks/version writes protect the design, but these cases should not be reported as tested.
- Session timezone independence and date boundaries/leap February were tested; the system clock was not advanced across a real India midnight. Reminder date tests temporarily replaced fee_today inside a transaction and rolled that DDL back. No scheduler or external messages ran.
- Recovery denial/history preservation was tested; re-enabling write grants and restoring a backup were not performed.
- Full-payment reversals only; partial refunds remain unsupported. Cash duplicate entry with a new request ID still needs human review. Vendor archive hash is recorded, not independently vendor-attested.

## Cleanup and recommendation

The server was stopped successfully after evidence capture; loopback port 55432 was verified closed. Keep portable binaries/data only until review is complete. To stop an owned running test instance, use `.next/phase5-postgres/pgsql/bin/pg_ctl.exe -D .next/phase5-postgres/data -m fast -w stop`. Verify the resolved path and loopback server first. Cleanup may remove ONLY this task-created `.next/phase5-postgres` directory after shutdown; do not delete pre-existing files/services or the shared `.next/sql-review-parser` directory. No automatic recursive cleanup is performed. The password is local test-only and stays ignored; deleting the owned test directory after shutdown removes its credential files too. Retain safe evidence in ignored baselines with an access-restricted backup.

Recommendation: the corrected proposal has passed substantive isolated database tests and is suitable for final production approval review, not automatic execution. First obtain fresh production read-only security metadata through an approved workflow, reconfirm live project ogzdhmptzeyinhgxcgii/postgres, review production-only differences/default grants and a recovery window, then request separate approval for the corrected file/hash. Do not rerun earlier migrations/grant hardening. No production approval is inferred from isolated testing.

## Later development artifact lifecycle

The cluster was already stopped before subsequent application production builds cleared the generated .next directory, including temporary binaries/driver/credential files. No existing system service or unrelated user file was deleted. Runtime evidence had been copied to ignored baselines and remains preserved. To rerun isolated tests, recreate a dedicated approved cluster/tools first; do not treat .next as durable backup storage.

## 2026-10-23 fresh rerun and durable test location

All 38 groups passed again from a fresh synthetic database with supplied broad postgres/public default ACLs explicitly reproduced. No financial SQL correction was required; checksum remains b6d596e86286abec19a4ff37970a05dd4c472debce10af19ae2d58279c474d23. Current portable cluster and driver were recreated under ignored supabase/review/baselines/isolated-postgres and baselines/tools, superseding the earlier .next paths above. See STUDIO_OPERATIONS_ISOLATED_TEST_REPORT.md for provenance, Auth-stub limitations, fresh-run sequence and stop/cleanup procedure. Operations tests subsequently passed 19 groups without changing financial metadata. Final financial results: baselines/phase_5_isolated_results_latest.json. Production remains untouched and separately gated.
