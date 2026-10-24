import { createHandler } from "./index.ts";

function assertEquals(actual: unknown, expected: unknown, message = "") {
  if (actual !== expected) {
    throw new Error(
      `${message ? message + ": " : ""}expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

const baseEnv: Record<string, string> = {
  SEND_SMS_HOOK_SECRETS: "v1,whsec_test_secret",
  BIRD_API_KEY: "test-api-key",
  BIRD_SMS_SENDER: "VocalFlash",
};

function envReader(overrides: Record<string, string | undefined> = {}) {
  return (name: string) => overrides[name] ?? baseEnv[name];
}

function postRequest(body = "{}") {
  return new Request("https://unit.test/send-sms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

Deno.test("rejects methods other than POST", async () => {
  const handler = createHandler({ getEnv: () => undefined });
  const response = await handler(new Request("https://unit.test/send-sms"));
  assertEquals(response.status, 405);
  assertEquals((await response.json()).error, "method_not_allowed");
});

Deno.test("fails closed when hook secret or Bird configuration is missing", async () => {
  let fetchCalled = false;
  const handler = createHandler({
    getEnv: envReader({ SEND_SMS_HOOK_SECRETS: undefined, BIRD_API_KEY: undefined }),
    fetchImpl: async () => {
      fetchCalled = true;
      return new Response(null, { status: 202 });
    },
  });
  const response = await handler(postRequest());
  assertEquals(response.status, 500);
  assertEquals((await response.json()).error, "sms_provider_not_configured");
  assertEquals(fetchCalled, false);
});

Deno.test("rejects a missing or invalid Standard Webhooks signature", async () => {
  const handler = createHandler({ getEnv: envReader() });
  const response = await handler(postRequest(JSON.stringify({
    user: { phone: "+393331234567" },
    sms: { otp: "123456" },
  })));
  assertEquals(response.status, 401);
  assertEquals((await response.json()).error, "invalid_hook_signature");
});

Deno.test("rejects malformed phone and OTP values before calling Bird", async () => {
  let fetchCalled = false;
  const handler = createHandler({
    getEnv: envReader(),
    verify: () => ({ user: { phone: "3331234567" }, sms: { otp: "12x" } }),
    fetchImpl: async () => {
      fetchCalled = true;
      return new Response(null, { status: 202 });
    },
  });
  const response = await handler(postRequest());
  assertEquals(response.status, 400);
  assertEquals((await response.json()).error, "invalid_auth_event");
  assertEquals(fetchCalled, false);
});

Deno.test("does not expose Bird's response body when provider rejects", async () => {
  const handler = createHandler({
    getEnv: envReader(),
    verify: () => ({ user: { phone: "+393331234567" }, sms: { otp: "123456" } }),
    fetchImpl: async () => new Response("sensitive provider detail", { status: 429 }),
  });
  const response = await handler(postRequest());
  assertEquals(response.status, 502);
  assertEquals((await response.json()).error, "sms_provider_rejected_request");
});

Deno.test("maps an ambiguous provider timeout without retrying", async () => {
  let calls = 0;
  const handler = createHandler({
    getEnv: envReader(),
    verify: () => ({ user: { phone: "+393331234567" }, sms: { otp: "123456" } }),
    fetchImpl: async () => {
      calls += 1;
      throw new DOMException("aborted", "AbortError");
    },
  });
  const response = await handler(postRequest());
  assertEquals(response.status, 502);
  assertEquals((await response.json()).error, "sms_provider_timeout");
  assertEquals(calls, 1);
});

Deno.test("forwards a valid verified event and reports provider acceptance only", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const handler = createHandler({
    getEnv: envReader(),
    verify: () => ({ user: { phone: "+393331234567" }, sms: { otp: "123456" } }),
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(null, { status: 202 });
    },
  });
  const response = await handler(postRequest());
  assertEquals(response.status, 200);
  assertEquals(await response.text(), "");
  assertEquals(capturedUrl, "https://eu1.platform.bird.com/v1/sms/messages");
  assertEquals(capturedInit?.method, "POST");
  const body = JSON.parse(String(capturedInit?.body));
  assertEquals(body.to, "+393331234567");
  assertEquals(body.from, "VocalFlash");
  assertEquals(body.category, "authentication");
  assertEquals(body.text.includes("123456"), true);
});
