# Phase 5 production readiness review

Current assessment (2026-10-23): **Conditional GO for final approval review; NO-GO for production execution now.** The owner has confirmed the Dashboard configuration below, resolving the missing exposed-schema evidence. The reviewed proposal demonstrates no unauthorized financial path under the supplied catalog/security model. Current catalog drift, backup/recovery readiness and separate explicit execution approval remain required. No production SQL, permissions, data, accounts or configuration were changed.

## Current Dashboard confirmation and final alternate-access assessment

Evidence source: the owner's direct Dashboard confirmation in this conversation on 2026-10-23, not a new agent connection to Supabase.

| Setting | Owner-confirmed value |
| --- | --- |
| Exposed schemas | `graphql_public`, `public` (2 of 2) |
| Exposed functions indicator | 2 of 4 |
| Automatically expose new tables | Enabled |
| Extra search path | `public`, `extensions` |

The function indicator does not identify signatures, API roles or authorization. It is not an allowlist for future financial RPCs. The saved catalog inventories five API-role-executable functions across the two schemas, including the GraphQL wrapper; a Dashboard count may use different scope. Do not infer a missing/revoked function from that count. Reconcile exact signatures/ACLs in the pre-execution catalog review if anything has changed.

### Automatically expose new tables: disable before migration, with separate approval

Recommend disabling this setting before financial migration as a least-privilege precaution for future development. Enabled automatic grants increase the impact of a later table created without deliberate access control. They do not themselves defeat RLS. Supabase documents that turning the setting off does not eliminate every table/sequence privilege or PostgreSQL's global PUBLIC function EXECUTE default; the proposal's explicit revocations remain essential. Do not substitute the toggle for ACL/RLS verification. [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api)

For this exact financial proposal, enabled defaults are **not a demonstrated bypass**: all objects are created, RLS enabled, broad privileges revoked and narrow grants applied inside one transaction, before COMMIT. The saved 38-group isolated run explicitly reproduced broad defaults. No API session can access the transaction's uncommitted new tables. Postconditions abort on unexpected grants. Thus disabling is recommended hardening, not a correction required to make this unchanged migration's ACL design valid. If the owner elects to retain enabled defaults, explicitly record that risk acceptance during final approval.

Do not disable the Data API, remove `public`, blanket-revoke existing application grants, or change platform-owned defaults as part of this task. Those actions may break existing modules. After any separately approved toggle change, capture default ACLs and verify existing admin/trainer workflows before proceeding. Supabase's published rollout states automatic exposure changes for existing projects on 2026-10-30; recheck actual settings/defaults at execution time. [Supabase platform announcement](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)

### Unauthorized access matrix for the unchanged proposal

| Surface | Anonymous | Authenticated trainer / other non-admin | Authorized administrator |
| --- | --- | --- | --- |
| Five financial tables via REST | No SELECT or write grants | SELECT privilege exists, but admin-only RLS returns no rows; no direct writes | SELECT through admin RLS; no direct writes |
| Two financial sequences | No privileges | No privileges | No direct privileges under authenticated role; checked owner functions allocate receipts |
| Six financial entry RPCs | EXECUTE revoked | EXECUTE granted to shared authenticated role, but caller-specific admin check rejects use | One read and five checked write entry points |
| Eight internal financial helpers/triggers | EXECUTE revoked | EXECUTE revoked | Not directly executable by authenticated API identities |
| Existing role/trainer RPCs | Boolean role helpers only; trainer RPC EXECUTE denied | Own active-trainer assignments and six-field roster only | Existing behavior retained; no added financial projection |
| Existing GraphQL wrapper | Saved implementation returns unavailable-extension error | Same | Same; no financial resolver in saved implementation |

All five write entry points call `fee_begin`, which calls `fee_require_admin`; the balance reader calls `fee_require_admin` directly. That helper checks non-null `auth.uid()` and the current `public.is_admin()` predicate before financial work. All financial SECURITY DEFINER functions pin an empty search path and qualify application/Auth objects. The shared authenticated EXECUTE grant is deliberately not proof of permission to perform a financial operation. Application feature flags are supplementary controls; a browser can call RPC directly, so database authorization is decisive.

No views exist in `public` or `graphql_public` in the supplied snapshot. Existing callable definitions match the earlier verified baseline and do not return financial data. The saved `graphql_public.graphql` is SECURITY INVOKER and ignores query input except for returning fixed errors; `pg_graphql` is absent. Do not equate exposing `graphql_public` with enabling the GraphQL extension.

