# Phase 5 production readiness review

Current assessment: **NO-GO for production execution** until the actual Dashboard Data API exposed-schema list is supplied and reviewed, followed by separate explicit execution approval. No production SQL, permissions, data, accounts or configuration were changed.

## Tested migration identity

File: supabase/review/phase_5_financial.proposed.sql

SHA-256: b6d596e86286abec19a4ff37970a05dd4c472debce10af19ae2d58279c474d23

The current file matches the corrected migration that passed 38 isolated PostgreSQL 17.11 test groups, including financial integrity, concurrent payment protection and recovery quarantine. Those synthetic Auth tests do not establish hosted Supabase integration. No correction to the migration was identified by the supplied API snapshot.

## Actual evidence and validation

Earlier public security metadata, captured 2026-10-22T17:34:06Z as postgres on PostgreSQL 17.11, showed the original four tables, 41 columns, ten policies, four functions, 14 validated constraints and 18 internal FK triggers. Admin CRUD and trainer privacy restrictions were preserved; no financial objects existed. The review facts remain in ignored phase_5_production_metadata_review.json.

The complete api_surface_snapshot attachment was extracted from its Markdown table, with one presentation backslash layer removed, and parsed as JSON. Capture: 2026-10-22T18:26:59Z; postgres; PostgreSQL 17.11; expected project label ogzdhmptzeyinhgxcgii. All required arrays and metadata fields are present. Counts: two API roles, ten role/schema rows, three views, five callable functions, zero pg_graphql extension rows, 24 default ACL rows and five settings rows.

Saved automatically, Git-ignored:

- supabase/review/baselines/phase_5_api_surface_snapshot.json
- supabase/review/baselines/phase_5_api_surface_snapshot.validation.json

Normalized snapshot SHA-256: 11f2296717e9eca8ca6b90200340a72032a59f80d73b451fc07177144ae8f93c. The original attachment was not modified. Preserve an access-restricted backup outside Git. The expected project label is supplied metadata, not independent proof of the currently open Dashboard project. Local application public configuration separately matches that project host.

## Findings

| Area | Confirmed finding | Assessment |
| --- | --- | --- |
| API roles | anon and authenticated are nonsuperuser, non-BYPASSRLS, with inheritance enabled | PASS for supplied role flags; earlier public capture showed no API-role memberships/owner rights |
| Schema grants | Both roles have USAGE but no CREATE on public, graphql_public, graphql and extensions; neither USAGE nor CREATE on vault | No object-creation hijack path demonstrated in inspected schemas; USAGE does not itself expose a schema through HTTP |
| Application views | No public/graphql_public/graphql application views or materialized views listed | No view-based application-data bypass identified in these inspected schemas |
| Diagnostic views | extensions.pg_stat_statements and pg_stat_statements_info grant both roles SELECT | Conditional exposure concern: diagnostic/query metadata must not be assumed harmless or private if extensions is exposed or wrapped |
| Vault | decrypted_secrets denies both roles SELECT, and vault schema USAGE is denied | No direct API-role Vault access demonstrated |
| Public functions | is_admin, is_trainer, trainer_dashboard_batches and trainer_student_roster exactly match saved verified definitions, ACLs and settings after presentation normalization | PASS; empty search_path and existing authorization predicates retained |
| Trainer RPCs | Authenticated-only EXECUTE; current active trainer and assignment checks; roster returns only id/code/name/program/batch/status | No financial/contact/guardian data path added; real trainer-session tests remain separate |
| Role helpers | Caller-specific boolean checks; is_trainer requires is_active=true; anon EXECUTE retained as existing behavior | No arbitrary-profile or financial-data result exposed |
| GraphQL | pg_graphql extension array is empty; graphql_public.graphql is SECURITY INVOKER, returning only fixed unavailable-extension/version errors | No live GraphQL resolver or arbitrary query execution appears in this definition; public EXECUTE does not elevate its privileges |
| Default ACLs | Broad automatic table/sequence/function grants exist, including anon/authenticated in public and several platform schemas | Risk for future objects; mitigated for this financial proposal by explicit revocation and postconditions, not globally fixed |
| Role search paths | Supplied defaults concern postgres and Supabase service roles; no pgrst exposure-setting rows returned | Not evidence of API schema exposure; new financial functions use independent empty paths and qualified references |
| Data API exposure | User message contains a placeholder instead of actual schema names | UNCONFIRMED; remaining readiness blocker |

The four public function definitions/ACLs/settings were machine-compared with module_3_after_migration.json and all matched. The GraphQL wrapper reads no application tables and does not evaluate the caller's query as SQL. No additional callable function in public/graphql_public was listed. This capture does not inventory callable functions in other namespaces; if another schema is exposed, review its functions/views before concluding no alternate path.

## Comparison with the financial proposal

