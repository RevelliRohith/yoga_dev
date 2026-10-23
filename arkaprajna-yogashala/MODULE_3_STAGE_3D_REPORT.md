# Stage 3D - Secure trainer onboarding

Later continuation: Stage 3E trainer workspace and Phase 4 student-management code are now implemented. See MASTER_DEVELOPMENT_STATUS.md for the latest status. The Stage 3D configuration/live-test gates below remain unchanged and onboarding is still disabled; the test counts here record the historical Stage 3D checkpoint.

## Status

Stage 3C manual review was confirmed Passed by the user. Stage 3D code is implemented and validated. Live onboarding is NOT enabled: no privileged key, canonical site URL or enable flag was installed. No migration, RLS change, Auth setting change, account creation, invitation/recovery email or production record mutation was performed by the agent. Stage 3E has not begun.

## Implemented behavior

- Create Trainer navigation and /admin/trainers/new collect full name, email, phone, specialization, qualifications, biography and optional years of experience. Admin forms never collect a trainer password.
- Shared validation enforces email, names, phone syntax, lengths and experience range. Role trainer and active true are assigned on the server, regardless of submitted role/status.
- Every onboarding mutation and Auth status lookup first calls requireAdmin. Direct unauthenticated/non-admin requests fail before privileged clients are created. Ordinary profile operations use the existing administrator session and RLS; Auth Admin calls are isolated in a server-only client with no persistence, cookie storage or auto-refresh.
- The workflow checks for duplicate email, creates an unconfirmed Auth identity without a password, links the returned UUID to profiles, and then requests the invitation. The existing Auth FK is reused; no standalone profile UUID is manufactured.
- Only a trusted Auth app_metadata marker identifies recoverable attempts. Client-editable user_metadata is ignored for authorization. Initial pending profile details are retained in that protected marker until linkage succeeds, then removed. Unexpected existing users, admin profiles and inactive profiles are never adopted/overwritten as new trainers.
- Partial failures retain the Auth identity and offer explicit repair/retry for the same UUID. Repair does not send email. No compensation deletes users or resets UUIDs. A linked profile can be managed with existing Stage 3C assignments even if delivery fails.
- Unconfirmed owned accounts offer invitation retry; confirmed active owned trainers offer an explicit password-recovery email. A stored one-minute email-attempt cooldown and provider throttling limit accidental retries. Metadata/email operations are not a distributed atomic transaction, and concurrent email requests may still race. A timeout or provider acceptance does not establish mailbox delivery; messages explain this uncertainty rather than claiming exactly-once delivery.
- Public /auth/trainer/confirm uses an explicit Continue action, not GET verification. Proposed emails place token_hash/type in a fragment, which is not sent in HTTP request URLs. The client removes that fragment when submitting, and verification accepts only invite/recovery plus a hash. No token/link is displayed in an admin response, error, log or report.
- /auth/trainer/password requires a verified current user, a matching active trainer profile and the server-owned onboarding marker. Password save uses that trainer's own session, validates a matching 12-128 character password and never returns it in action state. Supabase may apply additional configured password requirements. The completion flow offers local sign-out; it does not implement the trainer dashboard.
- SSR refresh/no-store headers now also cover /auth/trainer routes. The setup layout has noindex/nofollow and no-referrer metadata. Redirects use fixed paths and an explicitly configured origin, never request Host or an arbitrary next parameter.

## Configuration requiring approval before activation

No database migration is needed. Existing profiles columns, Auth FK, RLS, admin policies and trainer RPCs remain intact. Saved before/after snapshot hashes are unchanged.

The app expects these server-only deployment/local variables (no values have been installed):

| Variable | Purpose |
| --- | --- |
| SUPABASE_SECRET_KEY | Supabase Auth Admin operations, from project ogzdhmptzeyinhgxcgii |
| SUPABASE_SERVICE_ROLE_KEY | Optional legacy alternative to the secret key; its role/project claim is checked |
| APP_SITE_URL | Fixed canonical origin; HTTPS in production, loopback HTTP only in development |
| TRAINER_ONBOARDING_ENABLED | Must explicitly equal true after configuration approval; absent means disabled |

Never use NEXT_PUBLIC for privileged credentials, paste them into chat, commit them, or enter them in browser application forms. Existing .env files are Git-ignored. Configure through the local environment/deployment secret manager only. Server-side checks pin the Supabase host and fail before writes if key/origin/enable configuration is invalid.

Before account creation or email requests, the action reads public Auth settings and requires disable_signup = true. Earlier settings inspection showed signup enabled; no live setting change was made. Review and approve invitation-only registration without changing existing admin password login.

