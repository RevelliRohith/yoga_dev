# Stage 3E - Trainer workspace

Implemented /trainer/login, /trainer, /trainer/profile and /trainer/roster in the existing application. A dedicated trainer shell uses the approved ivory/green styling with responsive navigation, overview cards, batch schedules, profile display, searchable/paginated assigned roster, loading/error/empty states and secure local logout.

Every protected layout/page/data loader verifies the current Auth identity and current profiles role/is_active on the server. Active trainers proceed; admins are directed to /admin; anonymous, missing, inactive and unverifiable profiles are denied. Trainer login verifies after signInWithPassword and clears denied sessions. The existing admin login/action remains intact. An administrator using the trainer login is directed to /admin. The refresh proxy now includes /trainer routes with no-store headers.

Trainer data uses only trainer_dashboard_batches and trainer_student_roster, with no trainer-ID parameter, service key or direct student/program reads. Exact-count, deterministic pagination handles the API row cap. Roster selects exactly id, student_code, full_name, program_id, batch_id, status. Unexpected output fields, duplicate IDs, unknown assignment IDs, missing totals or failed requests produce an error instead of partial/private data or zero totals. Batch filters must match the returned assigned IDs; other IDs produce not found. Names and dates render as text; trainer profiles have no edit controls.

Tests added in tests/trainer-dashboard.test.mjs cover current active-role checks, redirects, no-argument RPC use, approved roster columns, failed contracts/assignment bounds and login cleanup. Stage 3E checkpoint: TypeScript PASS, ESLint PASS, all 50 tests PASS, production build PASS. Local unauthenticated /trainer, /trainer/profile and /trainer/roster returned 307 to /trainer/login?reason=anonymous; /trainer/login returned 200. Later Phase 4 checks are recorded separately.

No migrations, accounts, real email or production writes were executed. Onboarding activation remains disabled. Actual active/inactive and cross-trainer sessions remain pending Stage 3F approval and controlled fixtures; a mocked test is not a real-session pass. Phase 3 must not be marked fully complete until those tests finish.

Key files: src/lib/supabase/trainer.ts; src/lib/trainer/dashboard.ts; src/app/trainer/**; src/proxy.ts; tests/trainer-dashboard.test.mjs. Existing onboarding completion links now point to the implemented workspace.

Manual review: visit http://localhost:3000/trainer/login without credentials to review the login; open protected trainer URLs while signed out to confirm denial. After controlled-account approval, verify own batches, program names, counts, roster search/batch filters and read-only profile; refresh and deactivate/reactivate through the approved admin test arrangement. Never use real student personal data unnecessarily.