The broad postgres/public defaults would ordinarily grant new tables substantial privileges, new sequences SELECT/UPDATE/USAGE, and functions EXECUTE. The financial proposal creates its objects inside one transaction, then revokes ALL on the five financial tables, two sequences and all 14 exact function signatures from PUBLIC, anon, authenticated and service_role before commit. It grants authenticated table SELECT only through admin RLS, and authenticated EXECUTE only on six checked entry points. Internal helpers remain non-API-executable. Each entry verifies the caller's administrator identity; sensitive writes use database locks, exact allocations and integrity/audit triggers.

Postconditions inspect ACL sources and effective inherited grants and abort on unexpected permissions. Other sessions do not gain access to uncommitted new objects during that transaction. No default privilege changes are silently bundled. Existing helpers, policies, grants and original constraints remain unchanged; new financial FKs add their reviewed internal parent triggers.

Accordingly, the captured defaults do not establish a bypass of the proposed committed financial objects. They do require strict retention of the revokes/guards and review of every later table, sequence, view or function. Existing MAINTAIN privileges on old application tables also merit separate least-privilege review; do not alter them automatically here.

## Remaining risks and scope

- The current Dashboard exposed-schema list was NOT supplied. Earlier confirmation of public/graphql_public is historical, and cannot fill the latest placeholder. If the current list is exactly public and graphql_public, this snapshot shows no existing callable/view bypass to financial information in those namespaces. If extensions, graphql, vault or another namespace is exposed, inspect its relevant callable objects and privileges first. No global absence-of-bypasses claim is made.
- Diagnostic view SELECT grants in extensions are real, even if that schema is not HTTP-exposed. Do not expose it or add privileged diagnostic wrappers without review. Vault denial must remain intact.
- Future enables/upgrades of pg_graphql, new privileged views/RPCs, schema ownership changes or default-grant changes require a fresh review. GraphQL/PostgREST role/RLS behavior must be verified after approved migration/configuration.
- Production backup/recovery readiness, live project/role confirmation immediately before execution, hosted anonymous/trainer/admin integration and controlled financial fixtures are still required. No real financial rows were created for tests.
- The snapshot identifies no necessary correction to the tested financial SQL. It does not authorize broad default-ACL cleanup or changes to Supabase-managed functions/schemas.

## Exact execution plan after review and separate approval

1. Obtain the actual current Dashboard Data API exposed schemas, without changing them. Review any additional namespace before moving to GO. Preserve the original export and this validated snapshot.
2. Reconfirm project ogzdhmptzeyinhgxcgii, postgres execution role, current prerequisites, backup availability and maintenance/recovery window. Review the exact checksum above. Request explicit approval for ONLY phase_5_financial.proposed.sql; no other proposal or activation is included.
3. Execute the complete approved file once. Never rerun prior grant hardening, bypass guards, split the transaction, seed records or automatically retry an uncertain commit. Stop on any error.
4. Run phase_5_verify_readonly.sql and phase_5_capture_security_readonly.sql, save AFTER separately, compare original tables/helpers/policies/grants/constraints, and require expected function/sequence permissions and zero financial integrity violations. Empty-table zeros are not functional transaction proof.
5. Keep application financial flags false until separate read/API/controlled-fixture approval and verification. Real writes/refunds are additional explicit operational gates.
6. Recovery remains separately approved phase_5_disable_writes.recovery.proposed.sql. It quarantines authenticated financial write RPCs while preserving reads/history. Do not automatically execute rollback, DROP/CASCADE or backup restoration.

## GO / NO-GO decision

Validated JSON: PASS. Captured API-role/schema/function/view/GraphQL review: no demonstrated financial bypass within its stated scope. Broad default-grant handling in tested proposal: acceptable with explicit revokes and guards retained. Tested migration identity and isolated tests: PASS. Actual current Data API exposed schemas: MISSING. Production execution approval: ABSENT.

**NO-GO for production execution now.** The remaining technical decision depends on the actual exposed-schema list. After that is confirmed and any additional surface reviewed, an explicit GO-for-approval assessment can be recorded. Production execution still requires a separate explicit approval; nothing was executed by this review.

## 2026-10-23 isolated regression update

The unchanged financial migration passed all 38 groups again in a fresh synthetic loopback database, this time explicitly reproducing supplied broad postgres/public default table, sequence and function ACLs and PostgreSQL 17 MAINTAIN grants on the original application tables. This confirms the proposal revokes/guards under those defaults without modifying existing security metadata. The independent operations proposal then passed 19 groups and preserved financial catalog permissions. Evidence: ignored phase_5_isolated_results_latest.json and studio_isolated_results.json. This does not resolve the missing current Dashboard exposed-schema list, authorize production SQL or verify hosted Supabase integration. The NO-GO assessment above remains.
