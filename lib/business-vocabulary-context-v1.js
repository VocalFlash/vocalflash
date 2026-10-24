// Normalize optional business terminology for model context.
// Vocabulary entries are data, never instructions or routing authority.
function clean(value, max = 120) {
  if (typeof value !== "string") return "";
  return value.normalize("NFC").replace(/\s+/gu, " ").trim().slice(0, max);
}
function cleanList(value, {maxItems = 8, maxLength = 120} = {}) {
  if (!Array.isArray(value)) return [];
  const seen = new Set(), result = [];
  for (const item of value) {
    const normalized = clean(item, maxLength);
    const key = normalized.toLocaleLowerCase("it-IT");
    if (!normalized || seen.has(key)) continue;
    seen.add(key); result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}
export function normalizeBusinessVocabulary(rows, limit = 100) {
  if (!Array.isArray(rows) || !Number.isInteger(limit) || limit < 1) return [];
  const seen = new Set(), result = [];
  for (const row of rows) {
    if (!row || row.is_active !== true) continue;
    const term = clean(row.term);
    if (!term) continue;
    const normalizedTerm = clean(row.normalized_term) || term.toLocaleLowerCase("it-IT");
    const key = normalizedTerm.toLocaleLowerCase("it-IT");
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = {term, normalized_term:normalizedTerm, category:clean(row.category, 80) || null};
    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : null;
    // Rich terminology is included only when explicitly reviewed; legacy canonical terms remain supported.
    if (metadata?.review_status === "approved") {
      const synonyms = cleanList(metadata.synonyms, {maxItems:8,maxLength:100}).filter(v => v.toLocaleLowerCase("it-IT") !== key && v.toLocaleLowerCase("it-IT") !== term.toLocaleLowerCase("it-IT"));
      const examples = cleanList(metadata.examples, {maxItems:3,maxLength:240});
      const confusable = cleanList(metadata.confusable_with, {maxItems:6,maxLength:120});
      const definition = clean(metadata.definition, 240);
      const disambiguation = clean(metadata.disambiguation, 240);
      const source = clean(row.source || metadata.source, 80);
      const version = clean(metadata.version, 40);
      if (synonyms.length) entry.synonyms = synonyms;
      if (definition) entry.definition = definition;
      if (disambiguation) entry.disambiguation = disambiguation;
      if (examples.length) entry.examples = examples;
      if (confusable.length) entry.confusable_with = confusable;
      if (source) entry.source = source;
      if (version) entry.version = version;
      entry.review_status = "approved";
    }
    result.push(entry);
    if (result.length >= limit) break;
  }
  return result;
}
