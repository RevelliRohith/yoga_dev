# Arkaprajna Yogashala

Existing Next.js 16 App Router, TypeScript, Tailwind and Supabase studio application.

## Run locally

Use the existing project directory and installed Node environment. Install the lockfile dependencies with `npm.cmd ci` when necessary, then `npm.cmd run dev`. Reuse an existing development server if Next reports one is already running; do not terminate unrelated Node processes.

- Public website: http://localhost:3000/
- Administrator: http://localhost:3000/admin/login
- Trainer: http://localhost:3000/trainer/login

Existing local Supabase publishable configuration belongs in .env.local. Do not paste keys, passwords or session tokens into issues/chat. Privileged keys must never use NEXT_PUBLIC variables. No student login or attendance module exists.

## Current scope and activation

Admin Programs/Batches/Trainers/Students and restricted trainer dashboard are implemented. Fee, inquiry, events, certificate, reminder, report and settings code is prepared with explicit unavailable/read-only states until approved persistence/configuration is active. Public pages contain no invented studio contact, teacher or pricing details.

Read MASTER_DEVELOPMENT_STATUS.md and PROJECT_COMPLETION_REPORT.md for actual implemented/tested/pending distinctions. Passing a build does not mean migrations or live workflows are approved. Financial and operations write flags, public collection and trainer invitations are currently disabled.

## Checks

```powershell
npx.cmd tsc --noEmit
npm.cmd run lint
node --test tests/*.test.mjs
npm.cmd run build
```

New tests mock API calls and do not create production records. The 38 financial and 19 operations isolated PostgreSQL groups are documented separately. The remaining development dependency advisory is recorded in SECURITY_AND_QA_REVIEW.md; do not run audit fix --force or downgrade Next tooling blindly.

## Database and deployment

SQL files under supabase/review are review artifacts, not automatic migrations. Never run all files in that directory. Completed grant/trainer migrations must not be rerun. Read PHASE_5_PRODUCTION_READINESS.md and STUDIO_OPERATIONS_DATABASE_REVIEW.md for separate proposal, verification and recovery gates. No production financial or operations migration has been applied.

Ignored baselines contain private review evidence and are not backed up by Git. Preserve them in restricted off-site storage. Metadata is not a production data backup. Next builds clear .next; never store durable backups, credentials or evidence there. The current disposable cluster and test-only tools live under ignored supabase/review/baselines, separate from builds and application configuration. See STUDIO_OPERATIONS_ISOLATED_TEST_REPORT.md for lifecycle and cleanup.

DEPLOYMENT_AND_OPERATIONS.md documents server-only configuration names, commercial hosting considerations, Auth redirects, backups, operator workflows and release approvals. No deployment, DNS change, payment gateway or automatic messaging is enabled.
