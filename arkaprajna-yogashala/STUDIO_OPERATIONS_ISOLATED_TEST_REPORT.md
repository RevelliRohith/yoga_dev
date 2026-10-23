# Studio operations - isolated database verification

Date: 2026-10-23. Result: **19 test groups passed, zero final failures**. Production was not contacted or modified. Proposed SQL was applied only to the disposable database. No accounts, production settings, invitations, student records, payments, credentials or messages were used.

## Environment and provenance

Portable PostgreSQL 17.11 Windows binaries came from the EnterpriseDB PostgreSQL distribution endpoint:
https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip

Archive SHA-256: 80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f. It matches the earlier downloaded archive; this is not an independently vendor-published checksum or a claim of Authenticode validation. Only bin/lib/share were extracted. No administrator installation, service registration, system-wide setting or existing application configuration was changed.

Dedicated cluster: supabase/review/baselines/isolated-postgres/data. Listen address 127.0.0.1 only; port 55432; database phase5_disposable. SCRAM local test credential is generated and remains in ignored test-secret.txt; never print or copy it into app configuration. Test driver psycopg 3.3.6 resides in ignored baselines/tools. No runtime dependency was added to the Next.js application. Cluster/tool/evidence directories are Git-ignored and outside .next so builds cannot erase them.

The financial harness reconstructs the four-table schema from saved metadata and creates only fictional profiles/students/programs/batches. auth.users is a stub containing UUIDs only; auth.uid reads a session setting. SET ROLE simulates anon/authenticated roles. There are no Supabase JWT signatures, email/password identities, Auth refresh, PostgREST schema cache or GraphQL resolvers in this environment. Test credentials have no production access. Broad supplied postgres/public default ACLs are reproduced before applying proposals.

Financial migration was applied and all **38** financial groups passed first. Its recovery quarantine was deliberately tested before operations tests. The operations suite therefore verifies coexistence with the financial schema and preservation of its quarantined permissions, not live financial UI integration.

## Exact tested proposal

supabase/review/studio_operations.proposed.sql
SHA-256: 71f072d0e00c064a8ed009e2fec56299461ccb775ce9e02a84271f6d9ae73a3f.

No migration correction was required by this run. Do not interpret isolated inquiry activation/recovery as production authorization.

## Passed groups

1. Complete guarded migration under broad supplied default ACLs.
2. Existing four-table definitions, policies, constraints, helpers and grants unchanged.
3. Five RLS tables, validated constraints and valid indexes.
4. Explicit public settings projection; private fields/UUIDs excluded; inactive teacher removed.
5. Admin event draft/publication/withdrawal and no API DELETE.
6. Anonymous, active/other/inactive trainer private-data and mutation isolation.
7. Certificate issuance, duplicate reference prevention, future-date rejection and immutable record.
8. Inquiry RPC disabled before separate activation.
9. Separate inquiry activation applied only to the synthetic database.
10. Inquiry validation, stable-request deduplication and three-per-mobile quota.
11. Eight simultaneous inquiry attempts accepted exactly three for a mobile.
12. Follow-up column permissions, no implicit student admission, private append-only audit.
13. Enrollment history contains only program/batch/status; existing trainer roster/assignment/privacy enforced.
14. Global hourly inquiry quota is exactly 50.
15. Prepared read-only catalog verification executes successfully.
16. Existing security metadata unchanged after workflows.
17. Financial catalog and quarantine permissions unaffected.
18. One-time migration guard rejects reapplication.
19. Recovery revokes new writes/public RPCs, retains records/admin reads, disables only the new history trigger, and preserves existing admin access.

Initial harness failures were DML fetchall without RETURNING and then an incorrect wrapper assignment while correcting that harness. Neither was a schema failure. Both were fixed; the task-created synthetic database was recreated, then all 38 financial and 19 operations groups ran from a fresh database without resume shortcuts. Original failures/corrections are recorded in ignored isolated-postgres/harness-corrections.txt. No production database or pre-existing service/file was removed.

## Evidence and rerun

Tracked harnesses: scripts/phase5-isolated-test.py and scripts/studio-isolated-test.py. Both pin connection to loopback:55432/phase5_disposable and never read .env.local. Run the financial harness first against a fresh dedicated synthetic database; then run python scripts/studio-isolated-test.py. Do not repoint or weaken connection assertions. The operations harness rejects pre-existing studio objects on a repeat run.

Final machine results: ignored supabase/review/baselines/phase_5_isolated_results_latest.json (38) and studio_isolated_results.json (19), also retained inside isolated-postgres. Preserve safe evidence in restricted backup storage; Git ignore is not a backup.

## Cleanup and production limitations

The owned server is stopped after testing and 55432 closure is checked. If deliberately restarted for approved tests, stop only this owned cluster using:

```powershell
& ./supabase/review/baselines/isolated-postgres/pgsql/bin/pg_ctl.exe -D ./supabase/review/baselines/isolated-postgres/data -m fast -w stop
```

Do not register a service or modify the existing application. No automatic recursive cleanup is performed. After shutdown/review, the owner can remove only the resolved task-created isolated-postgres directory and test-only driver directory if no longer needed, retaining restricted evidence separately. Never remove unrelated files or services.

Hosted Supabase Auth/JWT/PostgREST/GraphQL behavior, actual exposed schemas, authenticated operational browser flows, approved public privacy/retention/spam configuration, real trainer sessions, printing acceptance and restore from a real backup remain untested. Per-mobile quotas do not verify phone ownership and the global quota can be exhausted by an attacker. Certificates have no revocation/correction workflow; reviewed immutable issuance is the current scope. Student history starts after activation; past changes are not reconstructed.

Recommendation: operations proposal is suitable for separate production approval review, **not automatic execution or activation**. Financial production execution still has its independent NO-GO gate. Public inquiry collection requires its own activation approval. No new production migration is run by the tests or application build.
