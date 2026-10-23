"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { privilegedClient, requireInvitationOnly } from "@/lib/supabase/privileged";
import { isUuid } from "@/lib/admin/management";
import { validateOnboarding, type OnboardingState } from "@/lib/admin/onboarding";
import { beginOnboarding, ensureTrainerProfile, onboardingMarker, OnboardingFailure, reserveEmailAttempt, sendTrainerSetup } from "@/lib/admin/onboarding-service";

const failed = (error: unknown): OnboardingState => error instanceof OnboardingFailure
  ? { error: error.message, fieldErrors: {}, resumeId: error.resumeId }
  : { error: "Onboarding is unavailable or could not be confirmed. Check configuration and connectivity before retrying. No account was deleted.", fieldErrors: {} };

export async function createTrainer(_state: OnboardingState, form: FormData): Promise<OnboardingState> {
  const administrator = await requireAdmin();
  const input = validateOnboarding(form);
  if (Object.keys(input.fieldErrors).length) return { error: "Please correct the highlighted fields.", fieldErrors: input.fieldErrors };
  if (form.get("confirm_invitation") !== "on") return { error: "Confirm account creation and invitation delivery before continuing.", fieldErrors: {} };
  let id: string;
  try {
    const { client, config } = privilegedClient();
    await requireInvitationOnly(config);
    const db = await createClient();
    id = await beginOnboarding(db, client.auth.admin, { email: input.email, values: input.values, attemptId: randomUUID(), adminId: administrator.id });
    await sendTrainerSetup(db, client.auth.admin, id, config.site);
  } catch (error) { revalidatePath("/admin/trainers"); return failed(error); }
  revalidatePath("/admin", "layout");
  redirect(`/admin/trainers/${id}?notice=invitation`);
}

export async function retryTrainerSetup(_state: OnboardingState, form: FormData): Promise<OnboardingState> {
  await requireAdmin();
  const id = form.get("id"), intent = form.get("intent");
  if (typeof id !== "string" || !isUuid(id) || !["invite", "repair", "recovery"].includes(String(intent)) || form.get("confirm_email") !== "on") return { error: "Confirm a valid onboarding action before continuing.", fieldErrors: {} };
  try {
    const { client, config } = privilegedClient();
    await requireInvitationOnly(config);
    const db = await createClient();
    const found = await client.auth.admin.getUserById(id);
    if (found.error || !found.data.user || !onboardingMarker(found.data.user)) throw new OnboardingFailure("This account could not be verified as part of this onboarding workflow.");
    if (intent === "recovery") {
      const profile = await db.from("profiles").select("role,is_active").eq("id", id).maybeSingle();
      if (profile.error || profile.data?.role !== "trainer" || !profile.data.is_active || !found.data.user.email_confirmed_at || !found.data.user.email) throw new OnboardingFailure("Recovery requires an existing active trainer with a confirmed Auth email. No email was requested.");
      await reserveEmailAttempt(client.auth.admin, found.data.user);
      const sent = await db.auth.resetPasswordForEmail(found.data.user.email, { redirectTo: `${config.site}/auth/trainer/confirm` });
      if (sent.error) throw new OnboardingFailure("Recovery email acceptance could not be confirmed. Wait before retrying; delivery may have occurred.");
    } else {
      await ensureTrainerProfile(db, client.auth.admin, found.data.user);
      if (intent !== "repair") await sendTrainerSetup(db, client.auth.admin, id, config.site);
    }
  } catch (error) { revalidatePath("/admin/trainers"); return failed(error); }
  revalidatePath("/admin", "layout");
  redirect(`/admin/trainers/${id}?notice=${intent === "recovery" ? "recovery" : intent === "repair" ? "repaired" : "invitation"}`);
}
