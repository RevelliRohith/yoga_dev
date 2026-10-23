"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { onboardingConfig } from "@/lib/supabase/privileged";
import { onboardingMarker } from "@/lib/admin/onboarding-service";

export type SetupState = { error: string };
export async function confirmTrainerLink(_state: SetupState, form: FormData): Promise<SetupState> {
  const hash = form.get("token_hash"), type = form.get("type");
  if (typeof hash !== "string" || !/^[a-f0-9]{64}$/i.test(hash) || (type !== "invite" && type !== "recovery")) return { error: "This setup link is invalid. Ask your administrator for another invitation or recovery email." };
  try {
    onboardingConfig();
    const db = await createClient({ requireCookieWrites: true });
    const verified = await db.auth.verifyOtp({ token_hash: hash, type });
    if (verified.error || !verified.data.user) return { error: "This link expired or has already been used. Ask your administrator for a new email." };
    const user = await db.auth.getUser();
    const profile = await db.from("profiles").select("role,is_active").eq("id", verified.data.user.id).maybeSingle();
    if (user.error || user.data.user?.id !== verified.data.user.id || !onboardingMarker(verified.data.user) || profile.error || profile.data?.role !== "trainer" || !profile.data.is_active) {
      await db.auth.signOut({ scope: "local" });
      return { error: "An active linked trainer profile is required. Contact your administrator." };
    }
  } catch { return { error: "Setup could not be confirmed. Check connectivity or contact your administrator. No password was changed." }; }
  redirect("/auth/trainer/password");
}

export async function saveTrainerPassword(_state: SetupState, form: FormData): Promise<SetupState> {
  const password = form.get("password"), confirmation = form.get("confirmation");
  if (typeof password !== "string" || password.length < 12 || password.length > 128 || password !== confirmation) return { error: "Use 12–128 characters and enter the same password in both fields." };
  try {
    onboardingConfig();
    const db = await createClient({ requireCookieWrites: true });
    const result = await db.auth.getUser();
    const user = result.data.user;
    if (result.error || !user || !user.email_confirmed_at || !onboardingMarker(user)) return { error: "Open a valid trainer invitation or recovery link before setting a password." };
    const profile = await db.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
    if (profile.error || profile.data?.role !== "trainer" || !profile.data.is_active) return { error: "An active trainer profile is required. Contact your administrator." };
    const saved = await db.auth.updateUser({ password });
    if (saved.error) return { error: "The password could not be confirmed as saved. Check the password requirements or ask your administrator for help." };
  } catch { return { error: "The password change could not be confirmed. Check connectivity before trying again." }; }
  redirect("/auth/trainer/complete");
}

export async function finishTrainerSetup(): Promise<SetupState> {
  try {
    const db = await createClient({ requireCookieWrites: true });
    const result = await db.auth.signOut({ scope: "local" });
    if (result.error) return { error: "Sign-out could not be confirmed. Please try again." };
  } catch { return { error: "Sign-out could not complete. Please try again." }; }
  redirect("/auth/trainer/confirm?finished=1");
}
