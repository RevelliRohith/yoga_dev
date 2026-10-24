# Arkaprajna admin continuation — 23 October 2026

Project: D:\code\yoga_dev\arkaprajna-yogashala. Existing app remains on http://localhost:3000. No deployment or production migration was performed. Existing authenticated browser session was used read-only; no business records were edited.

## Completed in this continuation

- Audited the current master status, completion/security reviews, module code and application tests; read the referenced chat. Preserved the existing project and its prior uncommitted work.
- Added explicit HTTPS Maps/directions settings with validation, narrow public projection and address-search fallback.
- Added Classic/Minimal certificate templates, immutable issue-time studio name/footer snapshots, and a warning for legacy certificates whose historical details were never captured. Draft preview works without writes. New issuance requires the independent extension flag as well as existing operations gates.
- Added manual reminder handled/reopen UI and backend, session-based administrator authorization, source checks, database RLS, server-stamped actor/time and append-only audit. Stores status/identifiers only. Handled is explicitly not proof of sending. Nothing sends automatically.
- Prepared an independent, unapplied extension migration, read-only verification and recovery proposal. Original financial and operations proposal checksums are unchanged. No service-role bypass or test-login route was added.

## Module status

| Module | Current implementation and verified behavior | Still blocked / unverified |
|---|---|---|
| Fees & receipts | Existing billing/allocation/receipt UI/backend retained; application security/paise/preview tests pass; authenticated page correctly shows activation gate | Financial migration, read/write activation, controlled persisted payment/receipt/reversal acceptance; no real payments |
| Inquiries | Existing consent, follow-up/status/notes, outcome reporting and abuse controls retained; tests pass; authenticated gated page renders | Operations migration, separate public collection activation and live follow-up acceptance |
| Events | Existing draft/edit/publish/withdraw/search/date filters retained; tests pass; gated workspace renders | Operations persistence, controlled publication tests; image uploads are not implemented |
| Certificates | Templates, draft preview, history/print and issue-time snapshots implemented; minimal unsaved preview tested in authenticated browser with save disabled | Operations plus extension approval/activation, controlled issuance/print/PDF acceptance; historical snapshots cannot be reconstructed |
| Reminders | Copy-only queues plus handled/reopen persistence implemented; application security tests and isolated SQL lifecycle/RLS/audit/recovery pass; gated page renders | Operations/extension activation and source integration; automatic sending remains excluded |
| Reports | Existing enrollment/program/batch/trainer reporting loads actual current records in authenticated browser; private CSV and error behavior covered by tests | Financial/operations reports await their independent data sources; CSV download not exercised in browser |
| Studio settings | Existing content/contact/teacher/logo-URL/document-footer workflow retained; separate Maps URL implemented and visible in disabled form | Operations/extension activation, approved content; Storage uploads remain unimplemented |

## Tests actually run

- Application suite: **93 passed, 0 failed** (includes four new regression groups). These include mocks; they are not a hosted end-to-end run.
- Actual disposable PostgreSQL extension tests: **8 groups passed**, including core auth/RLS metadata preservation, mark/reopen/audit, anonymous/trainer denial, actor-forgery/delete denial, immutable/constrained certificate snapshots, Maps projection, rerun guard, catalog review and recovery quarantine. Auth uses a local stub. Only the fixed loopback disposable database was used; it was stopped afterward.
- ESLint: passed. Production build: passed. Final standalone TypeScript: passed. Whitespace check: passed (existing line-ending notices only).
- Authenticated browser: inspected all seven module routes read-only; enrollment report finished loading with real existing counts; safe unavailable states appeared for gated sources. Selected Minimal, filled synthetic draft text, reviewed the unsaved certificate and confirmed issuance remained disabled. Preview screenshot visually inspected. Temporary QA tab closed.
- Existing financial 38-group and operations 19-group SQL suites were **not rerun** here; their earlier evidence remains historical. No new live financial or operational write acceptance is claimed. Final small explanatory-print/notice cleanup was checked by TypeScript/lint after the production build.

## Remaining gates

The app is not fully operational or production-complete. Financial migration approval is independent of operations/extension approval. All production SQL, Data API settings, real payment activation and deployment remain untouched. Keep STUDIO_EXTENSIONS_ENABLED absent/false until the proposed extension is separately reviewed, approved and verified; existing operations flags still apply. Public inquiry collection needs separate activation. Full hosted end-to-end create/edit/receipt/issuance flows remain unverified until approved migrations, controlled fixtures and activation are available. Image uploads still require implementation and reviewed Storage/asset scope; current URL fields do not count as uploads.

The reviewed original financial proposal remains SHA-256 b6d596e86286abec19a4ff37970a05dd4c472debce10af19ae2d58279c474d23; original operations proposal remains 71f072d0e00c064a8ed009e2fec56299461ccb775ce9e02a84271f6d9ae73a3f. New extension proposal SHA-256 is 7a4e5b74207d934f06ff7fd4611e550765e613f8589ee5876d329f339ee5e0f7.

Implementation/review files: STUDIO_EXTENSIONS_REVIEW.md; supabase/review/studio_extensions.proposed.sql; studio_extensions_verify_readonly.sql; studio_extensions_disable.recovery.proposed.sql; scripts/studio-extensions-isolated-test.py. No commit or release was made. Existing localhost server was reused and left running.
