# Arkaprajna Yogashala - project-wide development status

## Latest admin continuation (23 October 2026)

See ADMIN_CONTINUATION_2026_10_23.md and STUDIO_EXTENSIONS_REVIEW.md. Added explicit Maps URL, selectable certificate layouts with immutable issue-time studio/footer snapshots, and handled/reopen reminder tracking with administrator RLS/audit. These close three prior implementation gaps; production persistence remains gated. Four new application regression groups: 93 total passed. Eight actual disposable PostgreSQL extension groups passed; lint/build/TypeScript passed within the documented scope. All seven admin routes were inspected in an existing authenticated browser session read-only, including real enrollment reporting and unsaved Minimal certificate preview with issuance disabled.

New independent extension proposal was tested only locally and is NOT applied to Supabase. STUDIO_EXTENSIONS_ENABLED remains absent/false; new issuance and reminder tracking require separate extension approval plus existing operations gates. Original financial/operations proposals unchanged. Financial/operations persistence and full hosted write/print/PDF acceptance remain blocked. Uploads are still not implemented. No production migrations, Data API settings, real payments, notifications or deployment changed. Earlier test totals and missing Maps/templates/reminder statements below are historical, superseded by this entry where applicable.


Updated 2026-10-23. This document supersedes historical checkpoints. Detailed evidence, limitations, changed files and acceptance steps: PROJECT_COMPLETION_REPORT.md.

## Latest master-prompt continuation and Dashboard review

- Added a real administrator-only enrollment summary by program/batch, active/inactive totals and trainer assignments, plus CSV export at `/admin/reports/enrollment/export`. Reads the existing schema with pagination and no student contact/guardian fields; errors or incomplete references suppress totals.
- Fixed WhatsApp links for ten-digit Indian numbers; settings now normalize accepted numbers to +91. Contact Maps search uses the configured address and is absent when no address is configured. A separately configurable map URL is still not implemented.
- Excluded ignored disposable database tools/evidence from application ESLint traversal; application lint rules remain enabled.
- Latest application suite: **89 passed, 0 failed**. ESLint passed. Final production build and current acceptance evidence are recorded in PROJECT_COMPLETION_REPORT.md.
- Dashboard exposure evidence is now resolved; the unchanged financial proposal has conditional GO for final approval review, not execution. No production SQL/settings/permissions changed.
- No browser was available in the current computer-use inventory, so the new Reports UI and contact changes have **not** been visually verified in this continuation. Earlier screenshot evidence applies only to the earlier code. Live authenticated reporting and production integration remain untested.

The earlier completion language below describes the prior checkpoint, not full acceptance of the newly supplied master prompt. Image uploads, separate Maps URL configuration, persistent handled-reminder tracking and selectable certificate templates remain implementation gaps. Storage/persistence activation and actual assets/business content remain separate approval dependencies. Do not report those gaps as completed merely because the existing text/URL/print workflows are implemented.

The existing application has been extended; it has not been replaced. Safe implementation and isolated testing are complete for the current master scope. The entire system is **not production-complete**: financial and studio-operations persistence, public collection, trainer invitations, live-session acceptance and deployment remain separately gated. UI presence is not proof of live functionality.

