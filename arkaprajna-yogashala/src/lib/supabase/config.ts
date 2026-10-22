export class SupabaseConfigurationError extends Error {
  constructor() {
    super("Supabase public configuration is missing or invalid.");
    this.name = "SupabaseConfigurationError";
  }
}

// Explicit references also let Next.js inline the same public values in the browser.
export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    if (!url || !key) throw new Error();
    const parsed = new URL(url);
    if (parsed.username || parsed.password ||
        (parsed.protocol !== "https:" &&
          !(process.env.NODE_ENV === "development" && parsed.protocol === "http:" &&
            ["localhost", "127.0.0.1"].includes(parsed.hostname)))) throw new Error();

    // Never allow a secret/service-role key in the public client configuration.
    if (!key.startsWith("sb_publishable_")) {
      const payload = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload.role !== "anon") throw new Error();
    }
    return { url, key, projectHost: parsed.hostname };
  } catch {
    throw new SupabaseConfigurationError();
  }
}
