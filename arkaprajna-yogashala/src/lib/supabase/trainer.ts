import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./server";

export type TrainerProfile = {
  id: string; full_name: string; phone: string | null; role: "trainer";
  specialization: string | null; qualifications: string | null; biography: string | null;
  years_of_experience: number | null; is_active: boolean;
};
const PROFILE_FIELDS = "id,full_name,phone,role,specialization,qualifications,biography,years_of_experience,is_active";

// Always check the current identity and profile. Never cache role/status across requests.
export async function getTrainer(client?: Awaited<ReturnType<typeof createClient>>) {
  const db = client ?? await createClient();
  try {
    const auth = await db.auth.getUser();
    if (auth.error || !auth.data.user) return { status: "anonymous" as const };
    const user = auth.data.user;
    const result = await db.from("profiles").select(PROFILE_FIELDS).eq("id", user.id).maybeSingle();
    if (result.error) return { status: "unavailable" as const };
    if (result.data?.role === "admin") return { status: "admin" as const, user };
    if (!result.data || result.data.role !== "trainer" || result.data.id !== user.id) return { status: "forbidden" as const };
    if (result.data.is_active !== true) return { status: "inactive" as const };
    return { status: "trainer" as const, user, profile: result.data as TrainerProfile };
  } catch { return { status: "unavailable" as const }; }
}

export async function requireTrainer() {
  const db = await createClient();
  const access = await getTrainer(db);
  if (access.status === "admin") redirect("/admin");
  if (access.status !== "trainer") redirect(`/trainer/login?reason=${access.status}`);
  return { user: access.user, profile: access.profile, db };
}
