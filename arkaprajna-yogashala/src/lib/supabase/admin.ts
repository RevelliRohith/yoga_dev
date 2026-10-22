import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "./server";
import { authFailure } from "./auth-errors";

// Do not cache across requests: role changes must take effect immediately.
export async function getAdmin(client?: Awaited<ReturnType<typeof createClient>>) {
  const supabase = client ?? await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return {
    user: null, status: "anonymous" as const,
    diagnostic: authFailure("Session verification", "No verified session is available. Sign in again.", error ?? undefined),
  };

  const { data: profile, error: profileError, status } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) return {
    user: null, status: "unavailable" as const,
    diagnostic: authFailure("Profile lookup", "We could not verify access. Please try again shortly.", { code: profileError.code, status }),
  };
  if (profile?.role !== "admin") return {
    user: null, status: "forbidden" as const,
    diagnostic: authFailure("Role verification", "Administrator access is required. Contact your studio administrator.", {
      code: profile ? "admin_role_required" : "profile_not_visible", status,
    }),
  };
  return { user, status: "admin" as const };
}

// Call this inside every future privileged page, action, and route handler.
export async function requireAdmin() {
  const result = await getAdmin();
  if (!result.user) {
    const reason = result.status === "anonymous" ? "" : `?reason=${result.status}`;
    redirect(`/admin/login${reason}`);
  }
  return result.user;
}
