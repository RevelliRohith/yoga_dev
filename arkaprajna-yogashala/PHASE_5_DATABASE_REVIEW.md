# Phase 5 financial database proposal

Status: corrected proposal tested ONLY in an approved isolated PostgreSQL database; NOT applied to production. Synthetic local SQL and fixtures were used; no production SQL, financial operations, notifications, accounts or credentials were touched. Razorpay remains disabled. Business-policy and isolated-test approval do not authorize production execution.

## Inventory evidence

The actual file was `C:\Users\My Files\Desktop\phase_5_schema_inventory.txt.txt`, rather than the placeholder Downloads path. The Markdown schema_inventory cell was extracted, its presentation backslash layer removed once, and the complete JSON parsed. The original export was not modified. Normalized data and validation evidence are in the Git-ignored `supabase/review/baselines/` directory:

- `phase_5_schema_inventory.json`
- `phase_5_schema_inventory.validation.json`
- `phase_5_sql_validation.json` (syntax evidence only)

Capture timestamp: 2026-10-22T14:59:27Z. Database role: postgres. Expected project label: ogzdhmptzeyinhgxcgii. A hardcoded export label does not independently prove the live project identity. Keep an encrypted, access-restricted backup outside Git; ignored files are not repository backups.

The export contains four public tables, 41 columns, ten RLS policies, four functions and 14 validated constraints. Tables are profiles, programs, batches and students; all have RLS enabled. No public financial tables are present. Other schemas were not inventoried. Existing columns, policies and common function/constraint attributes match the saved Stage 3B after snapshot after escape normalization. Current function bodies, grants, memberships, indexes and triggers need the fresh security capture; the historical snapshot alone does not prove their live state.

Profiles reference Auth UUIDs; students reference programs/batches; batches reference profiles/programs. The admin helper and active-trainer helper, two trainer RPCs and restrictive student/program SELECT policies are preserved. No trainer roster fields are added. Program monthly_fee is numeric and becomes an exact paise snapshot when a bill is explicitly generated; fractional paise are rejected rather than rounded.

## Minimum storage and operations

| New table | Purpose |
| --- | --- |
| fee_bills | One student/calendar month; normal or explicitly reviewed opening balance; immutable rate/name snapshots; fixed concession and reason; optimistic ledger version |
| fee_payments | Verified cash/UPI/bank receipts, stable request identity, amount and original receipt retained after reversal |
| fee_allocations | Explicit positive payment-to-bill amounts; composite foreign keys prohibit cross-student allocation |
| fee_reversals | One audited full reversal per payment; correction versus separately verified manual refund |
| fee_events | Append-only actor/time/before/after audit and manual reminder-preparation journal |

No extra receipt, reminder, student-account or gateway tables are introduced. Receipts belong to payments; zero-fee bills generate no payment or receipt. No financial rows are seeded by the migration.

INR amounts use bounded bigint paise (maximum 99,999,999,999 paise); RPC numeric inputs are checked for exact integral values before casting. Amounts, concessions and allocation totals have database checks. Status is derived: zero balance is Paid, otherwise Unpaid/Partially Paid; overdue is independent and starts on the 16th using Asia/Kolkata dates. No penalties, proration or student deactivation occur.

Five authenticated write RPCs implement explicit bill creation, concession changes, verified collection, full reversal and manual reminder preparation. A sixth reads balances. Each authorizes the current Auth identity through the existing admin helper. SECURITY DEFINER functions use an empty search_path and qualified references; internal helpers are not API-executable. New tables permit authenticated SELECT only through admin RLS; no direct application-role writes or sequence privileges are granted. Default/inherited privileges are checked and unsafe grants abort the migration. Existing application grants, policies and role helpers are not rewritten.

Payments and their complete allocations commit atomically. Stable request UUIDs make retries idempotent; mismatched replay payloads fail. Ordered bill locks and ledger-version writes protect concurrent collection, including stale repeatable-read transactions. Deferred checks require exact payment allocation totals, consistent reversal markers and nonnegative outstanding balances. A failed transaction leaves no partial ledger entries; receipt sequence gaps can remain.

## Risks and boundaries

- SQL/PLpgSQL syntax parsing and 38 isolated test groups passed after correcting the generated-column BEFORE-trigger comparison. Catalog binding, trigger behavior, role simulation, rollback and selected concurrency cases were exercised locally. Production-specific behavior and remaining test gaps are documented in PHASE_5_ISOLATED_TEST_REPORT.md; these results do not authorize production execution.
- Existing student/program columns and original constraints remain unchanged, but new financial foreign keys add internal triggers on their parent tables and prevent hard deletion once referenced. Existing soft deactivation remains available. New internal FK triggers are expected metadata differences, not unchanged-trigger claims.
- This first version supports full-payment reversals only. Partial refunds or selective reversal of allocations require separate design approval. A refund record attests an administrator separately verified a manual refund; it does not transfer funds or independently verify a bank transaction.
- Payment values, receipts and allocations remain preserved; the payment reversal timestamp is the sole permitted audited payment update. Concessions cannot reduce a bill below its already settled amount. Removing a concession may reopen debt explicitly.
- Active UPI/bank references are unique by method and normalized reference. This conservative rule may flag legitimate identical references from different banks; review before use. Full reversal permits a corrected replacement using that reference while preserving the original. Stable request IDs prevent retry duplicates; a person entering the same cash payment with a new ID still needs UI duplicate warnings and administrator review.
- Receipt numbers are unique, globally sequenced and never reset annually; gaps are possible. No tax/legal receipt-format compliance is claimed. Historical opening amounts represent explicitly reviewed outstanding debt, not fabricated historic payments.
- One bill per student/month follows the approved convention. Missing programs, inactive admissions, future admissions and mid-month program changes require preview review; no automatic blended fee is inferred. Already generated future/unpaid bills retain snapshots after program rate changes.
- Reminder preparation is restricted to the approved 8th/11th/16th dates, with payment confirmations separately available. It records delivery as not_sent. No email, WhatsApp, cron or payment gateway exists here.
- Database owners remain trusted and can alter enforcement. RLS and RPC authorization protect application identities, not against a malicious superuser. Caller-supplied confirmation flags represent an authenticated administrator's explicit attestation.
- Concurrent duplicate reminders may receive a uniqueness error and require refresh. Serialization/deadlock/lock-timeout failures require a full transaction retry with the same request ID, never piecemeal resubmission.

