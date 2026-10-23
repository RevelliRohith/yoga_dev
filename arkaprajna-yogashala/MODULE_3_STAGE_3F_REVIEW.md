# Stage 3F - Configuration and controlled-test approval gate

Prepared only. No Supabase settings, secrets, accounts or emails have been changed. Trainer dashboard code now exists; onboarding remains disabled. Phase 3 is not fully complete.

## Proposed configuration to approve

- Confirm project ogzdhmptzeyinhgxcgii and an approved local or production origin. Development default candidate: http://localhost:3000; production requires an approved HTTPS origin.
- Install a same-project SUPABASE_SECRET_KEY (or deliberately selected legacy SUPABASE_SERVICE_ROLE_KEY) in the server environment/secret manager, never in NEXT_PUBLIC variables, client code or chat.
- Set APP_SITE_URL to that exact origin. Keep TRAINER_ONBOARDING_ENABLED absent/false until the following settings and test recipient are approved.
- Review existing Auth settings; disable public signup while retaining existing administrator/trainer email/password login. The action independently requires disable_signup true before onboarding writes.
- Set Site URL and exact redirect allowlist for /auth/trainer/confirm. Avoid broad production wildcards.
- Review and approve the two stage_3d_*.proposed.html email templates; their current branch is development-only. Trainer token hashes are in fragments, with an explicit confirmation click; other recovery destinations retain ConfirmationURL.
- Confirm supported SMTP, allowed recipients and current provider limits/costs. No paid provider or SMTP credential setup is authorized implicitly.
- Review invitation expiry and recovery behavior. Expired/used links require a new explicit request; never accept an invalid link or disable verification.

## Specific fixtures needed before execution approval

Identify two controlled trainer recipients (A/B), distinct test batches, and whether an existing inactive account is available or one of those controlled accounts may be temporarily deactivated. Approve any minimal fictional student roster fixtures separately. Do not request/share credentials in chat. No production students or administrator account should be repurposed for fixtures.

## Actual live test matrix after approval

1. Admin-only create/invite; forged anonymous/trainer requests denied before privileged access.
2. Auth UUID equals profiles.id; role trainer, active true; no password chosen by administrator.
3. Invitation delivered; explicit confirmation; trainer chooses password; email/password login reaches /trainer.
4. Repeat/expired invitation, safe profile repair, email failure, throttling and confirmed-account recovery without deletion/recreation.
5. Trainer A sees A's batches and only the six authorized roster fields. Trainer B cannot obtain A's batches/roster by changed URL, query, join or direct RPC arguments.
6. Direct student/program access denied for trainers; contact, guardian, birth/address and financial fields unavailable. Existing user self-profile SELECT must not expose another profile.
7. Inactive trainer login/functionality and data denied, including an already-open session after deactivation. Refresh must not revive access. Reactivation restores only that trainer's assignments.
8. Trainer cannot reach /admin or its actions; admins retain their pages. Anonymous data denial already passed historically; rerun after any configuration change.
9. Secure logout and recovery do not disturb unrelated admin sessions or change existing UUIDs, batch assignments or RLS.

Record actual timestamps/results without passwords, tokens, student PII or secret values. Unperformed cases remain pending; do not treat the 50 mocked/local Stage 3E checks as these live tests. Account/email/production data actions require explicit approval for the named fixtures. No invitation can be sent under the master prompt alone.