Supabase Site URL and exact redirect allowlist must match APP_SITE_URL and APP_SITE_URL/auth/trainer/confirm. Review SMTP and recipient restrictions. Built-in SMTP may only deliver to organization members; custom SMTP may be needed for studio staff. No email provider or paid service was added.

Two un-applied proposed templates are saved in supabase/review/stage_3d_invite_template.proposed.html and stage_3d_recovery_template.proposed.html. They currently branch on the exact development redirect http://localhost:3000/auth/trainer/confirm. Before production use, change the branch to the approved HTTPS origin (or explicitly reviewed exact origins); do not broadly match arbitrary redirects. Trainer links use the fragment flow. Other destinations keep ConfirmationURL so existing administrator/other recovery flows are not redirected to trainer-only setup. Applying these global Auth templates requires explicit approval and a controlled delivery test. Without these templates, the default invite flow is not claimed to work with this new setup page.

## Verification results

| Check | Result |
| --- | --- |
| TypeScript | PASS after regenerating Next route types for the new routes |
| ESLint | PASS, no warnings |
| Regression suite | PASS, 46 tests |
| Production build | PASS, including new admin and setup routes |
| Live anonymous API | PASS: four base tables expose zero rows; both RPCs deny execution |
| Unauthenticated /admin/trainers/new | HTTP 307 to /admin/login |
| Unauthenticated /auth/trainer/password | HTTP 307 to /auth/trainer/confirm |
| /auth/trainer/confirm without a token | HTTP 200 with no-store; opening it does not consume a token |

Tests cover admin denial before access, invalid/disabled input, public-key rejection in privileged configuration, unsafe origins, invitation-only gate, profile UUID linkage, no password in Auth creation, duplicate refusal, untrusted metadata, partial failure repair, admin/inactive preservation, confirmed-account reinvitation denial, cooldown, allowed token types, expired-link safe errors and verified active self-service password changes. All data mutations and emails in the regression suite use in-memory mocks. No real Auth sessions or accounts were created for those tests.

Initial standalone TypeScript errors came from old production-generated route types disagreeing with the new development Auth layout. next typegen regenerated the types; standalone TypeScript and the production build then passed. An initial lint finding in fragment initialization was fixed by reading the fragment only on explicit submission, without an effect-triggered state update.

## Manual read-only testing now

1. Sign in as the existing administrator at http://localhost:3000/admin/login. Open Trainers, then Create trainer.
2. With current configuration, expect a clear configuration-needed message and disabled creation controls. Do not configure a secret or enable flag without the approved setup process.
3. Confirm the existing Programs, Batches and Trainer management remain available. Sign out; /admin/trainers/new must redirect to admin login.
4. Open /auth/trainer/confirm without a link: it must explain that the latest setup link is needed. Continuing without a token must show a safe invalid-link error and create nothing.

## Controlled tests still pending explicit approval

- Approve the exact local/deployment credential setup and Auth signup, Site URL, redirect, template and SMTP changes. Do not share secret values in chat.
- Approve one specifically named controlled recipient account before any create/invite request. Confirm UUID linkage, default role/status, delivered link, explicit confirmation, password setup and subsequent Auth login. No existing admin account should be repurposed.
- Confirm the hosted Supabase version's inviteUserByEmail behavior for an existing unconfirmed identity. Current upstream Auth source supports this, but a mock does not prove hosted behavior. Provider email failure must retain the profile/UUID and permit reviewed repair/retry, without deletion/recreation.
- Verify expired and reused links, confirmed-account recovery, real provider throttling and uncertain-send handling. Recovery destination fallback must preserve administrator recovery behavior.
- Active/inactive trainer data isolation, cross-trainer assigned batches/students, direct private student-column denial and the six-field roster require approved trainer fixtures. These remain Stage 3F tests; use minimal fabricated student fixtures only with separate permission, never real student records unnecessarily.

Stage 3D is implemented but not live-onboarding verified. Do not call those pending tests passed. Stage 3E requires separate explicit approval; it has not started.

## Files and references

Core code: src/lib/supabase/privileged.ts; src/lib/admin/onboarding.ts, onboarding-service.ts and onboarding-data.ts; admin onboarding-actions.ts and onboarding-forms.tsx; admin/trainers/new; auth/trainer setup routes/actions/forms. Existing trainer validation was shared, trainer list/detail integrates create/status/retry, proxy adds setup coverage, and admin.css adds setup styling. tests/onboarding.test.mjs contains new mock coverage. No dependencies were added.

Primary references reviewed: [Supabase invitations](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [SMTP limitations](https://supabase.com/docs/guides/auth/auth-smtp), and [upstream invite handler](https://raw.githubusercontent.com/supabase/auth/master/internal/api/invite.go), plus installed SDK and Next.js documentation.
