const cleanBase = value => String(value || "").trim().replace(/\/+$/, "");

export async function checkAssistantReadiness({
  baseUrl,
  secret,
  fetchImpl = fetch,
  timeoutMs = 1500
} = {}) {
  const base = cleanBase(baseUrl);
  if (!base || !secret) {
    return { ready: false, reason: "DEPENDENCY_CONFIG_MISSING" };
  }

  let url;
  try {
    url = new URL(`${base}/rest/v1/business_channels?select=id&limit=1`);
  } catch {
    return { ready: false, reason: "DEPENDENCY_CONFIG_INVALID" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const headers = {
      apikey: secret,
      Accept: "application/json"
    };
    // Supabase secret API keys are not JWTs and must not be sent as Bearer tokens.
    if (!String(secret).startsWith("sb_secret_")) {
      headers.Authorization = `Bearer ${secret}`;
    }
    const response = await fetchImpl(url, {
      method: "GET",
      headers,
      signal: controller.signal
    });
    if (!response.ok) {
      return { ready: false, reason: "DEPENDENCY_PROBE_FAILED" };
    }
    return { ready: true, reason: "DEPENDENCIES_AVAILABLE" };
  } catch (error) {
    return {
      ready: false,
      reason: error?.name === "AbortError" ? "DEPENDENCY_PROBE_TIMEOUT" : "DEPENDENCY_PROBE_FAILED"
    };
  } finally {
    clearTimeout(timer);
  }
}
