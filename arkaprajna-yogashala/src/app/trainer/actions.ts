"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTrainer } from "@/lib/supabase/trainer";
import { authFailure } from "@/lib/supabase/auth-errors";

export type TrainerAuthState = { error: string };
export async function trainerLogin(_state: TrainerAuthState, form: FormData): Promise<TrainerAuthState> {
  const email = form.get("email"), password = form.get("password");
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254 || typeof password !== "string" || !password.length || password.length > 4096) return { error: "Enter a valid email and password." };
  let destination = "/trainer";
  try {
    const db = await createClient({ requireCookieWrites: true });
    const login = await db.auth.signInWithPassword({ email: email.trim(), password });
    if (login.error) return { error: authFailure("Trainer sign-in", "Unable to sign in. Check your credentials and try again.", login.error) };
    const access = await getTrainer(db);
    if (access.status === "admin") destination = "/admin";
    else if (access.status !== "trainer") {
      const cleanup = await db.auth.signOut({ scope: "local" });
      if (cleanup.error) return { error: "Access was denied and sign-out could not be confirmed. Please try signing out again." };
      return { error: access.status === "inactive" ? "Your trainer account is inactive. Contact the studio administrator." : "Active trainer access could not be verified. Contact the studio administrator." };
    }
  } catch { return { error: "Sign-in could not complete. Check connectivity and try again." }; }
  revalidatePath("/trainer", "layout");
  redirect(destination);
}

export async function trainerLogout(): Promise<TrainerAuthState> {
  try {
    const db = await createClient({ requireCookieWrites: true });
    const result = await db.auth.signOut({ scope: "local" });
    if (result.error) return { error: "Sign-out could not be confirmed. Please try again." };
  } catch { return { error: "Sign-out could not complete. Please try again." }; }
  revalidatePath("/trainer", "layout");
  redirect("/trainer/login?reason=signed-out");
}
