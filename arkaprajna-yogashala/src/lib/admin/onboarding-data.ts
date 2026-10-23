import "server-only";
import { requireAdmin } from "@/lib/supabase/admin";
import { privilegedClient } from "@/lib/supabase/privileged";
import { onboardingMarker } from "./onboarding-service";

export async function loadTrainerOnboarding(id: string) {
  await requireAdmin();
  try {
    const { client } = privilegedClient();
    const result = await client.auth.admin.getUserById(id);
    if (result.error || !result.data.user) return { available: false, message: "Auth onboarding status could not be checked.", confirmed: false };
    const user = result.data.user;
    if (!onboardingMarker(user)) return { available: false, message: "This existing account was created outside this onboarding workflow. No invitation or recovery action is offered here.", confirmed: false };
    return { available: true, message: user.email_confirmed_at ? "Email confirmed. Password recovery is available if needed." : "Email not yet confirmed. Invitation delivery is not guaranteed by request acceptance.", confirmed: !!user.email_confirmed_at };
  } catch { return { available: false, message: "Secure onboarding is not enabled or configured. Profile and batch management remain available.", confirmed: false }; }
}
