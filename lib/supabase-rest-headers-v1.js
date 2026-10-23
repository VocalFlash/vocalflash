export function supabaseRestHeaders(secret, {contentType = false, extra = {}} = {}) {
  if (typeof secret !== "string" || !secret.trim()) {
    throw new Error("SUPABASE_REST_CREDENTIAL_REQUIRED");
  }
  const headers = {
    apikey: secret,
    Accept: "application/json",
    ...extra
  };
  // Modern sb_secret_ keys are API keys, not JWTs. Authorization Bearer is
  // retained only for legacy JWT credentials until those are migrated.
  if (!secret.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${secret}`;
  }
  if (contentType) headers["Content-Type"] = "application/json";
  return headers;
}
