# Professional terminology vocabulary — V2 design

Status: design specification, not implemented as a schema migration and not model-tested. This document deliberately does not claim the vocabulary is complete or production-ready.

## Current verified state

- The classifier reads only active rows from `business_vocabulary` for the resolved business, ordered by term and bounded to 100 entries.
- The runtime normalizer currently supports `term`, `normalized_term`, and `category`; it trims and bounds field lengths, skips inactive/empty entries, and deduplicates by normalized term.
- The classifier prompt explicitly treats vocabulary as untrusted interpretation context, not as instructions, intent, routing authority, or authorization.
- If the optional vocabulary lookup fails, classification continues without it and emits a generic diagnostic.
- The inspected live database snapshot had zero rows in `business_vocabulary`. Therefore the mechanism exists, but there is no populated business-specific vocabulary to call professionally complete.
- The current schema/source-of-truth migration history is not yet reconciled end to end. Do not create or apply a schema migration for vocabulary V2 until that release gate is cleared.

## Target record contract

Each canonical concept should eventually carry:

- `business_id`: tenant scope; never share terms across businesses implicitly.
- `sector_key`: the sector this entry applies to, when known.
- `term`: canonical professional expression to show in context.
- `normalized_term`: stable canonical lookup key.
- `synonyms`: reviewed alternatives, regional expressions, abbreviations, common misspellings, and customer-language variants.
- `definition`: short, domain-reviewed meaning.
- `category`: technical area or workflow concept.
- `disambiguation`: what this term does and does not mean in this business.
- `examples`: short synthetic utterances demonstrating correct use.
- `confusable_with`: nearby terms that must not be treated as equivalent.
- `source`, `review_status`, `reviewed_at`, `version`: provenance and quality control.
- `is_active`: explicit activation gate.

This is a target contract only; these fields are not claimed to exist in the live schema. Synonyms should be stored as structured data, not packed into a single unvalidated string.

## Data quality rules

1. A canonical concept has one stable key; synonyms point to that concept instead of creating duplicate concepts.
2. Do not assume two words are synonyms solely because they are semantically close. Keep meaningful distinctions, especially in technical, legal, financial, and medical contexts.
3. Preserve units, measurements, model numbers, product names, legal terms, and uncertainty. Never normalize away a distinction that can change the requested work.
4. Separate professional terms from colloquial/customer expressions. Store the mapping explicitly and retain the original customer wording in the event record.
5. Include regional variants only when confirmed for the target business or locality; do not assume one regional vocabulary fits every Italian business.
6. Entries are context only. A match cannot establish user intent, consent, required-data completeness, policy, role, or permission to create/modify a work item.
7. Do not infer a diagnosis, legal conclusion, financial eligibility, technical cause, or safety status from a vocabulary match.
8. Cap vocabulary size and per-entry lengths, reject malformed entries, deduplicate deterministically, and treat all vocabulary content as untrusted input.
9. Review additions against synthetic positive, negative, ambiguous, and adversarial utterances before activation.
10. Keep a human-reviewed source and version history; do not automatically learn and activate terms from customer conversations.

## Multi-sector starter coverage

Create separate, business-reviewed packs only when a real pilot workflow catalogue is available:

- Idraulica/manutenzione: sifone, colonna di scarico, perdita, pressione, caldaia, valvola, raccordo; distinguish symptom from confirmed cause.
- Edilizia/cantiere: infiltrazione, intonaco, massetto, tramezza, ponteggio, computo metrico; distinguish observation from diagnosis and quote from approved work.
- Immobiliare: visita, proposta, preliminare, rogito, caparra, planimetria; distinguish interest, viewing, offer, and binding commitment.
- Mediazione finanziaria: simulazione, istruttoria, rata, TAN, TAEG, LTV; never infer approval or eligibility.
- Legale: diffida, notifica, scadenza, procura, fascicolo; preserve exact dates and source documents, never infer a legal conclusion.
- Medico/ambulatoriale: visita, impegnativa, referto, anamnesi; preserve patient wording and avoid diagnosis or treatment inference.
- Generico: richiamata, appuntamento, preventivo, documentazione, richiesta informazioni; ask for clarification when intent is not supported.

These are examples for future reviewed packs, not a seed dataset and not a claim that all entries have been validated for any particular business.

## Evaluation required before calling it high quality

For each pilot business, keep a versioned test set with:
- real workflow catalogue and business-approved definitions;
- canonical terms, synonyms, local variants, and near-miss terms;
- messages with no actionable intent despite containing a technical term;
- ambiguous terms whose meaning depends on context;
- negation, corrections, quoted messages, voice transcription errors, abbreviations, numbers, units, and dates;
- adversarial vocabulary entries and prompt-injection-like customer text;
- expected classification, clarification behavior, extracted facts, uncertainty flags, and explicit no-write expectation.

Report false-positive routing separately from false negatives. A vocabulary change is accepted only if it improves relevant cases without increasing false-positive routes or weakening authorization. Re-run the existing classifier and intake guardrail suites after every change.

## Implementation sequence / gates

1. Reconcile the authoritative SQL migration source with the live migration registry.
2. Agree the first pilot business, sector, terminology owner, and workflows.
3. Decide a versioned schema and migration that supports synonyms, definitions, ambiguity notes, and review provenance.
4. Add strict runtime validation and bounded prompt rendering for the expanded schema.
5. Add synthetic regression tests for duplicates, invalid fields, malicious content, ambiguous terms, inactive entries, and cross-business isolation.
6. Populate a small human-reviewed vocabulary for the pilot business; do not populate production from generic assumptions.
7. Run controlled model-backed tests and review every false-positive before activating the pack.

Until these gates are complete, the accurate status is: **the vocabulary plumbing is implemented, but the professional vocabulary itself is not yet populated or proven complete.**
