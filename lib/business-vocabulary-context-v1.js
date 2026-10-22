// Normalize optional business terminology for model context.
// Vocabulary entries are data, never instructions or routing authority.
function clean(value, max = 120) {
  if (typeof value !== "string") return "";
  // Canonical Unicode normalization and whitespace folding make equivalent
  // user-entered terms stable without removing meaningful accents or symbols.
  return value.normalize("NFC").replace(/\s+/gu, " ").trim().slice(0, max);
}

export function normalizeBusinessVocabulary(rows, limit = 100) {
  if (!Array.isArray(rows) || !Number.isInteger(limit) || limit < 1) return [];
  const seen = new Set();
  const result = [];

  for (const row of rows) {
    if (!row || row.is_active !== true) continue;
    const term = clean(row.term);
    if (!term) continue;

    const normalizedTerm = clean(row.normalized_term) || term.toLocaleLowerCase("it-IT");
    const key = normalizedTerm.toLocaleLowerCase("it-IT");
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      term,
      normalized_term: normalizedTerm,
      category: clean(row.category, 80) || null
    });
    if (result.length >= limit) break;
  }

  return result;
}
