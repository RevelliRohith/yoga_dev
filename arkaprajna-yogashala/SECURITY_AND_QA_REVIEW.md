# Security and QA checkpoint

## Authorization and data flow

Every new financial and operational loader/action/export uses server-side requireAdmin before its feature gate or data access. Existing RLS, inactive-trainer checks and six-field student roster are untouched. New public pages use an anonymous non-persisted Supabase client and a narrow public-content RPC; private profiles/programs are not read using an admin cookie. No new service-role credential or dependency was added to browser code.

Financial mutations use the tested transaction RPCs exclusively; there are no browser/direct table financial writes. HMAC previews bind user/expiry/canonical operation and preserve retry UUIDs; RPCs enforce actual authorization, amounts, locks and constraints. Server flags are all false in the inspected local configuration. Missing schema/connection failures display unavailable. No real transactions or success screens were fabricated.

Public inquiry validation includes consent, normalized Indian mobile, honeypot, date/length checks. Proposed database RPC adds durable serialized global/per-phone limits and deduplication, but its API EXECUTE remains revoked until separately approved activation. These are not verified phone identities or a complete distributed-abuse solution; public activation needs retention/contact/spam configuration review.

Settings/publication actions require administrator confirmation; original updated_at comparisons guard concurrent changes. Public data projections explicitly enumerate fields and filter active trainer links. Inquiry contact/guardian/financial data have no public SELECT. New operations policies/functions/triggers passed 19 isolated runtime groups; they remain proposals for production and are not hosted Supabase security proof.

## Current verification

85 application tests PASS; standalone TypeScript PASS; ESLint PASS; production build PASS. Fresh Chrome responsive/anonymous checks: 34 PASS, zero exceptions or overflow. Mobile screenshot reviewed. New authenticated admin browser flows and real trainer sessions were not tested with live credentials.

Fresh isolated PostgreSQL 17.11: 38 financial groups and 19 operations groups PASS, with supplied broad default ACLs reproduced. Existing security metadata and financial permissions remained intact. Auth is a local subject/role stub; these tests do not validate hosted JWT/PostgREST/GraphQL behavior. Production remains untouched. See PROJECT_COMPLETION_REPORT.md and STUDIO_OPERATIONS_ISOLATED_TEST_REPORT.md.

## Dependency audit

Last recorded full npm audit (not rerun in this continuation): 5 high, 0 critical, 0 moderate, 0 low; all trace through eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces 3.0.3. Production-only audit (--omit=dev): zero findings. The development dependency tree still requires review before launch.

Advisory GHSA-vfj7-8cjw-p6xm identifies stack exhaustion with deeply nested brace patterns and currently lists no patched version: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm . Avoid untrusted glob patterns and untrusted CI changes with secrets, monitor upstream for a compatible patched dependency, and rerun audit/test after a reviewed update. Do not assume braces 3.0.3 is patched for this advisory. Npm's suggested eslint-config-next 14.2.35 downgrade is incompatible with the current Next 16 toolchain and was not applied. No audit fix --force, arbitrary override, lint suppression or unsafe runtime workaround was used.

## Known pending checks

The complete API-surface capture is validated, but the actual current Dashboard exposed-schema list remains missing. Hosted financial/operations integration, authenticated new-admin UI flows, real trainer sessions, approved public collection/retention/spam configuration, print/PDF acceptance and production backup/recovery readiness remain pending. Controlled isolated operations RLS/rate/trigger/certificate tests are now complete (19 groups); they are no longer a pending local task. No feature is described as live merely because its UI exists. No deployment or merchant configuration occurred.
