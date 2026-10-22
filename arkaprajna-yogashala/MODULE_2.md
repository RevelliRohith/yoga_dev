# Yoga Programs & Batch Management

The existing Next.js application now includes programs and batches management within its protected administrator route group. Authentication, Supabase configuration, database schema, RLS, and existing records are unchanged. No dummy records were inserted.

## Routes and files

| Route | Purpose |
| --- | --- |
| `/admin` | Real total and active program/batch counts; Students remains a placeholder |
| `/admin/programs` | Program list, name search, status filter, totals, and pagination |
| `/admin/programs/new` | Create a program |
| `/admin/programs/[id]/edit` | Edit or deactivate an existing program |
| `/admin/batches` | Batch list, name/status/program filters, readable schedules, and pagination |
| `/admin/batches/new` | Create a batch with active program and optional trainer |
| `/admin/batches/[id]/edit` | Edit or deactivate an existing batch |

- `src/lib/admin/management.ts`: shared types, form validation, filters, INR/time/weekday formatting.
- `src/lib/admin/data.ts`: authorized reads, minimal program/trainer options, count queries, safe errors, and edit fingerprints.
- `src/app/admin/(protected)/management-actions.ts`: authorized create/update operations and business-rule checks.
- `src/app/admin/(protected)/management-forms.tsx`: responsive controlled forms, field errors, pending state, deactivation confirmation.
- `src/app/admin/(protected)/management-ui.tsx`: shared headings, summaries, filters, statuses, pagination, and empty/error states.
- The six program/batch route pages provide list/create/edit screens.
- `src/app/admin/admin-navigation.tsx`, protected `layout.tsx`, dashboard `page.tsx`, and `admin.css` integrate the module with the existing shell.
- `tests/management.test.mjs`: isolated validation and mutation tests using the real Supabase/PostgREST client with an in-memory HTTP transport. No live account credentials or database writes are used.

## Database compatibility and rules

The implementation uses the supplied program and batch columns, UUID record IDs, existing relationships, and confirmed `profiles.full_name` text column. `days_of_week` is the confirmed PostgreSQL `text[]`, with full English names such as `Monday` and `Wednesday`. Only `role = 'trainer'` profiles are offered or accepted as trainers. Trainer queries select only ID and full name; contact details and student records are never fetched by this module.

- Every list/form read and every mutation calls the existing `requireAdmin()` helper. Actions do not trust client role or dropdown values. Queries use the existing authenticated server client and RLS, with no service-role key.
- Names are trimmed and required (maximum 150 characters). Descriptions are optional (maximum 5,000 characters). Fees must be nonnegative decimal INR amounts with at most two decimal places; zero is accepted. Existing database constraints still apply.
- Batches require an existing program, valid same-day start/end times, and at least one weekday. End must follow start. There is no overnight scheduling. The UI interprets times as studio-local wall-clock times.
- New batches and changed program assignments require an active program. An existing batch may retain its current inactive program while other details are edited.
- A trainer is optional. If supplied, the action verifies that the current referenced profile still has role `trainer`. A previously assigned profile that no longer qualifies must be replaced or cleared.
- Deactivation requires an explicit confirmation checkbox, enforced on the server as well as in the form. It changes only `is_active`; no deletions, cascades, student updates, or automatic batch deactivations are performed. Records can be reactivated by editing their status.
- Pending buttons disable repeated clicks, and each create form uses a stable UUID as the inserted primary key so replaying that form cannot create a second row. A duplicate response tells the user to inspect the list before retrying. Identical names are not globally prohibited; adding a database uniqueness rule would require a separately approved schema change.
- Edit fingerprints and conditional updates detect stale/concurrent edits. Reopen the edit page before retrying a conflict. References are rechecked immediately before writes, and foreign keys remain the database authority. Since these use existing REST operations rather than a new transactional RPC, a concurrent program deactivation or trainer-role change can occur between the reference check and the write. Strict cross-table transactional enforcement would require a separately reviewed database change.
- Lists are paginated (20 per page). Program/trainer choices are fetched in pages to avoid silently truncating at the REST row limit. Read failures display errors rather than fake empty results or zero counts.

## Validation results and limitations

TypeScript, ESLint, production build, and the automated authentication/management tests were run. Production build includes all six new routes. Local unauthenticated HTTP requests to the dashboard and all new list/create/edit routes returned 307 redirects to `/admin/login` with `Cache-Control: no-store`; login returned 200.

Live authenticated mutations, actual trainer/profile visibility under your RLS policies, persistence after refresh, mobile/desktop visual review, and login/logout through a real browser require manual verification. No connected browser was available, and no live programs or batches were inserted for testing. The database REST metadata endpoint returned 401 to the publishable-only metadata probe, so weekday/name compatibility follows your explicit schema confirmation rather than an unauthenticated schema inspection.

## Manual acceptance checklist

Run `npm.cmd run dev` in your normal local terminal. Keep the existing server if already running; do not start a second copy on port 3000.

1. In a private browser window, open `/admin/programs`, `/admin/programs/new`, `/admin/batches`, and `/admin/batches/new`. Confirm each redirects to login. Sign in with the existing administrator.
2. Open http://localhost:3000/admin/programs. Verify all actual records, including inactive ones, are available through pagination; summary counts are unfiltered totals. Search a name, apply each status filter, and reset.
3. Create a program you intend to keep, with a description and monthly fee. Confirm the success message, INR formatting, dashboard counts, and persistence after refresh. Verify a zero fee works. Test blank name, negative fee, and more than two decimal places; invalid inputs must not save.
4. Edit that program. Open the same edit page in two tabs, save one, then try saving the old form in the other tab; expect a conflict rather than an overwritten record.
5. Change an active program to inactive. Confirm the checkbox is required. Save, verify it remains visible under Inactive, and confirm no related records disappear. Reactivate as needed.
6. Open http://localhost:3000/admin/batches/new. Confirm only active programs appear. Trainer names must match existing trainer profiles; admin/student profiles and private contact details must not appear. No trainers is valid: leave Unassigned.
7. Create a real batch with a program, optional trainer, ordered start/end times, and multiple weekdays. Verify name, program/trainer names, readable schedule, success message, dashboard count, and persistence after refresh. Check Supabase stores full weekday strings in `days_of_week`.
8. Try blank batch name, no program, no weekdays, equal times, reversed times, and an overnight interval. All must be rejected. Server tests additionally cover malformed IDs and references to unavailable/ineligible records.
9. Edit a batch and change its schedule/trainer; verify persistence. Deactivate it with confirmation, filter for inactive batches, then reactivate. An existing batch may keep its current inactive program, but cannot be reassigned to another inactive program.
10. Double-click a create submission; verify only one row is created. If a network error says the save was not confirmed, inspect the list before opening a fresh create form.
11. Check narrow/mobile widths, horizontal table scrolling, keyboard navigation, field labels/errors, active sidebar links, refresh persistence, and sign-out. After logout, directly request the protected pages again and confirm login is required.

Commands:

```powershell
node node_modules/typescript/bin/tsc --noEmit
npm.cmd run lint
npm.cmd run build
node --test tests/*.test.mjs
```
