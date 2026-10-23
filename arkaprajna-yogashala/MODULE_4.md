# Phase 4 - Administrator student management

## Implemented scope

Added /admin/students list, registration, profile, edit and filtered CSV export in the existing protected route group. Sidebar/dashboard navigation includes Students; the admin overview now reads actual total/active student counts instead of its earlier placeholder. No student login, attendance or destructive delete action was introduced.

Registration uses the existing students fields: full name, optional date of birth/gender/mobile/email/guardian details/address, program, batch, joining date and active/inactive status. A studio code AY-YYYY- followed by ten random hexadecimal characters is generated on the server, never accepted from client input and immutable on edit. The verified existing student_code UNIQUE constraint is authoritative; duplicate submissions/collisions return a safe failure instead of inserting again. Codes are not sequential and a collision does not silently rewrite another record.

The list supports name/code/mobile search, program/batch/status filters, deterministic server-side pagination and total/active/inactive summary counts. It projects only fields needed in the table. Student profiles show private registration/enrollment details only to administrators. Fees/receipt history explicitly remain unavailable until the financial module exists; no balance is fabricated.

Editing uses a fingerprint and original-value/NULL predicates to detect stale changes. Program, batch or status changes require confirmation. New enrollments require active choices; existing enrollments may retain the same inactive references. Batch must belong to the selected program. Deactivation preserves all records and relationships. Save success is shown only after a returned row confirms the mutation.

## Privacy, validation and security

Every public loader, save action and CSV endpoint requires a verified admin before accessing the database. Reads/writes use the normal Supabase session and existing RLS. No secrets, new policies, triggers, tables or migrations were added. Trainer data code remains separate and uses only approved RPCs with the six-field roster; no student contact fields were added to trainer output.

Validation enforces real calendar dates, nonfuture DOB, required joining date, email syntax, field lengths, UUIDs, active/inactive values and enrollment relationships. Optional fields become NULL. Indian mobile numbers are normalized to +91 plus ten digits starting 6-9; other-country numbers are not supported by this stage and should be reviewed before accepting international enrollment.

Search terms are quoted for PostgREST OR grammar and wildcard characters escaped. CSV export applies current filters, returns only student code, name, program/batch IDs, joining date and status, and excludes contact, guardian, DOB and address fields. It is authorized separately, no-store, UTF-8 with BOM, and escapes CSV delimiters and spreadsheet-formula prefixes. Enrollment UUIDs are exported as identifiers rather than assuming names are unique. No export is public or available to trainers.

Existing database constraints preserve referential integrity; program/batch matching is additionally checked by the action. There is no new cross-table lock/transaction: concurrent admin changes to a batch's program after validation can require subsequent enrollment reconciliation. No schema change was made to eliminate that pre-existing cross-table race without approval.

## Validation performed

Final TypeScript, ESLint, production build and all 58 regression tests passed, including after the incomplete-choice guard refinement. Tests use in-memory responses rather than production writes. New coverage includes date/mobile validation, required admin before list/detail/save/export, code generation/duplicate refusal, forged code/role exclusion, enrollment mismatch/inactive choices, explicit consequential-change confirmation, stale saves and NULL predicates, filtered CSV allowlist/formula protection and safe provider failures. Existing admin, trainer management, onboarding and trainer dashboard tests pass.

Live local list/new/detail/edit/export requests without cookies all returned HTTP 307 to /admin/login. The existing anonymous security runner also passed again against the real Supabase project through the supported working connection: four tables returned zero visible rows and both trainer RPCs denied execution. No real student rows were created, edited, deactivated, deleted or exported by the agent. Logged-in read/write behavior requires owner review and an explicitly approved fictional fixture for mutations; these are not claimed as live passes.

## Files

- src/lib/admin/students.ts and student-data.ts: types, validation, filters, CSV escaping and authorized queries.
- src/app/admin/(protected)/student-actions.ts and student-forms.tsx: validated conditional saves and responsive form.
- src/app/admin/(protected)/students/**: list, new, detail, edit, export and loading routes.
- src/lib/admin/data.ts, admin/(protected)/page.tsx and admin-navigation.tsx: real dashboard counts and navigation.
- admin.css: summary/export styling. tests/students.test.mjs and updated management tests.

## Manual owner review

1. Sign in to http://localhost:3000/admin/login and open Students. Check loading/empty/error behavior and desktop/mobile layout.
2. Inspect search/filter/reset, summary counts and enrollment names without sharing records in chat. Opening registration creates no record; cancel without saving.
3. Only with separately approved fictional test data, register, edit, move enrollment, deactivate/reactivate, verify stale-form rejection and duplicate-submission handling. No student Auth account should be created. Do not use production PII unnecessarily.
4. CSV download includes student names/codes, so export only an approved filtered view to your private device. Confirm excluded sensitive fields and formula escaping with fictional records. No export was downloaded during development.
5. Sign out; list/detail/edit/new/export URLs must redirect to admin login. Trainer-session denial remains in the Stage 3F matrix.

## Next dependency

Phase 5 fee storage has not been inspected. Run the prepared schema-only phase_5_inventory_readonly.sql or provide equivalent metadata; the agent will handle the export automatically. No existing fee/payment tables will be replaced or duplicated. A minimum reviewed migration, actual due-date policy and explicit migration/merchant/test-transaction approval are required where applicable before live finance behavior is implemented or enabled.