## Execution order after separate approval

1. Confirm the live Dashboard project reference is ogzdhmptzeyinhgxcgii and SQL Editor role is postgres. Confirm backup access, a maintenance window and no conflicting fee objects. Do not rerun grant hardening or previous migrations.
2. Run `supabase/review/phase_5_capture_security_readonly.sql`; save the complete financial_security_snapshot in ignored baselines under a new BEFORE filename. Review bodies, ACLs, memberships and all public objects, including anything outside the supplied inventory. Preserve original exports.
3. Obtain approval for isolated database migration/testing using equivalent schema/security and fictional fixtures. Execute the complete `phase_5_financial.proposed.sql` there, without bypassing guards; run the controlled matrix below. Any failure stops progression for correction and renewed review.
4. Only after those results pass, request separate production approval for the exact reviewed file/hash. The proposal is intentionally one-time: existing financial objects make it abort. Never rerun it to repair a partially understood state.
5. After approved production execution, run `phase_5_verify_readonly.sql`, then repeat `phase_5_capture_security_readonly.sql` to a distinct AFTER file. Compare definitions, policies, grants and original constraints/functions against BEFORE. Expected additions are five tables, two sequences, 14 functions, new indexes/constraints/policies, user triggers on new tables and internal FK triggers on existing parents. Existing helpers, policies and grants must match.
6. Verification requires all violation counts zero and expected effective permissions; empty-table zeros alone do not prove transaction behavior. Confirm existing admin pages, Programs/Batches/Students, and trainer privacy regressions. Stop on unexpected differences. Never automatically execute recovery.

## Recovery plan

Before COMMIT, an error aborts the migration transaction; do not bypass preflight/postcondition failures. If execution status is uncertain, inspect metadata before any retry. After COMMIT, preserve financial history and diagnose rather than DROP/CASCADE or restore an older security snapshot blindly.

`supabase/review/phase_5_disable_writes.recovery.proposed.sql` is a separately approved quarantine option: revoke the five authenticated write entry points, verify no inherited EXECUTE remains, preserve admin reads, receipts and audit. It is not a refund, ledger reversal, destructive rollback or restriction on trusted owner SQL. It is not applied automatically. Re-enable only after a reviewed fix and explicit approval. Any restoration from backup requires reconciliation of transactions recorded since that backup.

## Verification status

### Isolated test environment check — 2026-10-22

The owner approved isolated database testing only. No suitable local database runtime was found: postgres, initdb, pg_ctl, psql, Docker and Podman were not available on PATH; no PostgreSQL/Docker service or standard installation directory was found. Windows has a wsl.exe launcher, but it reports that WSL is not installed. The existing `.next/sql-review-parser` is a parser, not a database server.

Per the owner's instruction to stop if no suitable isolated environment is available, no runtime was installed and no migration, fixture or recovery SQL was executed. No production connection was attempted. Runtime cases have zero executed passes/failures; all financial, concurrency, RLS/authorization and recovery scenarios remain untested. Previous syntax passes remain syntax evidence only. No migration corrections were established by this environment check. Production execution is not recommended until isolated tests pass.

Setup choices: provision a temporary standalone PostgreSQL installation/cluster on loopback with a dedicated data directory and no production services; alternatively provision a disposable PostgreSQL container if a container runtime is installed. Either needs only synthetic application tables, Auth identity stubs and API roles, never a production data dump or credentials. This can test database authorization but not a live Supabase Auth integration. Environment setup must be selected before testing resumes; production approval remains separate.

Four prepared SQL files pass PostgreSQL parsing, including PL/pgSQL bodies. Evidence includes current hashes in ignored phase_5_sql_validation.json. No SQL was executed. Read-only live metadata verification, isolated functional/concurrency/security tests and production checks remain pending. Existing 58-test/TypeScript/lint/build application checkpoint predates this SQL-only work and does not validate this financial schema. See `supabase/review/phase_5_controlled_tests.md` for the required test matrix.

## Superseding isolated-test result

The owner subsequently approved portable local setup and testing. PostgreSQL 17.11 ran on 127.0.0.1:55432 with SCRAM and synthetic schema/records only. An original-proposal failure exposed the generated-column BEFORE UPDATE comparison defect; the corrected proposal passed 38 test groups with zero final failures and nine zero integrity violation counts. Recovery quarantine passed. The server was stopped and its port verified closed; no system service or production connection was used. See PHASE_5_ISOLATED_TEST_REPORT.md for the exact correction, original failures, untested cases, evidence and cleanup. Earlier statements describing unavailable runtime/unexecuted isolated tests are historical. Production migration approval remains pending; the corrected file requires fresh review rather than reusing any earlier hash.
