import test from "node:test";
import assert from "node:assert/strict";
import {normalizeRequiredFields} from "./new-work-required-data-extractor-v1.js";

test("accepts the documented array shape", () => {
  const result = normalizeRequiredFields([
    {key: "address", label: "Indirizzo", type: "string"}
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.configured, true);
  assert.equal(result.fields[0].key, "address");
});

test("accepts the documented fields-array shape", () => {
  const result = normalizeRequiredFields({
    fields: [{key: "issue", label: "Problema"}]
  });
  assert.equal(result.ok, true);
  assert.equal(result.configured, true);
  assert.equal(result.fields[0].key, "issue");
});

test("treats an empty object as no configured required data", () => {
  const result = normalizeRequiredFields({});
  assert.equal(result.ok, true);
  assert.equal(result.configured, false);
});

test("fails closed on arbitrary keyed objects instead of guessing fields", () => {
  const result = normalizeRequiredFields({
    address: "Indirizzo",
    issue: {label: "Problema"}
  });
  assert.equal(result.ok, false);
  assert.equal(result.configured, false);
  assert.equal(result.reason, "REQUIRED_DATA_OBJECT_SHAPE_UNSUPPORTED");
  assert.deepEqual(result.fields, []);
});

test("fails closed on malformed fields-array entries", () => {
  const result = normalizeRequiredFields({fields: [{label: "Senza chiave"}]});
  assert.equal(result.ok, false);
  assert.equal(result.reason, "REQUIRED_FIELD_KEY_INVALID");
});