If pg_graphql is later installed/enabled, GraphQL must be reviewed again. Its table visibility and row access follow grants/RLS; trainers may see table/type metadata because they share authenticated SELECT, while admin-only RLS must still deny financial rows. Schema visibility is not a guarantee of row confidentiality. Function execution checks must also survive that path. No hosted GraphQL/JWT tests were performed here. [Supabase GraphQL security](https://supabase.com/docs/guides/graphql/security)

`extensions` in PostgREST's extra search path does not make it an exposed REST resource schema. It permits name resolution; the financial functions' own empty paths do not inherit it. Keep `extensions` and `vault` outside exposed schemas and do not add privileged wrappers around diagnostic views. The saved diagnostic SELECT grants remain a separate SQL/wrapper/possible future GraphQL review concern, not a direct REST financial bypass established by this list. [PostgREST configuration](https://docs.postgrest.org/en/stable/references/configuration.html#db-extra-search-path)

### Final GO / NO-GO

- **PASS:** owner-confirmed exposed-schema list; review of saved functions/views/GraphQL wrapper and proposal authorization; unchanged tested SHA-256 below; saved 38 isolated test groups, not newly rerun in this review.
- **Conditional GO:** present the exact proposal for final production approval after reconfirming current project/role, no catalog drift, restricted data backup/recovery window, and the automatic-exposure decision. No financial SQL amendment is established by this configuration review.
- **NO-GO to execute now:** separate explicit migration approval is absent, current live catalog/backup readiness has not been independently reverified, and no hosted financial integration was run. Approved execution must be followed by the existing read-only verification and controlled Auth/API acceptance before application activation.

The review verifies the design and saved isolated evidence. It cannot certify that not-yet-created production objects already reject live REST/RPC/GraphQL requests. Preserve that distinction in acceptance records. No setting, permission, migration, account or production financial record was changed.

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
| Data API exposure | Owner confirmed `graphql_public`, `public` on 2026-10-23 | RESOLVED; see final assessment above |

The four public function definitions/ACLs/settings were machine-compared with module_3_after_migration.json and all matched. The GraphQL wrapper reads no application tables and does not evaluate the caller's query as SQL. No additional callable function in public/graphql_public was listed. This capture does not inventory callable functions in other namespaces; if another schema is exposed, review its functions/views before concluding no alternate path.

## Comparison with the financial proposal

The broad postgres/public defaults would ordinarily grant new tables substantial privileges, new sequences SELECT/UPDATE/USAGE, and functions EXECUTE. The financial proposal creates its objects inside one transaction, then revokes ALL on the five financial tables, two sequences and all 14 exact function signatures from PUBLIC, anon, authenticated and service_role before commit. It grants authenticated table SELECT only through admin RLS, and authenticated EXECUTE only on six checked entry points. Internal helpers remain non-API-executable. Each entry verifies the caller's administrator identity; sensitive writes use database locks, exact allocations and integrity/audit triggers.

Postconditions inspect ACL sources and effective inherited grants and abort on unexpected permissions. Other sessions do not gain access to uncommitted new objects during that transaction. No default privilege changes are silently bundled. Existing helpers, policies, grants and original constraints remain unchanged; new financial FKs add their reviewed internal parent triggers.

Accordingly, the captured defaults do not establish a bypass of the proposed committed financial objects. They do require strict retention of the revokes/guards and review of every later table, sequence, view or function. Existing MAINTAIN privileges on old application tables also merit separate least-privilege review; do not alter them automatically here.

## Remaining risks and scope

- The owner has now confirmed exactly public and graphql_public. Against that list the saved snapshot shows no existing callable/view bypass to financial information. A new exposed namespace or catalog drift requires renewed review; no global absence-of-bypasses claim is made.
- Diagnostic view SELECT grants in extensions are real, even if that schema is not HTTP-exposed. Do not expose it or add privileged diagnostic wrappers without review. Vault denial must remain intact.
- Future enables/upgrades of pg_graphql, new privileged views/RPCs, schema ownership changes or default-grant changes require a fresh review. GraphQL/PostgREST role/RLS behavior must be verified after approved migration/configuration.
- Production backup/recovery readiness, live project/role confirmation immediately before execution, hosted anonymous/trainer/admin integration and controlled financial fixtures are still required. No real financial rows were created for tests.
- The snapshot identifies no necessary correction to the tested financial SQL. It does not authorize broad default-ACL cleanup or changes to Supabase-managed functions/schemas.

## Exact execution plan after review and separate approval

1. Preserve the owner's confirmed exposed-schema list above and the original validated snapshot. Reconfirm no catalog/exposure drift; review the recommended automatic-exposure change separately without changing settings automatically.
2. Reconfirm project ogzdhmptzeyinhgxcgii, postgres execution role, current prerequisites, backup availability and maintenance/recovery window. Review the exact checksum above. Request explicit approval for ONLY phase_5_financial.proposed.sql; no other proposal or activation is included.
3. Execute the complete approved file once. Never rerun prior grant hardening, bypass guards, split the transaction, seed records or automatically retry an uncertain commit. Stop on any error.
4. Run phase_5_verify_readonly.sql and phase_5_capture_security_readonly.sql, save AFTER separately, compare original tables/helpers/policies/grants/constraints, and require expected function/sequence permissions and zero financial integrity violations. Empty-table zeros are not functional transaction proof.
5. Keep application financial flags false until separate read/API/controlled-fixture approval and verification. Real writes/refunds are additional explicit operational gates.
6. Recovery remains separately approved phase_5_disable_writes.recovery.proposed.sql. It quarantines authenticated financial write RPCs while preserving reads/history. Do not automatically execute rollback, DROP/CASCADE or backup restoration.

## GO / NO-GO decision

Validated JSON: PASS. Captured API-role/schema/function/view/GraphQL review: no demonstrated financial bypass within its stated scope. Broad default-grant handling in tested proposal: acceptable with explicit revokes and guards retained. Tested migration identity and isolated tests: PASS. Current Dashboard exposed schemas: OWNER CONFIRMED. Production execution approval: ABSENT.

**Conditional GO for final approval review; NO-GO for production execution now.** See the current final assessment at the top for the automatic-exposure recommendation and remaining execution/activation gates. Nothing was executed by this review.

## 2026-10-23 isolated regression update

The earlier isolated continuation passed all 38 groups in a fresh synthetic loopback database, explicitly reproducing supplied broad postgres/public default table, sequence and function ACLs and PostgreSQL 17 MAINTAIN grants on the original application tables. This confirms the proposal revokes/guards under those defaults without modifying existing security metadata. The independent operations proposal then passed 19 groups and preserved financial catalog permissions. Evidence: ignored phase_5_isolated_results_latest.json and studio_isolated_results.json. These suites were not rerun for the latest configuration-only review. The owner has since supplied the Dashboard exposed-schema list; SQL execution and hosted integration remain separately gated.
