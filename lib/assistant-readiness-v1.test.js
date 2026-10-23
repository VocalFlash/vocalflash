import test from "node:test";
import assert from "node:assert/strict";
import {checkAssistantReadiness} from "./assistant-readiness-v1.js";

test("readiness fails closed when configuration is missing", async () => {
  assert.deepEqual(await checkAssistantReadiness({baseUrl:"https://example.supabase.co"}), {
    ready:false, reason:"DEPENDENCY_CONFIG_MISSING"
  });
});

test("readiness probes Supabase with a modern secret key without Bearer auth", async () => {
  let request;
  const result = await checkAssistantReadiness({
    baseUrl:"https://example.supabase.co/",
    secret:"sb_secret_test",
    openAiApiKey:"openai-test-key",
    routingApiKey:"routing-test-key",
    fetchImpl:async (url, options) => {
      request = {url:String(url), options};
      return {ok:true, status:200};
    }
  });
  assert.equal(result.ready, true);
  assert.equal(request.url, "https://example.supabase.co/rest/v1/business_channels?select=id&limit=1");
  assert.equal(request.options.headers.apikey, "sb_secret_test");
  assert.equal("Authorization" in request.options.headers, false);
  assert.equal(request.options.method, "GET");
});

test("readiness keeps legacy JWT credentials compatible", async () => {
  let headers;
  const result = await checkAssistantReadiness({
    baseUrl:"https://example.supabase.co",
    secret:"legacy-service-role-jwt",
    openAiApiKey:"openai-test-key",
    routingApiKey:"routing-test-key",
    fetchImpl:async (_url, options) => {
      headers = options.headers;
      return {ok:true, status:200};
    }
  });
  assert.equal(result.ready, true);
  assert.equal(headers.Authorization, "Bearer legacy-service-role-jwt");
});

test("readiness fails closed on dependency HTTP errors", async () => {
  const result = await checkAssistantReadiness({
    baseUrl:"https://example.supabase.co",
    secret:"sb_secret_test",
    fetchImpl:async () => ({ok:false, status:401})
  });
  assert.deepEqual(result, {ready:false, reason:"DEPENDENCY_PROBE_FAILED"});
});

test("readiness fails closed and does not expose dependency errors", async () => {
  const result = await checkAssistantReadiness({
    baseUrl:"https://example.supabase.co",
    secret:"sb_secret_test",
    fetchImpl:async () => { throw new Error("private endpoint details"); }
  });
  assert.deepEqual(result, {ready:false, reason:"DEPENDENCY_PROBE_FAILED"});
});

test("readiness fails closed when a core AI or routing credential is missing", async () => {
  const result = await checkAssistantReadiness({
    baseUrl:"https://example.supabase.co",
    secret:"sb_secret_test",
    openAiApiKey:"openai-test-key",
    routingApiKey:"",
    fetchImpl:async () => { throw new Error("must not probe"); }
  });
  assert.deepEqual(result, {ready:false, reason:"DEPENDENCY_CONFIG_MISSING"});
});
