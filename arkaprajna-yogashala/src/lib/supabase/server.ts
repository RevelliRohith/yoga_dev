
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
import { networkFailureCode } from "./network-errors";

export class SessionCookieWriteError extends Error {
  constructor() {
    super("Could not persist the authentication session cookies.");
    this.name = "SessionCookieWriteError";
  }
}

export async function createClient({ requireCookieWrites = false, onNetworkFailure }: {
  requireCookieWrites?: boolean;
  onNetworkFailure?: (code: string | undefined) => void;
} = {}) {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseConfig();

  return createServerClient(
    url,
    key,
    {
      global: {
        fetch: async (...args: Parameters<typeof fetch>) => {
          try {
            return await fetch(...args);
          } catch (error) {
            if (process.env.NODE_ENV === "development") onNetworkFailure?.(networkFailureCode(error));
            throw error;
          }
        },
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            if (requireCookieWrites) throw new SessionCookieWriteError();
            // Server Components cannot always write cookies.
            // src/proxy.ts refreshes the session before components render.
          }
        },
      },
    }
  );
}
