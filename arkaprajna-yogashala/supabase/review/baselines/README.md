# Local security baseline exports

The user-supplied export is saved as `module_3_before_migration.json`, captured at `2026-10-22T06:44:37Z` under database role `postgres`. Its structure and pre-migration compatibility were validated. `module_3_before_migration.validation.json` records counts, validation limits, and SHA-256 hashes. No live SQL was executed by the agent. Preserve both files and keep a separate private, encrypted backup.

The user reports the trainer-access migration has now completed successfully. Do not rerun it or overwrite the saved before snapshot. In the verified project, run `../module_3_capture_baseline_readonly.sql` again to capture the CURRENT, after-migration state. Despite its historical filename/header, this query reads current metadata only and makes no database changes. Supply the complete exported result for automatic formatting and saving as `module_3_after_migration.json` here.

Actual exports are Git-ignored. They contain security metadata, not application/Auth records or credentials. Check that the export contains all arrays and is not truncated. The embedded expected-project reference is only a label; confirm the project URL/reference in Dashboard settings separately.

If the SQL Editor displays only the ROLLBACK completion, run the SELECT/CTE statement itself (from WITH through its final semicolon) to obtain the result. It is read-only. Share the metadata export or result for comparison; redact unexpected secrets in custom SQL definitions if any.

## Current evidence checkpoint: 2026-10-23

Both Stage 3B before/after snapshots and the Phase 5 inventory/API capture already exist and were reviewed; historical instructions above do not request rerunning completed work. Fresh isolated results are phase_5_isolated_results_latest.json (38 passed) and studio_isolated_results.json (19 passed). Current synthetic tools/cluster live under isolated-postgres and tools, outside .next and ignored. The owned server was stopped and loopback 55432 verified closed. Never commit raw exports, browser profiles, test-secret.txt or binaries. These are local evidence, not production backups. Preserve an access-restricted backup separately.
