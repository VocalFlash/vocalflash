import test from "node:test";
import assert from "node:assert/strict";
import {normalizeBusinessVocabulary} from "./business-vocabulary-context-v1.js";

test("normalizes and bounds business vocabulary fields", () => {
  const result = normalizeBusinessVocabulary([
    {term:"colonna di scarico", normalized_term:"scarico", category:"idraulica", is_active:true},
    {term:"  ", normalized_term:"", is_active:true},
    {term:"presa Schuko", category:"elettrico", is_active:true}
  ]);

  assert.deepEqual(result, [
    {term:"colonna di scarico", normalized_term:"scarico", category:"idraulica"},
    {term:"presa Schuko", normalized_term:"presa schuko", category:"elettrico"}
  ]);
});

test("ignores inactive entries and duplicate normalized terms", () => {
  const result = normalizeBusinessVocabulary([
    {term:"caldaia", normalized_term:"caldaia", is_active:false},
    {term:"caldaia murale", normalized_term:"caldaia", is_active:true},
    {term:"CALDAIA", normalized_term:"CALDAIA", is_active:true}
  ]);

  assert.deepEqual(result, [
    {term:"caldaia murale", normalized_term:"caldaia", category:null}
  ]);
});

test("caps field lengths and total entries", () => {
  const result = normalizeBusinessVocabulary([
    {term:"x".repeat(200), normalized_term:"y".repeat(200), category:"z".repeat(100)},
    {term:"second", is_active:true}
  ], 1);

  assert.equal(result.length, 1);
  assert.equal(result[0].term.length, 120);
  assert.equal(result[0].normalized_term.length, 120);
  assert.equal(result[0].category.length, 80);
});

test("ignores entries without an explicit active flag", () => {
  assert.deepEqual(normalizeBusinessVocabulary([{term:"termine non verificato"}]), []);
});

test("returns an empty list for invalid or empty input", () => {
  assert.deepEqual(normalizeBusinessVocabulary(null), []);
  assert.deepEqual(normalizeBusinessVocabulary([]), []);
  assert.deepEqual(normalizeBusinessVocabulary([{term:"x"}], 0), []);
});
