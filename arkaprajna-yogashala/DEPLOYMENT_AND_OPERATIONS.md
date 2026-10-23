# Deployment and studio operations handover preparation

Prepared, not deployed. Do not buy services, configure secrets, alter DNS or publish without explicit approval.

## Environment names, never values

Existing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are the only public Supabase configuration. Public key validation rejects service-role/secret keys. Never copy .env.local or ignored baselines into a repository, deployment artifact or support message.

New server-only flags default false/absent:

| Name | Activation boundary |
| --- | --- |
| FINANCIAL_READS_ENABLED | Approved financial migration plus read-only metadata/API verification |
| FINANCIAL_WRITES_ENABLED | Separate approved write activation and controlled integration results |
| FINANCIAL_PREVIEW_KEY | Server-only random key of at least 32 characters; store in secret manager, never reuse a Supabase key; rotation invalidates outstanding 15-minute previews |
| FINANCIAL_REFUNDS_ENABLED | Separately approved full manual refund recording/verification only; does not transfer funds |
| STUDIO_OPERATIONS_READS_ENABLED | Approved operations schema and metadata verification |
| STUDIO_OPERATIONS_WRITES_ENABLED | Explicit activation of admin operational writes/publication |
| PUBLIC_CONTENT_ENABLED | Approved public content RPC/schema and publication workflow |
| PUBLIC_INQUIRIES_ENABLED | Separate DB EXECUTE activation, contact/privacy/retention and abuse review |
| TRAINER_ONBOARDING_ENABLED | Existing Stage 3F Auth/credential/SMTP/recipient approval plan |

APP_SITE_URL and SUPABASE_SECRET_KEY or deliberately chosen legacy SUPABASE_SERVICE_ROLE_KEY are existing onboarding server configuration, not needed for financial or public-content operations. Read MODULE_3_STAGE_3F_REVIEW.md before activation. Never prefix privileged keys with NEXT_PUBLIC. No new values were installed here.

## Hosting decision

For a small commercial studio, compare a commercially permitted managed Next.js plan with a maintained Node server option; choose based on actual budget and operational ownership. Do not assume Vercel Hobby is suitable: its official plan restricts it to personal, non-commercial use (https://vercel.com/docs/plans/hobby). A supported paid managed plan avoids running your own process/TLS/patching; a Node host requires someone to own those tasks. Confirm current pricing, limits and commercial terms before purchase; no plan was bought.

Supabase Free can pause after low activity; do not treat it as an uptime guarantee (https://supabase.com/docs/guides/platform/free-project-pausing). Confirm the studio's availability needs and backup ownership. Supabase recommends off-site exports for free projects (https://supabase.com/docs/guides/platform/backups). Metadata snapshots are not data backups. No paid upgrade is configured.

## Proposed release checklist

1. Preserve the working tree and review changes. Run npm.cmd ci, TypeScript, lint, node --test tests/*.test.mjs and production build in controlled CI. Review the unresolved development advisory; do not process untrusted glob patterns or expose CI secrets to untrusted contributions.
2. Review each migration separately using its checksum, latest schema/API metadata and recovery plan. Isolated approval does not authorize production execution. Apply only approved files, once; capture BEFORE/AFTER, review policies and effective privileges before feature activation.
3. Confirm the target Supabase project, allowed Auth origins, exact HTTPS site/redirect URLs and supported SMTP before trainer invitation activation. Do not use wildcard production redirects. No student signup/login.
4. Configure only required server flags/secrets in the approved host, rebuild/restart as appropriate, and validate errors/empty states with capabilities still gated. No flags should be added to public client configuration.
5. Obtain a confirmed domain, DNS/TLS ownership, studio contacts, published program/teacher consent, receipt/certificate footer/signatory and retention decisions. Configure public content deliberately; private programs/profiles are not automatically published. No search/indexing or public deployment is authorized by local development.
6. Approve controlled integration fixtures and test administrator actions, trainer isolation, public inquiry anti-abuse, financial idempotency/allocations/receipts/reversals and browser print/PDF before any real financial use. No real students for unnecessary tests.
7. Review monthly hosting/database costs and resource limits. Keep a tested data backup in restricted off-site storage; include Auth/schema and separately owned Storage assets if uploads are later enabled. Rehearse restore to an isolated destination, never blindly overwrite live history.
8. Only after acceptance request explicit deployment/DNS approval. A passing build is not launch acceptance.

## Daily studio workflow after approved activation

- Administrators manage student enrollment and trainer assignments; trainer accounts are invited only through reviewed admin onboarding. Inactive trainer access is denied using current profile checks.
- Preview one calendar-month bill per student; current program rates affect only newly generated bills. Review inactive/future admissions and explicit historical opening amounts. Zero fee means Paid and no receipt.
- Independently verify cash/UPI/bank receipt; select each billing month and amount explicitly. Review the signed preview and confirm. Refresh the ledger after uncertain results; never enter a replacement with a new request ID before checking the original.
- Reversals preserve original receipts, allocations and audit, reopening outstanding debt. Partial refunds are unsupported. Verified refund recording requires separate approval/verification and does not disburse money.
- Use Reports CSV and administrator-only printable receipts. Browser Print/Save as PDF is supported; there is no automated PDF delivery service.
- Prepare reminders manually on 8th/11th/16th, review and copy text. Copying is not proof of sending; no delivery status is fabricated.
- Review inquiries and record notes/outcomes; converted is not an automatic student registration. Publish events only with confirmed content; issue participation certificates only after administrator confirmation.

## Monitoring and recovery

Record safe stage/error codes, request identifiers and aggregate health only. Never log passwords, JWTs, cookies, keys, bank details or student contact/guardian data. No paid monitoring service is configured. Use approved host/database error monitoring, backup checks and explicit alert ownership.

If financial behavior is uncertain, stop collections, retain receipts/request IDs and reconcile. Use the separately approved financial write-quarantine proposal; do not delete/reallocate records or automatically roll back production. Operations recovery is separate and may pause the enrollment-history trigger; record gaps and restore only after review. Keep immutable evidence before any restore.

No image upload is enabled. Future uploads require bucket/policy/type/size validation and consent review; arbitrary SVG or executables must not be accepted as profile images. No gateway, barcode, attendance, student portal or automatic bulk messaging is configured.
