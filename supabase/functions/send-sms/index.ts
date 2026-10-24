import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const MAX_BODY_BYTES = 20 * 1024;
const BIRD_SEND_URL = "https://eu1.platform.bird.com/v1/sms/messages";

function json(status: number, body: Record<string, unknown> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function hookSecrets(): string[] {
  const configured = Deno.env.get("SEND_SMS_HOOK_SECRETS") ?? "";
  return configured
    .split("|")
    .map((item) => item.trim().replace(/^v1,whsec_/, ""))
    .filter(Boolean);
}

function verifyHook(payload: string, headers: Headers): unknown | null {
  const secrets = hookSecrets();
  if (secrets.length === 0) return null;

  const normalizedHeaders = Object.fromEntries(headers.entries());
  for (const secret of secrets) {
    try {
      return new Webhook(secret).verify(payload, normalizedHeaders);
    } catch {
      // Try the next configured rotation secret. Never log payload/signature.
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json(413, { error: "payload_too_large" });
  }

  const hookSecretList = hookSecrets();
  const birdApiKey = Deno.env.get("BIRD_API_KEY");
  const birdSender = Deno.env.get("BIRD_SMS_SENDER");

  // Fail closed before processing an authentication event if configuration is incomplete.
  if (hookSecretList.length === 0 || !birdApiKey || !birdSender) {
    console.error("send-sms configuration incomplete");
    return json(500, { error: "sms_provider_not_configured" });
  }

  let payload: string;
  try {
    payload = await req.text();
  } catch {
    return json(400, { error: "invalid_request_body" });
  }

  if (new TextEncoder().encode(payload).byteLength > MAX_BODY_BYTES) {
    return json(413, { error: "payload_too_large" });
  }

  const event = verifyHook(payload, req.headers) as
    | { user?: { phone?: unknown }; sms?: { otp?: unknown } }
    | null;

  if (!event) {
    return json(401, { error: "invalid_hook_signature" });
  }

  const phone = event.user?.phone;
  const otp = event.sms?.otp;
  if (
    typeof phone !== "string" ||
    !/^\+[1-9]\d{7,14}$/.test(phone) ||
    typeof otp !== "string" ||
    !/^\d{4,10}$/.test(otp)
  ) {
    return json(400, { error: "invalid_auth_event" });
  }

  const controller = new AbortController();
  // Leave headroom for cold start and response handling inside the Auth hook's time budget.
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(BIRD_SEND_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${birdApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        to: phone,
        from: birdSender,
        text: `Il tuo codice di verifica VocalFlash è: ${otp}. Non condividerlo con nessuno.`,
        category: "authentication",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Do not return provider response bodies: they may contain operational details.
      console.error("Bird SMS request rejected", { status: response.status });
      return json(502, { error: "sms_provider_rejected_request" });
    }

    // Bird's 202 Accepted means queued/accepted by the provider, not delivered to the handset.
    return new Response(null, { status: 200 });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    console.error("Bird SMS request failed", { timedOut });
    return json(502, { error: timedOut ? "sms_provider_timeout" : "sms_provider_unavailable" });
  } finally {
    clearTimeout(timeout);
  }
});
