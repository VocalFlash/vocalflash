import test from "node:test";
import assert from "node:assert/strict";
import {supabaseRestHeaders} from "./supabase-rest-headers-v1.js";

test("modern Supabase secret keys use apikey without invalid Bearer JWT", () => {
  assert.deepEqual(supabaseRestHeaders("sb_secret_test", {contentType:true}), {
    apikey:"sb_secret_test",
    Accept:"application/json",
    "Content-Type":"application/json"
  });
});

test("legacy JWT credentials preserve Bearer compatibility", () => {
  assert.deepEqual(supabaseRestHeaders("legacy-jwt", {extra:{"X-Test":"yes"}}), {
    apikey:"legacy-jwt",
    Accept:"application/json",
    "X-Test":"yes",
    Authorization:"Bearer legacy-jwt"
  });
});

test("missing credentials fail closed", () => {
  assert.throws(() => supabaseRestHeaders(""), /SUPABASE_REST_CREDENTIAL_REQUIRED/);
});
