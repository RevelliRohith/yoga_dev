import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { onboardingMarker } from "@/lib/admin/onboarding-service";
import { TrainerPasswordForm } from "../setup-forms";

export default async function TrainerPasswordPage() {
  const db = await createClient();
  const result = await db.auth.getUser();
  const user = result.data.user;
  if (result.error || !user || !onboardingMarker(user)) redirect("/auth/trainer/confirm");
  const profile = await db.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
  if (profile.error || profile.data?.role !== "trainer" || !profile.data.is_active) redirect("/auth/trainer/confirm");
  return <><h1>Your own secure password.</h1><p className="admin-muted">Only you choose and enter this password.</p><TrainerPasswordForm /></>;
}
