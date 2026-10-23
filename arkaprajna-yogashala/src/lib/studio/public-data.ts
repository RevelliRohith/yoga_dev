import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import {
  EMPTY_SETTINGS,
  type StudioSettings,
  type StudioEvent,
  settingsContent,
  publicEvents,
} from "./model";
export function anonymousClient() {
  const { url, key } = getSupabaseConfig();
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
export async function publicContent(): Promise<{
  settings: StudioSettings;
  events: StudioEvent[];
  available: boolean;
}> {
  if (process.env.PUBLIC_CONTENT_ENABLED !== "true")
    return { settings: EMPTY_SETTINGS, events: [], available: false };
  try {
    const r = await anonymousClient().rpc("studio_public_content");
    if (r.error) throw new Error();
    if (
      !r.data ||
      typeof r.data !== "object" ||
      !r.data.settings ||
      typeof r.data.settings !== "object" ||
      Array.isArray(r.data.settings)
    )
      throw new Error("Invalid public projection");
    return {
      settings: settingsContent(r.data.settings),
      events: publicEvents(r.data.events),
      available: true,
    };
  } catch {
    return { settings: EMPTY_SETTINGS, events: [], available: false };
  }
}
