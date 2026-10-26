import test from "node:test";
import assert from "node:assert/strict";
import {normalizeBusinessVocabulary} from "./business-vocabulary-context-v1.js";

test("normalizes and bounds business vocabulary fields", () => {
  assert.deepEqual(normalizeBusinessVocabulary([
    {term:"colonna di scarico", normalized_term:"scarico", category:"idraulica", is_active:true},
    {term:"  ", normalized_term:"", is_active:true},
    {term:"presa Schuko", category:"elettrico", is_active:true}
  ]), [
    {term:"colonna di scarico", normalized_term:"scarico", category:"idraulica"},
    {term:"presa Schuko", normalized_term:"presa schuko", category:"elettrico"}
  ]);
});
test("ignores inactive entries and duplicate normalized terms", () => {
  assert.deepEqual(normalizeBusinessVocabulary([
    {term:"caldaia", normalized_term:"caldaia", is_active:false},
    {term:"caldaia murale", normalized_term:"caldaia", is_active:true},
    {term:"CALDAIA", normalized_term:"CALDAIA", is_active:true}
  ]), [{term:"caldaia murale", normalized_term:"caldaia", category:null}]);
});
test("canonicalizes Unicode and whitespace before deduplication", () => {
  assert.deepEqual(normalizeBusinessVocabulary([
    {term:"  perdita\u00a0 d’acqua ", normalized_term:"perdita  acqua", category:" idraulica  ", is_active:true},
    {term:"perdita acqua", normalized_term:"perdita acqua", category:"altro", is_active:true},
    {term:"cafe\u0301", is_active:true}, {term:"café", is_active:true}
  ]), [
    {term:"perdita d’acqua", normalized_term:"perdita acqua", category:"idraulica"},
    {term:"café", normalized_term:"café", category:null}
  ]);
});
test("caps field lengths and total entries", () => {
  const result = normalizeBusinessVocabulary([
    {term:"x".repeat(200), normalized_term:"y".repeat(200), category:"z".repeat(100), is_active:true},
    {term:"second", is_active:true}
  ], 1);
  assert.equal(result.length, 1); assert.equal(result[0].term.length, 120);
  assert.equal(result[0].normalized_term.length, 120); assert.equal(result[0].category.length, 80);
});
test("ignores entries without an explicit active flag", () => {
  assert.deepEqual(normalizeBusinessVocabulary([{term:"termine non verificato"}]), []);
});
test("returns an empty list for invalid or empty input", () => {
  assert.deepEqual(normalizeBusinessVocabulary(null), []);
  assert.deepEqual(normalizeBusinessVocabulary([]), []);
  assert.deepEqual(normalizeBusinessVocabulary([{term:"x"}], 0), []);
});
test("uses richer terminology only when metadata is explicitly approved", () => {
  const result = normalizeBusinessVocabulary([
    {term:"colonna di scarico", normalized_term:"scarico", category:"idraulica", source:"revisione tecnico", is_active:true,
      metadata:{review_status:"approved",version:"1.0",synonyms:["scarico verticale"," scarico verticale ","colonna di scarico"],
        definition:"Condotta verticale che raccoglie gli scarichi.",disambiguation:"Non indica necessariamente un'ostruzione.",
        examples:["La colonna di scarico perde al piano terra."],confusable_with:["tubo di adduzione","montante idrico"]}},
    {term:"termine non revisionato",is_active:true,metadata:{review_status:"draft",synonyms:["alias inventato"],definition:"Non validata"}}
  ]);
  assert.deepEqual(result, [
    {term:"colonna di scarico",normalized_term:"scarico",category:"idraulica",
      synonyms:["scarico verticale"],definition:"Condotta verticale che raccoglie gli scarichi.",
      disambiguation:"Non indica necessariamente un'ostruzione.",examples:["La colonna di scarico perde al piano terra."],
      confusable_with:["tubo di adduzione","montante idrico"],source:"revisione tecnico",version:"1.0",review_status:"approved"},
    {term:"termine non revisionato",normalized_term:"termine non revisionato",category:null}
  ]);
});
test("bounds and deduplicates rich metadata and rejects malformed metadata", () => {
  const result = normalizeBusinessVocabulary([
    {term:"caldaia",is_active:true,metadata:{review_status:"approved",synonyms:["x".repeat(200),"CALDAIA","alias"],
      examples:["e".repeat(300),"esempio"],definition:"d".repeat(300),confusable_with:"not-an-array"}},
    {term:"bad metadata",is_active:true,metadata:["not","an","object"]}
  ]);
  assert.equal(result[0].synonyms[0].length,100); assert.deepEqual(result[0].synonyms.slice(1),["alias"]);
  assert.equal(result[0].examples[0].length,240); assert.equal(result[0].definition.length,240);
  assert.equal(result[0].confusable_with,undefined);
  assert.deepEqual(result[1],{term:"bad metadata",normalized_term:"bad metadata",category:null});
});
