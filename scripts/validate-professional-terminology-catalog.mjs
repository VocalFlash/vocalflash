import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const path = new URL("../docs/professional-terminology-catalog-v1-draft.json", import.meta.url);
const catalog = JSON.parse(readFileSync(path, "utf8"));
assert.equal(catalog.status, "DRAFT_NOT_RUNTIME_ENABLED", "catalog must remain explicitly draft");
assert.ok(Array.isArray(catalog.entries), "entries must be an array");
assert.ok(catalog.entries.length >= 300, "initial catalogue target is at least 300 entries");

const requiredSectors = [
  "plumbing_maintenance",
  "construction_site",
  "real_estate",
  "financial_intermediation",
  "legal",
  "medical",
  "generic"
];
for (const sector of requiredSectors) {
  assert.ok(catalog.entries.some(entry => entry.sector === sector), `missing required sector: ${sector}`);
}
assert.ok(!catalog.entries.some(entry => /pharma|pharmaceutical|farmaceut/i.test(entry.sector)), "pharmaceutical sector must remain outside initial scope");

const seen = new Set();
const counts = {};
let enriched = 0;
for (const [index, entry] of catalog.entries.entries()) {
  assert.equal(typeof entry.canonical_term, "string", `entry ${index} canonical_term must be a string`);
  assert.ok(entry.canonical_term.trim(), `entry ${index} canonical_term must not be empty`);
  assert.equal(typeof entry.normalized_term, "string", `entry ${index} normalized_term must be a string`);
  assert.ok(entry.normalized_term.trim(), `entry ${index} normalized_term must not be empty`);
  assert.ok(requiredSectors.includes(entry.sector), `entry ${index} has an unexpected sector`);
  assert.equal(entry.review_status, "draft", `entry ${index} must not be silently promoted to approved`);
  assert.equal(typeof entry.review_note, "string", `entry ${index} must disclose review state`);
  const key = `${entry.sector}|${entry.normalized_term.normalize("NFC").trim().toLocaleLowerCase("it-IT")}`;
  assert.ok(!seen.has(key), `duplicate normalized term in sector: ${key}`);
  seen.add(key);
  counts[entry.sector] = (counts[entry.sector] || 0) + 1;

  if (entry.enrichment_status === "content_enriched_needs_domain_review") {
    enriched++;
    assert.ok(Array.isArray(entry.synonyms) && entry.synonyms.length > 0, `enriched entry ${index} needs synonyms`);
    assert.ok(typeof entry.definition === "string" && entry.definition.trim(), `enriched entry ${index} needs a definition`);
    assert.ok(typeof entry.disambiguation === "string" && entry.disambiguation.trim(), `enriched entry ${index} needs disambiguation`);
    assert.ok(Array.isArray(entry.examples) && entry.examples.length > 0, `enriched entry ${index} needs examples`);
    assert.ok(Array.isArray(entry.confusable_with) && entry.confusable_with.length > 0, `enriched entry ${index} needs confusable terms`);
  }
}
assert.equal(seen.size, catalog.entries.length, "all sector-scoped canonical terms must be unique");
assert.ok(enriched >= 70, "at least 70 entries should have structured editorial enrichment across the initial sectors");

console.log(JSON.stringify({
  status: catalog.status,
  total_entries: catalog.entries.length,
  enriched_draft_entries: enriched,
  sector_counts: counts,
  pharmaceutical_sector_excluded: true,
  duplicate_sector_terms: 0
}, null, 2));
