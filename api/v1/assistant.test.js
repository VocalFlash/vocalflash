import test from "node:test";
import assert from "node:assert/strict";
import handler from "./assistant.js";

const envNames = [
  "VOCALFLASH_ASSISTANT_API_KEYS",
  "VF_ASSISTANT_SUPABASE_URL",
  "VF_ASSISTANT_SUPABASE_SECRET_KEY",
  "OPENAI_API_KEY",
  "VOCALFLASH_API_KEYS"
];

function responseRecorder() {
  const state = {status:200, body:null, headers:{}};
  const res = {
    setHeader(name, value) { state.headers[name] = value; return res; },
    status(value) { state.status = value; return res; },
    json(value) { state.body = value; return state; },
    end() { return state; }
  };
  return {res, state};
}

async function callHealth() {
  const {res, state} = responseRecorder();
  await handler({
    method:"POST",
    headers:{"x-vocalflash-assistant-key":"assistant-test-key"},
    body:{action:"health"}
  }, res);
  return state;
}

test("health rejects invalid Assistant API keys", async t => {
  const previous = Object.fromEntries(envNames.map(k => [k, process.env[k]]));
  t.after(() => {
    for (const k of envNames) previous[k] === undefined ? delete process.env[k] : process.env[k] = previous[k];
  });
  process.env.VOCALFLASH_ASSISTANT_API_KEYS = "different-key";
  let called = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { called = true; return {ok:true}; };
  t.after(() => { globalThis.fetch = originalFetch; });
  const result = await callHealth();
  assert.equal(result.status, 401);
  assert.equal(called, false);
});

test("health fails closed when a required dependency credential is missing", async t => {
  const previous = Object.fromEntries(envNames.map(k => [k, process.env[k]]));
  t.after(() => {
    for (const k of envNames) previous[k] === undefined ? delete process.env[k] : process.env[k] = previous[k];
  });
  process.env.VOCALFLASH_ASSISTANT_API_KEYS = "assistant-test-key";
  delete process.env.VF_ASSISTANT_SUPABASE_URL;
  delete process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY;
  process.env.OPENAI_API_KEY = "openai-test-key";
  process.env.VOCALFLASH_API_KEYS = "routing-test-key";
  const result = await callHealth();
  assert.equal(result.status, 503);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.ready, false);
  assert.equal(result.body.reason, "DEPENDENCY_CONFIG_MISSING");
});

test("health reports ready only after the bounded read-only dependency probe succeeds", async t => {
  const previous = Object.fromEntries(envNames.map(k => [k, process.env[k]]));
  t.after(() => {
    for (const k of envNames) previous[k] === undefined ? delete process.env[k] : process.env[k] = previous[k];
  });
  process.env.VOCALFLASH_ASSISTANT_API_KEYS = "assistant-test-key";
  process.env.VF_ASSISTANT_SUPABASE_URL = "https://example.supabase.co";
  process.env.VF_ASSISTANT_SUPABASE_SECRET_KEY = "sb_secret_test";
  process.env.OPENAI_API_KEY = "openai-test-key";
  process.env.VOCALFLASH_API_KEYS = "routing-test-key";
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options) => {
    request = {url:String(url), options};
    return {ok:true, status:200};
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const result = await callHealth();
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.ready, true);
  assert.equal(result.body.reason, "DEPENDENCIES_AVAILABLE");
  assert.equal(request.options.headers.apikey, "sb_secret_test");
  assert.equal("Authorization" in request.options.headers, false);
  assert.equal(JSON.stringify(result.body).includes("example.supabase.co"), false);
});
