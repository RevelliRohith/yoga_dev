"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, SessionCookieWriteError } from "@/lib/supabase/server";
import { getAdmin } from "@/lib/supabase/admin";
import { authFailure } from "@/lib/supabase/auth-errors";
import { SupabaseConfigurationError } from "@/lib/supabase/config";

export type AuthState = { error: string };

function unexpectedFailure(error: unknown): AuthState {
  if (error instanceof SessionCookieWriteError) {
    return { error: authFailure("Session cookies", "Unable to save the session. Please try again.", { code: "cookie_write_failed" }) };
  }
  if (error instanceof SupabaseConfigurationError) {
    return { error: authFailure("Configuration", "Authentication is temporarily unavailable.", { code: "configuration_invalid" }) };
  }
  return { error: authFailure("Authentication request", "Authentication could not complete. Check server connectivity and try again.") };
}

export async function login(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254 ||
      password.length === 0 || password.length > 4096) {
    return { error: "Enter a valid email address and password." };
  }

  // No password trimming, browser storage, credential logging, or recovery-link flow.
  let supabase;
  let networkCode: string | undefined;
  try {
    supabase = await createClient({
      requireCookieWrites: true,
      onNetworkFailure: code => { networkCode = code; },
    });
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: authFailure(
      "Password sign-in (/auth/v1/token?grant_type=password)",
      "Unable to sign in. Check your credentials and try again.",
      { code: error.code, status: error.status, networkCode },
    ) };
  } catch (error) {
    return unexpectedFailure(error);
  }

  try {
    const result = await getAdmin(supabase);
    if (!result.user) {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      const cleanup = signOutError && process.env.NODE_ENV === "development"
        ? ` ${authFailure("Session cleanup", "Sign-out failed. Retry signing out.", signOutError)}` : "";
      return { error: `${result.diagnostic}${cleanup}` };
    }
  } catch (error) {
    return unexpectedFailure(error);
  }

  revalidatePath("/admin", "layout");
  redirect("/admin");
}

export async function logout(): Promise<AuthState> {
  try {
    const supabase = await createClient({ requireCookieWrites: true });
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { error: authFailure("Sign-out", "Unable to sign out. Please try again.", error) };
  } catch (error) {
    return unexpectedFailure(error);
  }
  revalidatePath("/admin", "layout");
  redirect("/admin/login?reason=signed-out");
}
