# Module 3 — Phase A findings

> Current approval status: the user approved the six-field roster and the principle of blocking inactive trainers, but explicitly did not approve SQL execution. See `MODULE_3_SECURITY_REVIEW.md` for the final review, corrected guarded proposal, rollback, and remaining alternate-access-path inspection. Statements below about the roster awaiting approval are historical; database execution and onboarding remain unapproved.

No application implementation, trainer accounts, invitations, RLS changes, migrations, or Supabase configuration changes have been made in this phase. The existing trainer-field migration must not be rerun.

## Evidence

- User-confirmed database: `profiles.id` references `auth.users(id)` with `ON DELETE CASCADE`; there are no Auth user-creation triggers. The six trainer fields are already applied.
- User-supplied catalog results confirm both role helpers are postgres-owned, STABLE SECURITY DEFINER functions with empty search_path and schema-qualified references. `is_admin()` checks the current user's admin role; `is_trainer()` checks trainer role but omits active status. EXECUTE grants are explicit for postgres, anon, authenticated, and service_role. No helper grant change is proposed.
- User-supplied results confirm RLS enabled and FORCE RLS false on all four tables. Admin ALL policies cover profiles/programs/batches/students; trainer SELECT policies cover assigned batches, all active programs, and students in assigned batches; users may SELECT their own profile. No trainer/self UPDATE policy was shown. Table-level CRUD privileges exist for both anon and authenticated, but the shown policies do not grant anon row access.
- The confirmed students columns include DOB, gender, mobile/email, address, and guardian contacts as well as identifiers/name/status/assignments. Existing trainer row access therefore includes personal fields unless a separate column boundary is introduced.
- Source inspection: admin authorization verifies the Auth user using `getUser()`, then checks `profiles.role`. Server Actions recheck admin access. This existing boundary should be retained.
- Source inspection: session refresh currently matches only `/admin/:path*`; trainer routes will need the same refresh/no-cache coverage.
- Source inspection: batch choices and assignment validation check `role = 'trainer'` but not `is_active`. New assignments should require an active trainer. Existing inactive trainer assignments should remain visible until an admin explicitly changes them.
- Environment inspection showed no configured `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_SITE_URL`, or `NEXT_PUBLIC_SITE_URL`. Values were not printed. Existing `.env*` files are Git-ignored.
- A read-only Auth settings request returned HTTP 200, `emailProviderEnabled: true`, `disable_signup: false`, and `mailer_autoconfirm: false`. Public Auth signup is enabled even though there is no signup UI. This does not confer the trainer role, but requires a configuration decision for invitation-only access.

## Remaining review and proposed security SQL

The user has now supplied the helper definitions/grants, policies, RLS flags, table privileges, and student columns from `supabase/review/module_3_permissions_readonly.sql`. Direct database catalog access is not configured locally, so evidence is based on those supplied results. Profile-protection trigger results have not yet been supplied; existing views/RPCs outside this focused review have not been audited. Do not interpret this as a comprehensive database audit.

The shown profile policies do not permit non-admin updates, so they do not authorize self-promotion or reactivation. The confirmed gaps are inactive-trainer access and column privacy: active program rows expose monthly_fee; assigned student rows expose private contacts and other personal details. Row policies alone do not hide individual columns.

Review-only SQL is in `supabase/review/module_3_trainer_access.proposed.sql`; nothing has been executed. It:

1. Adds `is_active = true` to `is_trainer()` without changing its signature, owner, grants, or `is_admin()`.
2. Adds two restrictive SELECT policies that require admin role for direct programs/students table reads. Existing admin and trainer policies are retained; the restrictions are ANDed with their existing permissive rules. Both admins and trainers use PostgreSQL's `authenticated` role, so revoking table columns for authenticated globally would also affect the working admin modules.
3. Adds two explicitly authorized, read-only SECURITY DEFINER RPCs. Assigned batches include program name and schedule without fees. The student roster returns only id, student_code, full_name, program_id, batch_id, and status. Both derive identity from auth.uid(), require an active trainer, and accept no caller-supplied trainer ID. Anonymous execution is revoked. Other users get no rows.

