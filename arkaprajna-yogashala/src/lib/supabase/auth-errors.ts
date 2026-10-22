import "server-only";

import { getSupabaseConfig } from "./config";

type Failure = { code?: string; status?: number; networkCode?: string };

const networkExplanations: Record<string, string> = {
  EACCES: "The server process is denied outbound network access. Restart Next.js in a terminal/runtime with network permission.",
  EPERM: "The server process is denied network permission. Check its runtime or sandbox restrictions.",
  ENOTFOUND: "DNS could not resolve the Supabase hostname.",
  EAI_AGAIN: "DNS resolution temporarily failed.",
  ECONNREFUSED: "The outbound connection was refused.",
  ECONNRESET: "The outbound connection was reset before a response arrived.",
  ETIMEDOUT: "The outbound connection timed out.",
  UND_ERR_CONNECT_TIMEOUT: "The outbound connection timed out.",
};

const explanations: Record<string, string> = {
  invalid_credentials: "Supabase rejected the email/password combination in this project. This does not identify which credential is wrong.",
  email_not_confirmed: "The account email has not been confirmed.",
  user_banned: "Supabase has disabled this account.",
  email_provider_disabled: "The email authentication provider is disabled.",
  provider_disabled: "The requested authentication provider is disabled.",
  over_request_rate_limit: "Supabase rate-limited this request. Wait before retrying.",
  over_email_send_rate_limit: "Supabase's email rate limit was reached.",
  captcha_failed: "Supabase requires a valid CAPTCHA response.",
  unexpected_failure: "Supabase encountered an internal error.",
  request_timeout: "The Supabase request timed out.",
  refresh_token_not_found: "The saved session refresh token is no longer valid. Sign in again.",
  refresh_token_already_used: "The saved refresh token has already been used. Sign in again.",
  session_not_found: "The session no longer exists. Sign in again.",
  session_expired: "The session has expired. Sign in again.",
  "42501": "The profiles query was denied by database permissions/RLS.",
  PGRST116: "The profile lookup returned an unexpected number of rows.",
  "42P01": "The profiles table could not be found in this project.",
  "42703": "A required profile column could not be found in this project.",
  configuration_invalid: "Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart Next.js. Only publishable/anon keys belong here.",
  cookie_write_failed: "The server could not save session cookies. Confirm login runs as a Server Action with cookie writes enabled.",
  admin_role_required: "Password authentication succeeded, but the visible profile does not have the admin role.",
  profile_not_visible: "Password authentication succeeded, but no profile is visible for profiles.id = Auth user.id. The row may be missing or hidden by RLS.",
};

// Never serialize provider messages, error objects, request bodies, or credentials.
export function authFailure(stage: string, productionMessage: string, failure?: Failure) {
  if (process.env.NODE_ENV !== "development") return productionMessage;
  const code = failure?.code && /^[a-zA-Z0-9_]{1,64}$/.test(failure.code)
    ? failure.code : "not_provided";
  const status = failure?.status;
  const http = typeof status === "number" && status >= 100 && status <= 599
    ? String(status) : "no HTTP response status";
  let projectHost = "unavailable (check public URL/key configuration)";
  try { projectHost = getSupabaseConfig().projectHost; } catch { /* Safe fixed fallback. */ }
  const explanation = explanations[code] ?? (stage.startsWith("Password sign-in") && status === 0
    ? "No HTTP response was received. Check server network/TLS connectivity to Supabase."
    : stage.startsWith("Password sign-in") && status === 401
      ? "Supabase rejected the request authorization. Verify the project URL and publishable key belong to the same project."
      : productionMessage);
  const networkCode = failure?.networkCode;
  const network = networkCode && /^[A-Z0-9_]{1,48}$/.test(networkCode)
    ? ` Network=${networkCode}. ${networkExplanations[networkCode] ?? "Check server connectivity and trusted TLS certificates; do not disable certificate verification."}` : "";
  return `${stage}: ${explanation} [code=${code}; HTTP=${http}; project=${projectHost}]${network}`;
}
