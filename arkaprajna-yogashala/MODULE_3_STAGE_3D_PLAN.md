# Stage 3D - Secure trainer onboarding inspection and plan

Status update: the user confirmed Stage 3C manual verification passed. Stage 3D implementation is now complete in code; see MODULE_3_STAGE_3D_REPORT.md for actual checks and configuration gates. Onboarding remains disabled pending separately approved configuration. No accounts, email invitations, database records, Auth settings or migrations have been changed. The plan below records the inspected architecture and approval boundaries.

## Inspection findings

The application uses Next.js App Router server actions and requireAdmin, which verifies Supabase Auth identity and public.profiles role on the server. The existing protected admin route group and session-refresh proxy cover /admin. Stage 3C provides trainer profile/assignment management with explicit field allowlists, trainer role predicates and stale-edit protection. There is currently no invitation acceptance or password setup route.

The verified profiles.id foreign key references auth.users(id) with ON DELETE CASCADE. There is no Auth creation trigger, so onboarding must explicitly insert a matching profile. Existing fields cover the requested trainer information. No additional application tables, profile columns or RLS changes are proposed. Stage 3B restrictive student/program policies, fixed six-field roster and active-status helper must remain unchanged.

Only the public Supabase URL and publishable key are currently configured. No server-only onboarding secret, canonical site URL or onboarding enable flag is configured. Earlier inspection reported public signup enabled; current live settings must be rechecked before enabling onboarding. Merely hiding public signup UI is insufficient for invitation-only registration.

## Implementation plan after Stage 3C confirmation

1. Add an admin-only Create Trainer form and action with the existing visual conventions and shared trainer validation plus email validation. Hardcode role trainer and active true on the server. No password input in admin forms.
2. Isolate Auth Admin operations in a server-only module. Use a separately instantiated Supabase client without cookie storage, session persistence or auto-refresh. Require verified admin authorization before any privileged call. Never forward credentials, provider responses or generated login links to the browser.
3. Create an unconfirmed Auth identity without a password or email delivery, using trusted app_metadata to identify this application's onboarding attempt and retain a minimal recoverable profile draft. Insert the matching profile through the administrator's ordinary RLS-protected client. Only after the profile is confirmed should inviteUserByEmail send the invite. Supabase's current upstream invite handler supports existing unconfirmed users; this behavior must also be confirmed in controlled testing of the hosted project. Do not change email confirmation to bypass conflicts.
4. Detect duplicates through Auth Admin queries and the Auth email uniqueness constraints. Never adopt arbitrary existing users, overwrite administrator accounts, promote roles, delete users, or replace UUIDs. Paginate Auth lookup rather than silently truncating results. Recover only attempts bearing this server-written app_metadata marker; client-editable user_metadata is not authorization evidence.
5. Handle Auth/profile/email as separate operations with explicit pending states. Preserve identities on failure; never delete as compensation. Retry profile creation only for the same trusted UUID, without overwriting a subsequently edited profile. A duplicate or timeout with uncertain ownership must fail closed for administrator reconciliation. There is no cross-service atomic transaction; report partial progress honestly.
6. Provide explicit admin retry/recovery actions for verified linked trainer identities. Reinvite only unconfirmed accounts; confirmed trainers use a separate password-recovery email. Do not expose passwords or login links. Provider throttling must surface a safe retry message; exact email delivery is not proved by API acceptance.
7. Add a narrow public invitation/recovery verification and password-setup flow, using one-time token hashes and verified server-side identity plus a matching active trainer profile. Restrict accepted token types and redirects; do not accept arbitrary next URLs. Avoid consuming tokens on email-scanner GET requests; use an explicit confirmation step. Ensure sensitive token URLs are not placed into logs, analytics, UI messages or reports, and use no-store/referrer protections. Password setup uses the trainer's own authenticated session, never an administrator-selected password. Do not implement a trainer dashboard or student login in this stage.
8. Add mock/in-memory tests for unauthenticated/non-admin denial, configuration failure, duplicate and partial-failure paths, allowlists, UUID linkage, retries, password-setup identity checks and token/secret suppression. Run TypeScript, ESLint, existing and new regressions, and production build. Defer real account creation, messages and trainer-security fixtures until separate explicit approval.

## Proposed local/deployment configuration

- SUPABASE_SECRET_KEY: privileged Auth Admin credential from the SAME project, server-only and never NEXT_PUBLIC. A legacy service-role fallback should be supported only if deliberately selected and validated. Do not send either credential in chat or commit it.
- APP_SITE_URL: fixed canonical application origin. Development may use http://localhost:3000; production requires HTTPS. Never derive security redirects from a request Host header.
- TRAINER_ONBOARDING_ENABLED: disabled by default; enable only after approved configuration review. Missing configuration must render a clear unavailable state and fail closed before writes.

These names are proposed, not secrets that have been created or installed. Any example file must contain names/placeholders only. Existing .env files are ignored by Git.

## Changes requiring separate explicit approval

- Configure the server-only secret locally and in deployment through a secure user-controlled mechanism.
- Disable public signup for invitation-only onboarding after checking existing admin sign-in remains unaffected.
- Set Site URL and exact redirect allowlist; review invite/recovery templates for the chosen token-hash flow.
- Verify SMTP availability: Supabase's built-in sender restricts recipients; studio trainer delivery commonly requires configured custom SMTP. Do not add a paid service automatically.
- Create a specific controlled test identity, send its invitation/recovery mail, and write its linked trainer profile. No real student records should be used for security fixtures.

No database migration is currently required. If implementation reveals a genuine schema requirement, stop and explain it rather than applying a migration.

## References reviewed

- https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail
- https://supabase.com/docs/reference/javascript/auth-admin-generatelink
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/auth/auth-smtp
- https://raw.githubusercontent.com/supabase/auth/master/internal/api/invite.go
- Installed @supabase/auth-js GoTrueAdminApi source and installed Next.js server-action documentation.

Stage 3E and later remain outside this approval. The next required input is the Stage 3C manual review result, not an account credential or permission to create users.
