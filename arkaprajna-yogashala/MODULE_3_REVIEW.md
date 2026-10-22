# Trainer Management: review before implementation

> Historical review. The user subsequently confirmed the Auth FK to `auth.users(id)` with `ON DELETE CASCADE`, no Auth user-creation triggers, and successful application of the six trainer fields. Do not rerun the proposed field migration. See `MODULE_3_PHASE_A.md` for the current plan and remaining security checks.

Status: database inspection and migration proposal only. No database migration, trainer account creation, invitation, RLS change, or batch reassignment has been executed.

## Confirmed schema

The user confirmed `public.profiles` has `id uuid`, `full_name text`, `phone text`, `role text`, and `created_at timestamptz`. `batches.trainer_id` references `profiles.id`; `students.batch_id` and `program_id` reference batches and programs. Existing admin management policies and trainer reads for assigned batches/students are present. The exact `profiles.id -> auth.users.id` constraint and Auth user-creation trigger have not yet been verified.

## Read-only Auth verification

Run `supabase/review/module_3_verify_auth_link.sql` in Supabase SQL Editor. It uses a read-only transaction and rolls back. Share the three result grids, with any secrets in custom function definitions redacted if present:

1. Whether the exact FK exists and is validated, number of Auth INSERT triggers, and count of unmatched profile IDs. Counts do not reveal personal records.
2. Existing profile foreign-key definitions and deletion behavior.
3. Auth INSERT trigger definitions and the functions they call, including enabled status.

Do not share Auth user records, access tokens, passwords, or project keys. No secret key is needed to run the SQL in your own Supabase dashboard.

If the Auth FK is missing, a separate FK proposal will be prepared only after checking the unmatched-profile count. No profile, administrator UUID, or Auth account will be deleted or recreated to make a constraint pass. A trigger is not mandatory: admin-controlled onboarding can explicitly create the profile after Supabase Auth creates the user. If a trigger exists, onboarding must cooperate with it and must not blindly insert a duplicate profile or trust client-editable role metadata.

## Minimal profile-field migration proposal

Review `supabase/review/module_3_profile_fields.proposed.sql`. It is outside the automatic migrations directory and has not been applied.

| New field | Type / default | Purpose |
| --- | --- | --- |
| `specialization` | nullable text | Trainer's teaching focus |
| `qualifications` | nullable text | Simple qualifications description; no additional table |
| `biography` | nullable text | Optional profile biography |
| `years_of_experience` | nullable integer, range 0–100 | Unknown experience remains blank, not an invented zero |
| `is_active` | boolean, not null, default true | Activation/deactivation; existing administrator and trainer profiles remain active |
| `photo_path` | nullable text | Optional private Storage object path, not a public contact/profile URL |

Existing `full_name`, `phone`, `role`, and identifiers are reused. Email remains authoritative in Supabase Auth; no duplicate editable email column is proposed. No new application tables, changes to existing roles, foreign-key replacements, student updates, batch reassignment, or cascading deletes are included. No Storage bucket or policy is created by this proposal; private photo upload controls would be reviewed separately.

Adding `is_active` alone does not revoke existing sessions or restrict existing RLS. Activating trainer access must wait until the current policies are reviewed for both active status and private-column access. These checks are necessary even when the Next.js dashboard selects only safe fields: a trainer can call the Data API directly. Existing policies will not be overwritten or dropped. If additional restrictions or safe roster functions are needed, their exact SQL and effect on existing access will be submitted for separate approval.

## Proposed onboarding, pending verification

1. Administrator signs in through the existing admin flow. Every onboarding action rechecks administrator authorization on the server.
2. The server validates trainer details and checks the verified Auth/profile provisioning contract.
3. The server uses Supabase Auth Admin API to invite a new trainer. The secret/service-role key is read only from a server environment variable, never from `NEXT_PUBLIC_*`, a submitted form, or browser code. No accounts or invitations are created during this review.
4. The returned Auth UUID becomes the profile ID. Any existing provisioning trigger is respected. Existing non-trainer profiles are not silently converted, and an existing administrator account is never altered.
5. If Auth succeeds but profile setup fails, onboarding reports the partial state for administrator recovery; it does not delete/recreate the Auth user or silently resend invitations. Retries must use the same verified Auth identity.
6. The trainer verifies the invitation and chooses their own password. Access checks read role and active status from protected database data, not user-editable metadata. Inactive or unprovisioned users fail closed.
7. The trainer dashboard exposes only that trainer's assigned batches and a minimal student roster. Exact student fields and the database privacy boundary will be finalized after reviewing the actual columns and policies. Fees, payments, other trainers' contacts, and admin settings remain excluded.

Trainer management will be added to the admin navigation. No student login or unrelated management module is planned.

## Approval boundary

Before any database execution: receive the Auth verification results, finalize the exact onboarding and policy requirements, explain any additional migration, and obtain explicit approval for the specific SQL. Approval of display fields does not authorize account creation, invitations, replacing policies, or changing Auth relationships.
