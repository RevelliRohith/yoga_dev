import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ONBOARDING_APP, validateOnboarding } from "./onboarding";

type Draft = ReturnType<typeof validateOnboarding>["values"];
type Marker = { application: string; stage: string; draft: Draft; attempt_id: string; created_by: string; last_email_attempt_at?: string };
export class OnboardingFailure extends Error {
  constructor(message: string, public resumeId?: string) { super(message); }
}
export function onboardingMarker(user: User): Marker | null {
  const marker = user.app_metadata?.trainer_onboarding;
  return marker?.application === ONBOARDING_APP ? marker as Marker : null;
}

export async function reserveEmailAttempt(admin: SupabaseClient["auth"]["admin"], user: User) {
  const marker = onboardingMarker(user);
  if (!marker) throw new OnboardingFailure("Account ownership could not be verified.");
  if (marker.last_email_attempt_at && Date.now() - Date.parse(marker.last_email_attempt_at) < 60000) throw new OnboardingFailure("Wait at least one minute before another email request. Earlier delivery may still be in progress.");
  const next = { ...marker, draft: undefined, last_email_attempt_at: new Date().toISOString() };
  const saved = await admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, trainer_onboarding: next } });
  if (saved.error) throw new OnboardingFailure("Email retry status could not be reserved. No email was requested.");
  return next;
}

export async function findAuthEmail(admin: SupabaseClient["auth"]["admin"], email: string) {
  for (let page = 1; page <= 1000; page++) {
    const result = await admin.listUsers({ page, perPage: 200 });
    if (result.error) throw new OnboardingFailure("Account lookup failed. No invitation was requested. Try again later.");
    const found = result.data.users.find(u => u.email?.toLowerCase() === email);
    if (found) return found;
    if (!result.data.nextPage || result.data.users.length === 0) return null;
  }
  throw new OnboardingFailure("Account lookup did not finish. Contact the administrator before retrying.");
}

// Called only from admin-authorized actions; injected clients keep tests off production.
export async function beginOnboarding(db: SupabaseClient, admin: SupabaseClient["auth"]["admin"], input: { email: string; values: Draft; attemptId: string; adminId: string }) {
  const existing = await findAuthEmail(admin, input.email);
  if (existing) {
    const owned = onboardingMarker(existing);
    throw new OnboardingFailure("An account already exists. It was not changed. Use the existing trainer profile or explicitly resume this application's incomplete onboarding.", owned?.stage !== "accepted" && owned ? existing.id : undefined);
  }
  const created = await admin.createUser({ email: input.email, email_confirm: false,
    app_metadata: { trainer_onboarding: { application: ONBOARDING_APP, stage: "profile_pending", draft: input.values, attempt_id: input.attemptId, created_by: input.adminId } },
  });
  if (created.error || !created.data.user) throw new OnboardingFailure("Account creation could not be confirmed. Do not submit repeatedly. Reopen this form to check for an incomplete onboarding attempt.");
  return ensureTrainerProfile(db, admin, created.data.user);
}

export async function ensureTrainerProfile(db: SupabaseClient, admin: SupabaseClient["auth"]["admin"], user: User) {
  const marker = onboardingMarker(user);
  if (!marker || !user.email) throw new OnboardingFailure("This account does not belong to this onboarding workflow. No changes were made.");
  const current = await db.from("profiles").select("id,role,is_active").eq("id", user.id).maybeSingle();
  if (current.error) throw new OnboardingFailure("Account exists, but its profile could not be checked. Resume setup when connectivity is restored.", user.id);
  if (current.data && current.data.role !== "trainer") throw new OnboardingFailure("Existing account role differs. Onboarding stopped without changing it.");
  if (!current.data) {
    // Revalidate the server-owned draft, and never overwrite an existing profile.
    const fields = new FormData();
    fields.set("email", user.email);
    for (const [key, value] of Object.entries(marker.draft ?? {})) if (value !== null) fields.set(key, String(value));
    const validated = validateOnboarding(fields);
    if (Object.keys(validated.fieldErrors).length) throw new OnboardingFailure("The pending draft needs administrator review. No profile was created.");
    const inserted = await db.from("profiles").insert({ id: user.id, ...validated.values, role: "trainer", is_active: true }).select("id").maybeSingle();
    if (inserted.error || !inserted.data) throw new OnboardingFailure("Auth account exists; profile creation was not confirmed. Resume setup to check and repair the same account. Do not delete or recreate it.", user.id);
  } else if (!current.data.is_active) throw new OnboardingFailure("This trainer is inactive. Activate the existing profile before sending setup email.");
  const marked = await admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, trainer_onboarding: { ...marker, stage: user.email_confirmed_at ? "accepted" : "invitation_pending", draft: undefined } } });
  if (marked.error) throw new OnboardingFailure("Profile is linked, but onboarding status could not be saved. Retry from the existing trainer profile.", user.id);
  return user.id;
}

export async function sendTrainerSetup(db: SupabaseClient, admin: SupabaseClient["auth"]["admin"], id: string, site: string) {
  const result = await admin.getUserById(id);
  if (result.error || !result.data.user) throw new OnboardingFailure("The Auth account could not be verified. No email was requested.");
  const user = result.data.user;
  if (!onboardingMarker(user)) throw new OnboardingFailure("This account was not created by this onboarding workflow. It was not changed.");
  await ensureTrainerProfile(db, admin, user);
  if (user.email_confirmed_at) throw new OnboardingFailure("This trainer has already confirmed their email. Use the explicit password-recovery action instead of another invitation.");
  const marker = await reserveEmailAttempt(admin, user);
  const sent = await admin.inviteUserByEmail(user.email!, { redirectTo: `${site}/auth/trainer/confirm` });
  if (sent.error || sent.data.user?.id !== id) throw new OnboardingFailure("The trainer profile is ready, but invitation acceptance by the email provider could not be confirmed. Wait before retrying; delivery may have occurred.", id);
  const marked = await admin.updateUserById(id, { app_metadata: { ...user.app_metadata, trainer_onboarding: { ...marker, stage: "invitation_requested", draft: undefined } } });
  if (marked.error) throw new OnboardingFailure("The invitation request succeeded, but its status could not be saved. It may already be delivered; do not resend immediately.", id);
  return id;
}