The functions intentionally bypass base-table RLS using postgres ownership; this is justified only by the narrow return types and explicit authorization/assignment predicates. Server-side trainer checks remain necessary. Programs/Batches admin queries continue to use existing session/RLS access. Direct trainer reads of programs/students will stop after this proposal is applied; the new trainer UI must use the RPCs. This is a deliberate permission change requiring approval and a coordinated rollout. Deactivation preserves assignments and accounts. No new tables, field migrations, existing-row modifications, or image-upload infrastructure are included.

The SQL has been statically reviewed against the supplied schema and PostgreSQL/Supabase documentation, but has not been executed or tested against a live database. After approval it needs admin/active-trainer/inactive-trainer/anonymous and cross-trainer Data API tests before deployment. The proposed six-column roster is a recommendation awaiting approval, not an existing studio policy.

### Additional table-grant finding

Subsequent user-supplied table grants show TRUNCATE, REFERENCES, and TRIGGER for both anon and authenticated on all four tables. PostgreSQL does not subject TRUNCATE or REFERENCES to RLS. These capabilities are unnecessary for the inspected application; the grants alone do not demonstrate a remotely callable truncate endpoint, but they are a separate least-privilege concern. Creating a trigger or foreign key also requires other SQL privileges and a SQL/RPC execution path; ordinary table REST CRUD should not be confused with arbitrary SQL access.

Separate review-only SQL: `supabase/review/module_3_table_grants.proposed.sql`. It revokes those three capabilities from anon/authenticated, retains CRUD and existing RLS, and verifies effective privileges including column-level REFERENCES. If PUBLIC or inherited grants keep a capability available, the transaction aborts rather than silently claiming remediation. Existing triggers, constraints, assignments, rows, and postgres/service_role grants are not modified. No destructive test is performed. Future-table default grants remain a separate review item. This proposal is not applied and requires its own explicit approval alongside the pending trainer-access proposal.

## Proposed next phase, subject to approval

1. Implement admin trainer list/detail/edit/status screens using current fields, authenticated server queries, and `requireAdmin()` on every mutation. Keep photos optional without uploads. Add Trainers navigation.
2. Implement explicit, conditional batch assignment/unassignment with active-trainer validation, preserving existing assignments on deactivation. Never delete Auth users as deactivation.
3. Add a database-backed active-trainer authorization helper, trainer login/logout and SSR refresh, own-profile/assigned-batch dashboard, and an explicit minimal student-column allowlist once the schema/policies are reviewed. No student login, fees, payments, or attendance.
4. For onboarding, use a separate `server-only` Auth Admin client with `SUPABASE_SECRET_KEY` (or a legacy service-role key) read from the server environment, with session persistence disabled and no admin browser-cookie sharing. Recheck admin authorization before use. Normal application reads/edits continue using the authenticated session and RLS.
5. Prefer `inviteUserByEmail()` rather than admin-selected passwords. Auth returns the UUID; explicitly create its trainer profile using that UUID and a server-controlled role, since no creation trigger exists. Do not trust user-editable metadata for roles. Existing non-trainer accounts must not be silently repurposed. Partial failures require recovery using the same Auth identity, not deletion/recreation or blind invitation retries.
6. Configure a canonical `APP_SITE_URL`, exact redirect allowlist, and an SSR-compatible invite acceptance/password-setup flow. Invitations do not support the usual PKCE code exchange. An invite OTP/code-entry flow is supported by the installed SDK and avoids consuming emailed links on GET; the specific email-template approach will be finalized before implementation. Passwords, session tokens, invitation tokens, and privileged keys must never be logged or returned in diagnostics.
7. Review public signup settings, invite template, SMTP delivery/recipient restrictions, and rate limits. Changing project Auth configuration requires approval; no paid provider is automatically required or selected.
8. Test existing modules, admin/trainer/anonymous authorization, inactive existing sessions, direct Data API access, cross-trainer isolation, invitation partial failures/retries, and production build. No real invitations or test accounts without explicit authorization.

Application-only changes can follow implementation approval without reapplying the profile migration. Approval is still required for the proposed SQL, the six-column roster allowlist, server credential setup, and email/redirect/signup configuration. This Phase A work does not authorize execution of SQL or trainer onboarding.

Sources: [Supabase invitations](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [column-level security](https://supabase.com/docs/guides/database/postgres/column-level-security), [Auth configuration](https://supabase.com/docs/guides/auth/general-configuration), [SMTP limitations](https://supabase.com/docs/guides/auth/auth-smtp). Installed SDK and local Next.js documentation were also inspected.
