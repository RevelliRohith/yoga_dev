# Studio operations database proposal - separate approval

NOT APPLIED. This proposal is independent of the five-table financial migration. It supports inquiries, events, certificates, settings and enrollment history without student accounts, attendance, tickets, messaging providers or Storage uploads. No production records or permissions have changed.

## Minimum proposed storage

- studio_settings: one studio row containing approved public content/contact details, document footers and curated program/teacher introductions. No secrets belong here.
- studio_events: title, description, India-time event instant, venue, explicit draft/published status.
- studio_inquiries: private administrator-only contact requests, outcome and follow-up notes. No automatic student registration.
- studio_certificates: immutable participation records with unique references. No claimed accreditation or signatory invention.
- studio_audit: append-only change history. Student enrollment events capture only program/batch/status, excluding contacts, guardians and birth/address fields. Earlier enrollment changes cannot be reconstructed.

The existing students table gains one user trigger for future enrollment-history capture. Existing columns, policies and helpers remain unchanged. New operations triggers record settings/events/inquiry outcomes/certificate creation; direct application mutation of audit rows is not granted. This trigger addition requires explicit migration approval.

## Access and public projection

All new tables have RLS and administrator SELECT. Settings/events permit admin INSERT/UPDATE, inquiries permit admin column-level status/notes/timestamp UPDATE, and certificates permit admin INSERT only. There are no API DELETE/TRUNCATE/TRIGGER/REFERENCES grants. Trainers receive no new data path. Certificate records and public inquiries are not public SELECT-able. SECURITY DEFINER functions use empty search_path and narrow projections.

Public content RPC returns only approved content keys and published event fields. Public teacher entries are linked to existing active trainer profiles, filtered by role/status in the function, and projected to name/specialization/qualifications/introduction only. No contacts, UUIDs, student or financial records are projected. Programs are explicitly curated public entries, rather than weakening the private programs policies.

The public inquiry RPC is created but receives NO anon/authenticated EXECUTE in the base migration. studio_inquiries_activate.proposed.sql is a separate, externally visible collection gate. The app is also disabled until PUBLIC_INQUIRIES_ENABLED and PUBLIC_CONTENT_ENABLED are approved. The function validates fields and mobile, rejects the honeypot, serializes a durable limiter, and permits at most three submissions per mobile and 50 total per hour. Stable random request IDs prevent duplicate retry inserts.

These limits reduce abuse but do not authenticate a mobile number; attackers can spoof numbers or exhaust a global quota. Review a trusted reverse-proxy rate limit or approved CAPTCHA before public activation. No paid provider or credentials are assumed. Confirm inquiry retention/deletion process, contact details and privacy text before collecting personal information. No automatic deletion or external notifications are configured.

## Validation and risks

SQL/PLpgSQL parsing and 19 actual isolated PostgreSQL 17.11 runtime groups passed on 2026-10-23. Tests used the dedicated loopback cluster, synthetic records, reconstructed existing schema/RLS and a local Auth-subject stub, under the supplied broad public default ACLs. Existing policies/helpers/grants/constraints and the financial schema remained unchanged. No production migration was executed. Hosted Supabase Auth/PostgREST/GraphQL and authenticated browser acceptance remain unverified. See STUDIO_OPERATIONS_ISOLATED_TEST_REPORT.md.

Concurrent administrative edits use original updated_at filters; competing first inserts/duplicate certificate requests return a conflict rather than reporting false success. Certificate references are random identifiers, unique by constraint, not gapless legal serial numbers. No correction/revocation workflow is implemented for issued certificates yet; do not silently overwrite history. Configure approved public content before publishing. Image uploads are not implemented because no Storage bucket, policies or assets were approved.

## Proposed order and recovery

1. Review current inventory for name/dependency conflicts and the completed isolated results. Do not reuse a production database for testing.
2. Isolated execution, policy/projection/rate/deduplication/audit/certificate/recovery tests have passed. Preserve the exact tested SHA-256: 71f072d0e00c064a8ed009e2fec56299461ccb775ce9e02a84271f6d9ae73a3f.
3. Review results and request separate production approval for the exact resulting file/hash. Financial execution approval does not include this file. No rows are seeded.
4. After approved production execution run studio_operations_verify_readonly.sql, compare prior security metadata and verify enrollment-history trigger behavior with separately approved fixtures. Keep application writes/public content off until activation approval.
5. Separately approve studio_inquiries_activate.proposed.sql and public configuration only after abuse/privacy/contact review. Nothing is sent externally.

Emergency recovery proposal: studio_operations_disable.recovery.proposed.sql revokes new writes/public function access, preserves records and admin reads, and disables only the new enrollment-history trigger if it interferes with existing students. This creates a documented history gap; do not execute automatically. It does not revert other policies, financial tables or Auth settings. Re-enabling requires review/approval.
