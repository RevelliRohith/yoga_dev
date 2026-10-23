import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

export function onboardingConfig() {
  const { url, key: publicKey } = getSupabaseConfig();
  if (new URL(url).hostname !== "ogzdhmptzeyinhgxcgii.supabase.co") throw new Error("Onboarding project mismatch.");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.TRAINER_ONBOARDING_ENABLED !== "true" || !key || !process.env.APP_SITE_URL) throw new Error("Onboarding is not configured.");
  if (!key.startsWith("sb_secret_")) {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
    if (payload.role !== "service_role" || payload.ref !== "ogzdhmptzeyinhgxcgii") throw new Error("Invalid privileged configuration.");
  }
  const site = new URL(process.env.APP_SITE_URL);
  if (site.username || site.password || site.pathname !== "/" || site.search || site.hash ||
    (site.protocol !== "https:" && !(process.env.NODE_ENV === "development" && site.protocol === "http:" && ["localhost", "127.0.0.1"].includes(site.hostname)))) throw new Error("Invalid site origin.");
  return { url, key, publicKey, site: site.origin };
}

export function privilegedClient() {
  const config = onboardingConfig();
  const client = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return { client, config };
}

export async function requireInvitationOnly(config: ReturnType<typeof onboardingConfig>) {
  const response = await fetch(`${config.url}/auth/v1/settings`, {
    headers: { apikey: config.publicKey }, cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || (await response.json()).disable_signup !== true) throw new Error("Invitation-only registration must be configured before onboarding.");
}
