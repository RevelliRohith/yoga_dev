# Stage 3C - Admin Trainer Management

## Completed scope

Added /admin/trainers, /admin/trainers/[id], and /admin/trainers/[id]/edit to the existing protected admin route group. Sidebar and dashboard links lead to Trainers. The responsive list includes full name, phone, specialization, qualifications, years of experience, active status and assigned batches. It supports name search, status filters, pagination, summary cards, loading/error states and a deliberate empty state. No invitation or account-creation control is offered in this stage.

Profile editing supports all seven requested profile/status fields. Optional values are stored as NULL; experience is a whole number from 0 to 100. Server-side validation enforces field lengths, phone syntax, UUIDs and edit fingerprints. The role, UUID, photo_path and Auth account are not editable. Confirmation is required for deactivation, which preserves assignments and Auth users.

Each profile lists its assigned batch schedule and supports individual unassignment. The assignment form lists existing batches, marks inactive batches and batches currently assigned elsewhere, and requires explicit confirmation before reassignment. An optimistic previous-trainer predicate rejects stale changes. There are no multi-step bulk updates that can partially succeed. Success messages appear only after the database confirms the changed row. Forms disable while pending and display safe errors.

New assignments require an existing active trainer. Existing inactive assignments remain visible and can be retained or unassigned. The existing Batch save action now enforces this rule too, while allowing edits that retain the same inactive trainer. The existing Batch dropdown can still list inactive profiles; the server rejects selecting one for a new assignment and gives a field error.

## Security and data boundaries

Every public loader and server action invokes requireAdmin before database access. The existing protected layout adds page protection. Requests use the normal cookie-based Supabase client and existing RLS, never service-role credentials. Trainer queries and profile updates are constrained to role = trainer. Update allowlists cannot change role, UUID, credentials or photo_path. Profile edits use original-value predicates including NULLs to avoid overwriting concurrent edits.

Active status is checked before assignment; an administrator can still change trainer status concurrently with another administrator's assignment request. This stage does not introduce a cross-table database transaction or change RLS to serialize those independent operations. Deactivation's database helper blocks trainer access regardless of retained assignments; refresh views after concurrent administrative changes.

No migrations, RLS changes, Auth API calls, invitations, real trainer accounts or production record changes were made. photo_path remains optional and untouched; uploads, student logins, attendance and trainer dashboard are outside this stage.

## Files

- src/lib/admin/trainers.ts: trainer types and profile validation.
- src/lib/admin/trainer-data.ts: authorized list/detail loaders, paginated batch lookups and edit fingerprints.
- src/app/admin/(protected)/trainer-actions.ts: authorized conditional profile/assignment saves.
- src/app/admin/(protected)/trainer-forms.tsx: responsive profile and assignment forms.
- src/app/admin/(protected)/trainers/: list, detail, edit and loading routes.
- src/app/admin/admin-navigation.tsx and (protected)/page.tsx: navigation links.
- src/app/admin/admin.css: trainer list/detail/form styling using the existing palette.
- (protected)/management-actions.ts: active-trainer validation for new Batch assignments.
- tests/trainers.test.mjs and tests/management.test.mjs: authorization, allowlist, conflict, assignment and regression coverage.

## Validation

TypeScript, ESLint, production build and all 33 regression tests passed. Tests use the real PostgREST query builder with an in-memory transport; no Supabase records are written. Tests cover authorization before any query, role-tampering exclusion, optional fields, stale profile saves, NULL predicates, explicit deactivation, inactive assignment refusal, confirmed reassignment, unassignment, stale assignment conflicts, literal search filtering and safe permission failures. Existing Auth/Programs/Batches tests continue to pass. Production build includes the three new trainer routes.

These results do not replace authenticated live profile-write tests. No trainer accounts exist, and no production modifications were authorized. Live edit/assignment/deactivation and trainer-session tests remain pending separately approved onboarding/test arrangements.

Live local HTTP checks without cookies also passed: the trainer list, detail and edit URLs each returned HTTP 307 to /admin/login. No trainer profile or batch assignment was accessed or changed by these probes.

## Manual read-only review now

1. Sign in with the existing administrator at http://localhost:3000/admin/login.
2. Open Trainers in the sidebar or the dashboard link. With no trainer profiles, expect zero summary counts and the onboarding-stage empty-state explanation. There is no Add Trainer or public signup flow.
3. Try a name search, Active/Inactive filters and Reset. Check desktop and mobile widths; Programs and Batches should remain available.
4. Sign out and open /admin/trainers directly; expect redirect to admin login.

After a separately approved existing trainer fixture is available, review profile/details, cancel editing without saving, and confirm assigned schedules. Saving, toggling status, reassigning or unassigning changes real records and should only be tested against explicitly approved test records. For conflict testing open the same record twice, save once, then verify the older form is rejected. Do not create profiles independently of Auth users to manufacture fixtures.

## Next boundary

Stage 3D requires separate approval. It must review secure invitation configuration, server-only privileged credentials, redirect/site URLs, signup policy and partial-failure handling before creating accounts or sending invitations. Stage 3E trainer dashboard and Stage 3F trainer-session tests are not implemented here.
