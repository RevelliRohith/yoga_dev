// Return only known transport codes, never arbitrary error text or request data.
const codes = new Set([
  "EACCES", "EPERM", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET",
  "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH", "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET", "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "ERR_TLS_CERT_ALTNAME_INVALID",
]);

export function networkFailureCode(error: unknown, depth = 0): string | undefined {
  if (depth > 4 || !error || typeof error !== "object") return undefined;
  const value = error as { code?: unknown; cause?: unknown; errors?: unknown[] };
  if (typeof value.code === "string" && codes.has(value.code)) return value.code;
  const cause = networkFailureCode(value.cause, depth + 1);
  if (cause) return cause;
  if (Array.isArray(value.errors)) {
    for (const nested of value.errors) {
      const code = networkFailureCode(nested, depth + 1);
      if (code) return code;
    }
  }
  return undefined;
}