| Module | Implementation status | Evidence and remaining boundary |
| --- | --- | --- |
| Admin authentication | Fully implemented and tested for existing scope | SSR login/logout, verified admin authorization, tests; owner previously passed Dashboard/Programs/Batches login checks |
| Programs and Batches | Fully implemented and tested for existing scope | CRUD, validation, inactive/assignment guards, regression tests and rolled-back synthetic database CRUD; no production records changed |
| Trainer management | Fully implemented and tested for current management scope | Edit/status/search/assignments; tests; owner reported Stage 3C manual check passed |
| Secure trainer onboarding | Implemented; blocked by configuration/approval | Invitation/recovery and partial-failure protections tested with mocks; real accounts/invitations/SMTP/redirects remain disabled |
| Trainer dashboard | Implemented; live acceptance partially complete | Own profile/assigned batches/six-field roster; application and isolated RLS tests; no real active/inactive/cross-trainer sessions |
| Student management | Core implemented and tested; history activation pending | Registration, immutable codes, edit, enrollment/status/search/filter, safe CSV and fee-ledger link; future history requires operations migration |
| Financial database | Implemented and isolated-tested; production blocked | Unchanged guarded five-table proposal, 38 groups passed again with supplied broad default ACLs; production not applied |
| Fee UI, ledger and receipts | Implemented; live integration pending | Exact paise, signed previews, allocations, concessions/reversals, reports/CSV, print/Save as PDF; all live financial capabilities disabled |
| Public website | Implemented and responsive-tested; content/launch pending | Eight public routes plus event details; no invented contacts/prices/teachers; real content/publication/deployment pending |
| Trial inquiries | Implemented and isolated-tested; activation blocked | Consent/validation/admin follow-up; deduplication and concurrent durable rate limits; no collection or sending enabled |
| Events | Implemented and isolated-tested; production persistence blocked | Search/date/visibility filters, draft/edit/publish/withdraw, public projection; image uploads not implemented |
| Certificates | Implemented and isolated-tested; production issuance blocked | Unsaved draft preview, issue confirmation, immutable unique reference, searchable history, print/browser PDF; approved footer/signatory pending |
| Manual reminders | Implemented; approved data-source activation pending | Fee dates 8/11/16, inquiry/event/payment drafts, copy only; no sending integration |
| Dashboard and reports | Implemented; some sources gated | Real counts or unavailable, student/financial exports, operational CSV and outcome summaries; no fake performance metrics |
| Studio settings | Implemented and isolated-tested; production persistence blocked | Approved contact/content/logo URL/linked active teachers/document footers; Storage uploads absent |
| Security and QA | Automated/local scope complete; live acceptance pending | 85 application tests, 38 financial and 19 operations database groups; lint/TypeScript/build and browser checks recorded in completion report |
| Deployment and handover | Preparation complete; deployment not started | Environment/Auth/backup/operation/recovery checklists; no hosting purchase, DNS change or release |
| Optional uploads/gallery | Not implemented | No approved bucket/assets/consent; not required for current text/URL workflows |
| Razorpay, automatic messaging, student login, attendance | Not started / intentionally excluded | Not approved in master scope; gateway stays disabled |

## Independent work completed in this continuation

Added event search/date/visibility controls, certificate draft review and searchable history, operational CSV exports, strict real-calendar India event validation, narrow public DTOs, safe provider-error handling, scoped operational loading and active-trainer publication validation. Added 14 meaningful application tests and a 19-group isolated operations suite. Fixed incomplete settings normalization and unavailable event-history presentation. Existing module behavior/security was retained.

## Database and security gates

Target expected Supabase reference remains ogzdhmptzeyinhgxcgii. It was not contacted for these isolated tests. Prior grant hardening and trainer migrations must never be rerun.

Financial SHA-256: b6d596e86286abec19a4ff37970a05dd4c472debce10af19ae2d58279c474d23.
Operations SHA-256: 71f072d0e00c064a8ed009e2fec56299461ccb775ce9e02a84271f6d9ae73a3f.

The owner has now confirmed Dashboard exposed schemas `graphql_public`, `public`; functions indicator 2 of 4; automatic table exposure enabled; extra search path `public`, `extensions`. The alternate-access review finds no demonstrated financial bypass in the saved model and unchanged proposal. Recommend disabling automatic table exposure with separate approval; it does not replace explicit grants/RLS. See PHASE_5_PRODUCTION_READINESS.md: conditional GO for final approval review, NO-GO for production execution pending current catalog/project/backup checks and separate explicit approval. No production setting was changed.

The independent operations proposal passed actual disposable PostgreSQL tests, not only syntax parsing. It still needs separate production approval, before/after verification and explicit activation. Public inquiry EXECUTE is a further separate gate. See STUDIO_OPERATIONS_DATABASE_REVIEW.md and STUDIO_OPERATIONS_ISOLATED_TEST_REPORT.md.

## Remaining actions requiring access or approval

1. Reconfirm current project/role/catalog, restricted backup/recovery readiness, the recommended automatic-exposure decision and final financial migration approval. Exposed schemas are now owner-confirmed. Do not execute proposals as a batch.
2. Separately approve the independent operations migration and controlled hosted integration fixtures. Then verify catalogs and decide read/write/public-content activation; public inquiry collection also needs privacy/retention/abuse review.
3. Approve secure trainer Auth/SMTP/redirect configuration and controlled recipients/accounts; test real active/inactive/cross-trainer sessions afterward.
4. Supply approved studio contacts, location, program/teacher introductions, assets and document footer/signatory content through the activated settings workflow.
5. Complete authenticated new-module browser acceptance, print/PDF acceptance, backup rehearsal and dependency review; separately approve hosting/deployment.

No production SQL, production records, Auth settings, accounts, invitations, real financial operations, notifications or deployment were performed. No new phase prompt is needed; unresolved access/approval gates are the remaining dependencies, not a reason to rebuild completed code.
