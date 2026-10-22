# Administrator access

Open http://localhost:3000/admin/login with `npm run dev` running. Use an existing Supabase administrator email/password; no accounts or credentials are created by this change.

## Authorization

- The existing Supabase server client handles login and logout in Server Actions. Passwords, tokens, keys, and raw provider error messages are never logged or returned. Development errors include only the failed stage, safe code, numeric HTTP status (when supplied), and public project hostname. Production keeps generic errors.
- `src/proxy.ts` refreshes and validates auth tokens on `/admin/:path*`, propagates refreshed cookies to the request and response, and prevents caching of admin responses.
- `src/lib/supabase/admin.ts` calls Auth `getUser()` and queries `public.profiles.role` using `profiles.id = user.id`. Missing profiles, query errors, and all roles except `admin` fail closed. This assumes the existing profiles table uses its `id` as the Auth user ID; if it uses a different foreign key, update the lookup to that existing column.
- The protected route group checks authorization in its layout and dashboard page. Login remains outside that group. Every future privileged action, handler, and page must call `requireAdmin()` itself before reading or changing data; layouts and proxy alone are not authorization boundaries.
- Supabase RLS remains in force using the existing publishable key and user session. No service-role key or database/policy changes are introduced. Existing RLS must permit administrators to read their own profile and prevent users from elevating their own role.
- Logout is a CSRF-checked Server Action using local scope (the current browser session), with an explicit error state if sign-out fails.

## Manual acceptance checks

1. In a private window, visit `/admin` directly. Expect a redirect to `/admin/login` and no dashboard content.
2. Submit an incorrect password. In development, expect a specific password sign-in error with provider code and status; in production, expect a generic error. The retry button should become enabled.
3. Sign in as an existing admin. Expect `/admin`, sidebar, account email, and three clearly marked placeholder cards.
4. Refresh `/admin` and confirm access persists. After the access token expires, request `/admin` again and confirm session refresh works.
5. Sign out, then request or refresh `/admin`. Expect the login page. Browser back navigation must not permit further protected server requests.
6. With an existing non-admin account, attempt login. Expect access denied. A non-admin session visiting `/admin` directly must also be denied.
7. With a test account whose profile is absent, verify denial. A profile query/RLS failure must also deny access. Do not change production policies to test this.
8. Check mobile and desktop widths, keyboard focus, form labels, pending state, and error announcements.

## Investigating password login

The form invokes a Server Action, which calls `signInWithPassword({ email: email.trim(), password })`. Password whitespace is preserved. The installed SDK sends `POST /auth/v1/token?grant_type=password`; this flow does not use recovery `/verify` URLs.

The configured project was verified as `ogzdhmptzeyinhgxcgii.supabase.co`, matching the intended project. A read-only `/auth/v1/settings` request with the configured publishable key returned HTTP 200, with email authentication enabled. No account credentials were used in that probe.

The reported real login diagnostic was `code=not_provided` with no HTTP response status. This is a transport failure, not an observed `invalid_credentials` response. A controlled probe from the restricted execution environment failed with `EACCES`; the network-enabled probe succeeded. This identifies an environment permission problem in the restricted probe and is consistent with the login symptom. The app now includes an allowlisted transport code when available so the actual Next.js process can confirm its underlying cause. No password verdict can be made until a password request receives a response.

1. Stop the existing development server with Ctrl+C in its terminal. Start `npm.cmd run dev` from a regular local VS Code/PowerShell terminal with outbound network access. A server launched inside a restricted agent environment may inherit network restrictions. Restart after changing environment configuration; public values are inlined by Next.js.
2. Open http://localhost:3000/admin/login and confirm the displayed development project hostname.
3. Submit credentials once. In browser Network tools, expect the Server Action POST to `/admin/login`. The Supabase `/token` request happens on the Next.js server, so it will not appear as a direct browser request. Check Supabase Auth logs in the intended project at the same time.
4. Read the development error stage, provider `code`, and HTTP status. If there is no HTTP response, read the transport code: `EACCES`/`EPERM` means runtime network permissions, `ENOTFOUND` means DNS, and certificate codes indicate TLS trust issues. Do not disable certificate validation. Fix the runtime/network path before drawing conclusions about credentials.
5. Once a response arrives, `invalid_credentials` means the credentials were rejected for this project; `email_not_confirmed` means email confirmation is required. A profile lookup or role-verification error means password authentication already succeeded. A missing profile may also mean RLS hid the row; the application cannot distinguish those cases from an empty query alone.
6. On success, verify the `/admin` redirect, reload persistence, and logout. Cookie names use Supabase's `sb-<project-ref>-auth-token` convention (possibly chunked). Inspect names and attributes only; do not copy values into chat or logs. Use one hostname consistently (`localhost` versus `127.0.0.1` have separate cookies).

The server client now requires cookie writes in login/logout actions instead of silently swallowing write failures. Profile authorization reuses that same client and still verifies the Auth user and `profiles.id = user.id` with `role = 'admin'`. Proxy refresh, private/no-store responses, and page/layout authorization remain in place. No authenticated session cookie or live profile result was available for inspection during this investigation.

Checks: `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/eslint/bin/eslint.js .`, and `node --test tests/admin-auth.test.mjs`. Tests use mocks, not real accounts or credentials.

## Dependency warnings

`npm audit --json` was attempted both in the sandbox and with elevated network permission. The npm advisory endpoint failed (TLS connection disconnected), so no current vulnerability count or affected-package claim can be made. No dependency versions or lockfile were changed.

When registry connectivity is available, run `npm audit` and `npm audit --omit=dev`. Review each advisory and its dependency path with `npm explain <package>`. Prefer explicit compatible patch/minor updates to affected direct packages or the parent of a vulnerable transitive dependency. Keep `next` and `eslint-config-next` versions aligned and `react` and `react-dom` aligned. Review the lockfile diff, then rerun lint, TypeScript, build, and the login/logout checks. Do not use `npm audit fix --force`; major upgrades require a separate compatibility review.
