import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin";
import { onboardingConfig } from "@/lib/supabase/privileged";
import { ManagementHeading } from "../../management-ui";
import { CreateTrainerForm } from "../../onboarding-forms";

export const metadata = { title: "Create trainer | Arkaprajna Yogashala" };
export default async function NewTrainerPage() {
  await requireAdmin();
  let enabled = false;
  try { onboardingConfig(); enabled = true; } catch { /* Never display credential details. */ }
  return <><Link href="/admin/trainers" className="admin-back">← All trainers</Link><ManagementHeading title="Welcome a new teacher." description="A secure invitation, a personal password, and one linked trainer profile." /><CreateTrainerForm enabled={enabled} /></>;
}
