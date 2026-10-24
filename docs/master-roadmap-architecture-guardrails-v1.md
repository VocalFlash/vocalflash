# VocalFlash — master roadmap and architecture guardrails v1

**Updated:** 2026-10-24  
**Status:** planning/engineering record on the isolated development branch. This document does not authorize database changes, merges, purchases, or deployments.

## Product definition

VocalFlash is an assistant operating through WhatsApp, not merely a transcription utility. Its job is to turn voice notes, customer messages, and (later) media into a clear, safe next step: understand intent, preserve important details, identify missing or uncertain data, ask targeted follow-up questions, prepare an actionable request, and perform only actions permitted by the configured business policy.

The original voice-note summarizer remains a valuable entry point. The core user value is the concise synthesis and salient facts, not dumping a full transcript by default.

## Collaboration and release rules

- Keep **implemented**, **tested**, **designed**, **blocked**, and **not started** distinct.
- A green unit test or Vercel Preview is not proof of a complete WhatsApp/Supabase/Vercel end-to-end flow.
- Do not merge the Assistant API and Python bot independently: the bot relies on the Assistant API's `assistant_message` contract.
- Do not change production, live schema/data, Meta subscriptions, Render start commands, secrets, paid services, or billing settings without the appropriate explicit approval.
- The current customer-assistant PRs stay Draft until staging integration and release gates pass.
- Do not expose full source code in progress updates unless specifically requested; report outcomes, evidence, blockers, and the next controlled action.
- Never claim a test, migration, deployment, or end-to-end scenario ran unless there is an execution result proving it.

## Verified baseline at this revision

- The WhatsApp voice-note flow has previously succeeded end to end: Meta webhook → Render/Python bot → transcription → reply. That historic success does not establish that every newer assistant feature is deployed.
- MultiVocale and audio processing remain on the legacy path while the customer-text assistant is isolated behind a separate wrapper/branch.
- The central Assistant development PR adds persisted event ingest/routing, guarded new-work intake, required-data extraction and collection plans, fail-closed classifier validation, deterministic customer replies, and bounded read-only business vocabulary context.
- Latest inspected JavaScript CI runs on 2026-10-23 were green; the latest inspected Python bot CI on 2026-10-22 was green. These are focused automated checks, not full production or staging E2E proof.
- The Supabase business catalogue remains a synthetic staging fixture, not a real pilot business. A guarded seed now configures one active plumbing/maintenance workflow with three required fields, a confirmation-required policy, and 14 active canonical terms whose extended metadata remains draft. No verified owner/member exists; do not present this as a configured real pilot. The authoritative operational baseline is [Libro sacro VocalFlash](https://github.com/VocalFlash/vocalflash/blob/assistant-conversation-photo-v1/docs/libro-sacro-vocalflash-operational-baseline-v1.md).
- Owner confirmation writes remain disabled with `ATOMIC_CONFIRMATION_NOT_ENABLED`. Keep them disabled until confirmation binding, expiry, one-time consumption, and the write are atomic and tested.
- Meta webhook signature verification exists on the bot development branch but is not proven active in Render. The correct `META_APP_SECRET` must be configured and tested in the target environment before rollout.
- Durable outbound delivery/reconciliation and persistent multi-turn conversation state are not complete.
- The development database branch was deliberately deferred pending approval of its current cost. Do not create it or apply migrations to production as a workaround.

## Product roadmap by capability

### P0 — safe customer-assistant foundation

1. **Multi-turn conversation state (designed; implementation blocked on safe development DB/migration path).**
   - Scope identity by business + channel + contact/sender.
   - Persist active workflow, collected field values and provenance, uncertainty/confirmation status, current proposal, last event, expiry and version.
   - Resume after process restart; isolate tenants; serialize concurrent turns.
   - Do not merge unrelated requests just because they share a sender.
2. **Confirmation and work creation (guarded; owner writes intentionally disabled).**
   - Re-evaluate workflow, required data and effective policy at commit time.
   - Bind a confirmation to the exact business, channel, authorized member, proposal/version, source event and expiry.
   - Consume confirmation once in the same transaction as the write; replay/concurrency must not create a second effect.
   - Missing/invalid policy, uncertain required data, ambiguous routing and multi-workflow cases remain non-writing.
3. **Durable outbound outbox (designed/required; not implemented).**
   - Persist each outbound intent before attempting WhatsApp delivery.
   - Use a stable idempotency key, attempt state, provider message ID, timestamps and normalized failure category.
   - Distinguish queued, attempted, accepted by provider, delivered (if callback confirms), failed and ambiguous.
   - Never call an HTTP timeout proof of failure or proof of delivery; reconcile ambiguous sends rather than blindly retrying.
4. **Staging integration.**
   - Validate Meta signature, inbound ingest, persisted routing, assistant response contract, actual outbound WhatsApp reply, retries and duplicate webhook delivery together.
   - Test the current production audio/MultiVocale path separately to prove it remains unchanged.

### P1 — richer input and business workflows

5. **Photo/document intake and vision (planned; no complete end-to-end path yet).**
   - Support media-only messages without inventing placeholder text or weakening the current non-empty-text ingest contract.
   - Store media metadata and a secure reference; define retention/deletion rules before storing original media.
   - Analyze media separately from authorization. Return extracted observations with uncertainty and ask for clarification when needed.
   - Never infer a definitive diagnosis, legal conclusion, financial approval, damage cause, or safety status from a photo alone.
6. **Professional terminology vocabulary (bounded read-only context implemented in development; per-business population/quality validation pending).**
   - Canonical terms, normalized forms, synonyms, category, short definition, sector, optional examples and reviewed/active status.
   - Scope lookup to the current business and active terms; cap payload size.
   - Vocabulary may improve interpretation but must never create intent, add a workflow, override policy, or authorize a write.
   - Add evaluation cases for synonyms, misspellings, regional Italian, speech-recognition errors, homonyms, and a term used without an actionable request.
7. **Multi-sector workflow catalogue (classifier guardrails implemented; realistic model-backed test battery pending).**
   - Initial sectors under consideration: idraulica, edilizia/cantiere, immobiliare, mediazione finanziaria, legale, medico and generic.
   - Do not include a pharmaceutical-sector example in the initial sector catalogue; pharmacy workflows may be addressed separately if a real use case justifies them.
   - Configure each pilot business with its own workflows, required fields, policies, authorized members and vocabulary.
   - Evaluate false-positive routing separately from false negatives; ambiguous/multi-workflow results must not auto-create or auto-split work.
8. **Owner commands and operational actions (design/partial groundwork; not safe to enable yet).**
   - Separate customer messages from authenticated owner commands.
   - Verify member, channel, business and exact proposal before scheduling, adding notes or changing a work item.
   - Use preview → explicit confirmation → atomic commit → durable notification, with an audit trail.
9. **Voice-note synthesis and transcription quality (legacy flow has worked; quality and provider comparison remain open).**
   - Preserve the default concise summary and salient details; provide a full transcript only when requested or when a defined workflow needs it.
   - Regression corpus should include at least 50 representative Italian voice notes, including proper names, addresses, numbers, technical terms, dates and negation.
   - Compare supported transcription providers/models on critical word error, omission of action items, latency, token/audio cost, language performance and data handling. Check current provider availability and deprecation notices immediately before selecting a replacement; do not assume model names or timelines are current.
   - Do not replace the working transcription path until the benchmark and rollback criteria are documented.
10. **MultiVocale (existing capability; reliability regression required).**
    - Preserve the first vocal when the user requests a multi-vocal summary and append subsequent vocals.
    - Keep the manual command and automatic batching behavior compatible.
    - Test the sliding batching window, concurrent arrivals, duplicate events, late arrivals, process restart and no-double-reply behavior.
    - Verify the summary focuses on salient points and actions, not a full transcript by default.

### P2 — account, commercial and ecosystem expansion

11. **Account and billing (planned; not release-ready).**
    - Establish account/business/member/channel boundaries before onboarding multiple customers.
    - Define signup, verified contact, plan selection, payment success/failure, activation, renewal, cancellation, invoice/support paths and account deletion.
    - Do not activate paid access until payment state is verified server-side and entitlement checks are enforced by the backend.
    - Stripe/Bird/Supabase Auth choices must be verified against the actual product setup before implementation. Previous direction was Supabase Auth with Bird SMS Send SMS Hook, not Bird Verify; no unverified purchase or key setup.
12. **Privacy and security.**
    - Minimize persisted message content; never log secrets, full phone numbers, raw customer messages or sensitive field values by default.
    - Establish retention/deletion, data export, access control, incident response, vendor disclosures and consent notices for audio/media before launch.
    - Reconcile versioned migrations with the live Supabase migration registry.
    - Review RLS, grants, SECURITY DEFINER functions, function search paths, FK indexes and advisor findings; do not mechanically delete unused indexes based on a tiny/test dataset.
13. **VocalFlash Gruppi / WhatsApp Groups (research required; not implemented).**
    - Verify current official Meta documentation and policy support before promising access to existing groups.
    - Separate official API capabilities from unsupported workarounds; do not use unofficial scraping or user-account automation.
    - Model group membership, consent, message access, summary scope and scheduled/on-demand summary costs before deciding whether to build.
14. **VocalFlash Green / Sentinella Naxos Pearl (future vertical, not part of the first release).**
    - Volunteer sends a WhatsApp photo, location and voice/text report.
    - Extract reported place, waste type, approximate quantity and urgency/needs, preserving uncertainty.
    - Require a human review/assignment workflow; do not claim a location or quantity is exact when inferred.
15. **Public site, questionnaire and launch operations.**
    - Keep the questionnaire in the site repository, not the Python bot.
    - Resolve the questionnaire Preview Supabase credential issue (the audited secret returned HTTP 401) separately from Assistant configuration.
    - Re-check Vercel plan/production commercial eligibility, privacy/legal pages, monitoring and support procedures before public launch.

## Acceptance criteria before a first paid pilot

- One real pilot business has approved workflows, required fields, policies, members, vocabulary and customer-facing wording.
- Customer text can be received, resumed across multiple turns and restarted safely with no cross-business leakage.
- Missing/uncertain required fields prompt for clarification; no creation on ambiguity or absent policy.
- A valid confirmation is proposal-bound, expires, is consumed once, and commits atomically.
- Duplicate and concurrent webhook deliveries do not duplicate writes or customer replies.
- Outbound sends have persistent attempt/delivery state and an operator-visible path for ambiguous outcomes.
- Signed Meta webhooks pass; missing/invalid signatures fail closed in the actual staging service.
- Audio/MultiVocale regression tests pass without changing the legacy production path prematurely.
- Media intake respects retention/access controls and does not fabricate text.
- Multi-sector tests report per-case pass/fail, false positives/negatives, API errors, latency, tokens and estimated cost.
- Migration provenance, database privileges, logs, retention, deployment rollback and support runbooks are reviewed.
- Both repositories pass CI and the combined staging E2E flow; only then may a separate release approval be considered.

## Immediate next sequence

1. Continue source-level review and focused tests on the isolated branches; correct defects that can be safely addressed without a live schema.
2. Resolve whether the user approves the current quoted cost for a Supabase development branch before creating it. Until then, keep schema work at design/test-fixture level.
3. Keep the new plumbing/maintenance workflow and vocabulary as synthetic staging fixtures; review them with a real pilot business before activation outside staging.
4. Implement persistent conversation state, atomic confirmation and outbox only through a versioned migration in the approved development environment.
5. Implement media ingestion and model-backed sector/terminology evaluations after the persistence and safety contracts are stable.
6. Keep the PRs Draft and production untouched until the release gates above are evidenced.


## Operational source of truth

The current verified status, user guardrails, staging seed result, unresolved owner identity, and prioritized release gates are maintained in [Libro sacro VocalFlash — operational baseline v1](https://github.com/VocalFlash/vocalflash/blob/assistant-conversation-photo-v1/docs/libro-sacro-vocalflash-operational-baseline-v1.md). Read it before every further implementation step and update it after material changes.

## Owner decision register and glossary target (updated 2026-10-23)

The detailed approval checklist and official cost/reference links live in the [Libro sacro — section 10](https://github.com/VocalFlash/vocalflash/blob/assistant-conversation-photo-v1/docs/libro-sacro-vocalflash-operational-baseline-v1.md#10-decisioni-e-interventi-richiesti-al-titolare). Do not create paid resources or live integrations before the corresponding explicit approval.

- **Supabase development branch:** pending approval; last available quote was $0.01344/hour (~$9.68 for 30 days continuous), recheck before creation.
- **Bird SMS:** pending approval; published Italy rate consulted 2026-10-23 was $0.065 per segment, with possible carrier/sender/registration costs. Supabase Auth + Bird Send SMS Hook remains the intended path; no provider account/hook is configured.
- **Payments:** product decision pending. Candidate is Stripe Checkout + Billing, cards and eligible Apple Pay/Google Pay; decide whether to include SEPA Direct Debit, plans/prices, trial, billing cadence, dunning/suspension and cancellation/refund rules before implementing. Published card/Billing fees are recorded in the Libro sacro and must be rechecked before live setup.
- **Real business member:** blocked until a real verified Supabase Auth identity exists; no placeholder member or fabricated UUID.
- **Professional terminology:** target at least **300 curated, non-duplicative entries** across plumbing/maintenance, construction/site work, real estate, financial intermediation, legal, medical and generic language. Pharmacy remains outside the initial catalogue. Each term must carry sector/category, normalization, variants/synonyms, definition, disambiguation, examples and review status as applicable; draft entries remain non-authoritative until reviewed. Vocabulary never authorizes actions or substitutes for evidence/policy.
- **Pilot business approval:** a real authorized domain owner must approve the sector workflow, required fields, policy, customer-facing text and sector vocabulary before real customer use.

Work that has no unapproved cost or production impact should continue autonomously: source review, tests, glossary draft creation, migration provenance analysis, persistence/outbox design and CI/Preview checks. Keep both PRs Draft, owner writes fail-closed, and production untouched.

### Terminology catalog progress — 2026-10-23
A draft index has been added at [professional-terminology-catalog-v1-draft.json](https://github.com/VocalFlash/vocalflash/blob/assistant-conversation-photo-v1/docs/professional-terminology-catalog-v1-draft.json): **699 candidate entries** across the initial six business domains plus generic language. This satisfies the initial quantity target as an inventory only, not the quality/review target. Synonyms, definitions, disambiguation, examples and domain review remain incomplete; all entries are draft and must not be bulk-imported or treated as approved runtime context. Enrich and validate sector by sector, then import only reviewed terms into a business-scoped vocabulary.

### Catalog validation implementation — 2026-10-23
- The draft catalog now has 699 unique sector-scoped entries; a read-only structural audit found 100 enriched entries across the initial sectors and no duplicate sector/normalized-term pairs. All entries remain draft; no expert review or runtime import is implied.
- Added `scripts/validate-professional-terminology-catalog.mjs` and added its invocation to the Assistant test workflow. Its GitHub Actions result is pending confirmation; do not treat the local structural audit as CI evidence.
- Next autonomous glossary step: enrich another carefully scoped batch and add semantic/sector review checks without promoting terms to approved or importing draft entries into the database.

### Supabase branch quote rechecked — 2026-10-23

Current read-only quote for the existing project's organization remains $0.01344/hour. This is ~$9.68 per 720 hours (30 days) or ~$9.81 per 730 hours, before other possible usage. No branch created; explicit owner approval remains required.

### Catalog enrichment batch 2 — 2026-10-23
The draft catalog now has 699 candidate entries, of which 100 have preliminary synonyms, definitions, disambiguation, examples and confusable terms across all initial sectors. All remain draft pending domain review. The structural validator now requires at least 100 enriched entries; the read-only audit passed with 699 unique sector-scoped terms and no structural issues. Do not treat this as CI or domain-expert approval.

### Owner action register — pilot and privacy

- Initial validation direction: **3–5 potential customers**, without building a full multi-business management layer prematurely; keep VocalFlash WhatsApp and VocalFlash API consumption/billing distinguishable.
- Before real customer use, the owner must identify the pilot activity and an authorized domain reviewer for the workflow, required fields, customer-facing copy and vocabulary.
- Before paid launch, the owner must supply the real controller/legal identity and privacy contact, agree retention/deletion criteria, and arrange qualified review of the privacy notice, Article 28 DPA, B2B terms and international-transfer safeguards. Do not invent legal details or retention periods.
- Detailed checklist: [Libro sacro, sections 10 and D7](https://github.com/VocalFlash/vocalflash/blob/assistant-conversation-photo-v1/docs/libro-sacro-vocalflash-operational-baseline-v1.md).

### Phone verification / Bird SMS hook — 2026-10-24

- A separate Draft PR #9 was opened from the clean `main` base: https://github.com/VocalFlash/vocalflash/pull/9. It contains the isolated Supabase Auth Send SMS hook and its activation checklist; it is intentionally not merged.
- Static source review only: hook signature verification, input validation, bounded request body/provider timeout, minimal non-sensitive error logging, and fail-closed behavior for missing configuration are present.
- Automated tests are not yet added/run. The Edge Function is not deployed; Supabase Auth hook settings and secrets are not configured; Bird account/sender/Italy allowlist are not verified; no SMS or OTP test has been sent.
- Current read-only Supabase check: project `VocalFlash Assistant` is `ACTIVE_HEALTHY`; 15 migrations recorded; zero Edge Functions; zero `auth.users`; zero `business_members`.
- Next gates: add and run automated tests; confirm current Bird pricing, sender and destination eligibility; request explicit owner approval before creating credentials/paid setup or sending a billable SMS; deploy only to non-production; complete phone verification in the trusted UI; link the owner to the business only after Supabase Auth verification. Never create a fake user/member or mark a phone verified manually.
- No live schema/data, production service, secrets, paid resource or deployment was changed by this work.


### Autonomous work update — 2026-10-24

**Terminology catalog**
- Total candidates remain 699 across 7 initial sectors; 120 now have structured preliminary enrichment. All remain draft and disabled for approved runtime context.
- Another 20 plumbing/maintenance terms were enriched with synonyms, definitions, ambiguity warnings, examples and confusable terms. No pharmaceutical sector added.
- Re-run the validator/CI against the exact latest branch head. A previous successful run predates these changes and is not evidence for the current head.

**Persistent multi-turn state and atomic owner confirmation**
- Added design record `docs/persistent-conversation-and-owner-confirmation-design-v1.md`.
- Required invariants: tenant/workflow scoping, field provenance, versioned proposals, confirmation invalidation on changed inputs, one-time confirmation/replay protection, atomic consume-and-command creation, unique logical write key, lease/fencing, restart recovery and fail-closed handling of unknown outcomes.
- This remains design only. Persistent multi-turn runtime and atomic owner confirmation are not declared implemented. Keep writes gated until implementation, automated concurrency/failure tests and isolated staging evidence exist.

**WhatsApp outbox**
- Existing bot delivery-recovery design remains the source of the detailed failure-boundary analysis. Meta acceptance followed by a crash before local state persistence can leave delivery ambiguous; status callback reconciliation is still missing.
- Required: durable outbox/attempt ledger, persist provider message ID, authenticated and idempotent status callback processing, no state regression on out-of-order callbacks, and `outcome_unknown` without blind resend.
- Exactly-once must not be claimed unless a provider-supported idempotency/reconciliation guarantee proves it.

**Owner recommendations book**
- Created `docs/libro-raccomandazioni-titolare-vocalflash-v1.md` as a second living document, separate from the technical source-of-truth Libro sacro.
- It records the collaboration protocol, product direction, vocabulary rules, fail-closed and owner-confirmation requirements, persistence/outbox safety, cost/privacy gates and evidence standards.

**Verification and release gates**
- No new database schema, migration, secret, environment setting, paid resource, SMS, production deployment or live data change.
- Current head CI after the latest catalog/docs commits is not yet confirmed. Do not infer current CI success from earlier runs or from a Vercel Preview result.
- Continue autonomous code review, test design/implementation and documentation. Before activating Bird SMS, first add automated tests and obtain explicit cost approval for any billable provider setup or real SMS.

- Verification checkpoint: GitHub Actions run #324 (`40076814169`) passed on commit `d4cea0a6829d97555d581d0e6aad0c5185b33e46`, including catalog validation and focused assistant tests. This is evidence for that exact commit only; re-check CI after the current documentation updates produce a new head.
- Vercel Preview for that commit was still pending at the last status query. Do not report it as ready until the status is terminal.

- Latest re-check: GitHub Actions run #328 (`40076877316`) passed on branch head `6dba0c0a0345c6b975c424fed7ee30c3cd164ad2`, including draft catalog validation and focused Assistant tests. The Vercel status for that commit was still pending at the time of the check. The next docs-only commit will trigger another CI run; do not extrapolate the current result to a newer SHA.


## Owner recommendations register — 2026-10-24

The canonical owner recommendations register was consolidated at `docs/libro-raccomandazioni-titolare-vocalflash-v1.md`. It now explicitly records the dynamic-register rule: remove closed items from the active list while retaining evidence in history, add new recommendations, and mark paused items as paused. A plan or documentation entry is not proof of implementation.

The register also consolidates the latest overrides and product/engineering constraints for concise but evidence-based reporting, preserving the working deployed path, validating V4 before expanding terminology, single unified MultiVocale summaries, source-data provenance, fail-closed behavior, atomic owner confirmation, durable multi-turn state, concurrency/replay protection, WhatsApp outbox reconciliation, no invented identities, privacy/cost approvals, and evidence tied to the exact commit.

CI run #330 (`40076914648`) completed successfully on `e00dd7f7dd585817011ab3ab28b33ea0173ee840`. Since this roadmap update creates a newer head, do not treat that run as validation of the current head; re-check CI and Preview on the latest revision.

## Fail-closed policy applicability — 2026-10-24

The read-only NEW work-creation policy gate was tightened: only rows with an explicit boolean `is_active === true` can participate in effective policy resolution. Missing/null activity flags can no longer make a permissive policy appear applicable. A regression test covers missing, null and false values with `autonomy_mode: auto`; the expected outcome is `CONFIG_REQUIRED`, with no authorization and no writes.

This correction does not implement persistent multi-turn state, atomic owner confirmation, or work-item creation. CI run #341 (`40079074071`) was in progress when this note was written and must be checked on its exact test commit; subsequent documentation commits require their own CI/Preview status checks.

## Policy resolution fail-closed hardening — 2026-10-24

Policy evaluation now rejects malformed applicable rows rather than silently ignoring them and falling back to a more permissive business-level `auto` policy. Missing/null activity flags and unknown scopes fail closed; explicit `is_active: false` rows remain excluded. Valid workflow-level policies scoped to a different workflow are not applied to the current workflow. Regression tests cover the dangerous permissive-fallback cases. CI run #351 (`40079234377`) passed on test commit `9f0ebd3935349d7d481911309ce1923698c59000`; later documentation-only commits need their own status check. No work-item writes or owner confirmation were enabled.

## CI signal/noise correction — 2026-10-24

The Assistant and bot workflows previously listened to both `push` on the PR head branch and `pull_request` against the PR base, producing two runs for the same commit. Both workflows now rely on `push` to their dedicated PR branches plus manual `workflow_dispatch`, and use branch concurrency to cancel stale runs. This keeps one test run per branch update without a second copy from the PR event. Assistant workflow run #364 (`40079464505`) passed on its workflow-change commit; bot workflow validation was still in progress at the latest check. This reduces duplicate CI activity and notifications but does not establish the cause of unrelated failed jobs/emails. PRs remain Draft.

## Data collection plan validation — 2026-10-24

The NEW work-creation policy evaluator now validates the completed data plan's shape at its trust boundary: `CREATION_POLICY_REQUIRED` requires an array `required_fields`, and any listed field must be explicitly `PROVIDED`. Missing arrays, malformed rows, and missing/uncertain statuses fail closed as `DATA_PLAN_NOT_READY`; no write path is enabled. Focused CI run #368 (`40079606945`) passed on test commit `0f6208e2c304fb8b3cf8962eab3147218819ef67`. Later documentation commits require fresh status checks.

## Audit consegna MultiVocale — 24 ottobre 2026

La revisione statica del bot ha rilevato un rischio specifico in `PersistentMultivocaleRuntime._process_batch()`: dopo un esito ambiguo dell'invio WhatsApp, il batch può essere marcato `failed` e l'azione `Riprova` può reinviare la risposta già memorizzata. Questo può duplicare una sintesi se Meta l'ha accettata ma la risposta HTTP si è persa. È un rischio di codice individuato staticamente, non un incidente riprodotto.

Tracking: [bot issue #4](https://github.com/VocalFlash/vocalflash-bot/issues/4). Implementato un primo guard conservativo sul ramo Draft: stato di consegna persistito prima dell'invio, blocco del recovery dopo il confine d'invio e nessun pulsante di retry in caso di esito ambiguo. CI bot run [40081928311](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40081928311) è passato sul commit `1a717d314ab07ea670c4e20a0bb0dd8b676c469b`; il documento di design registra esplicitamente le limitazioni. Restano da fare outbox durevole, message ID Meta, callback e riconciliazione, gestione operativa degli esiti sconosciuti e test di staging. Nessuna migrazione, configurazione a pagamento, merge o deploy eseguito. PR #2 e #3 restano Draft.


## Recheck operativo — 24 ottobre 2026

### Stato corrente verificato
- Assistant API PR #3 e bot WhatsApp PR #2: aperte, Draft, non integrate. La Preview Vercel sulla PR #3 non è una prova di E2E; per l'head corrente della PR #2 non è stato ottenuto uno status check verificabile.
- SMS Hook PR #9: aperta, Draft, non integrata. È stata aggiunta protezione idempotente alla richiesta Bird riutilizzando il `webhook-id` firmato come `Idempotency-Key`; il test unitario verifica la propagazione della chiave.
- Il codice e i test SMS sono stati aggiornati sul branch `auth-bird-sms-hook-v1`. I test Deno restano **non verificati**: il connector non restituisce run GitHub Actions per questo head; Vercel è un check distinto e non sostituisce il workflow Deno.
- Supabase live è `ACTIVE_HEALTHY`; 15 migrazioni nel registro live, nessuna development branch. Riconciliazione migrazioni ancora aperta.
- Advisor live: 15 tabelle con RLS senza policy, 18 FK senza indice di copertura e 26 indici inutilizzati segnalati. Non aggiungere policy permissive o rimuovere indici in automatico; verificare access paths/grants e workload prima di intervenire.
- Le RPC di commit non garantiscono ancora atomicamente conferma valida/non scaduta/one-time insieme alla scrittura. Mantenere `ATOMIC_CONFIRMATION_NOT_ENABLED`.

### Hardening SMS e limiti
- Bird documenta `Idempotency-Key` con retention di 3 ore: riusare il `webhook-id` dello stesso evento riduce doppie accettazioni se il hook viene riconsegnato. Non equivale a delivery exactly-once, conferma di consegna o outbox durevole.
- Nessun SMS reale, configurazione Auth/Bird, segreto, deploy, modifica schema live o risorsa a pagamento è stata creata.
- Gate invariato: ottenere un risultato Deno autorevole, correggere eventuali errori, poi eseguire review; non distribuire finché non siano approvati costi e target non-production.

### Priorità operative aggiornate
1. Verificare i test Deno sull'head attuale di PR #9.
2. Riconciliare le 15 migrazioni live con la sequenza SQL autorevole senza modificare il database.
3. Progettare e testare una scrittura atomica che vincoli conferma, scadenza, consumo one-time e commit; poi proseguire con persistenza conversazioni/outbox.


### Snapshot CI dopo aggiornamento documentale — 24 ottobre 2026
- Il commit documentale `9fe0064aef4711ba410fb22cf099eeb2a70351cc` aveva status Vercel `pending` al momento del controllo. È un controllo Preview e non dimostra il superamento dei test Deno né l'E2E.
- Sul head SMS `f95effedb8a5d000e70706d9b6fec87aafdce1ff` lo status Vercel risultava `success`, ma il connector delle workflow run continuava a restituire una lista vuota; test Deno non dichiarati superati.


## Verifica a cinque passaggi — aggiornamento 24 ottobre 2026

- API Assistant: run [#40114128653](https://github.com/VocalFlash/vocalflash/actions/runs/40114128653), commit `77fbddfa19d04a7a163e3af1ba6c9ed379abee97`: 5/5 passaggi riusciti, ciascuno 89/89 test, 0 fallimenti; Preview Vercel `success`.
- Bot WhatsApp: run [#40113909039](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40113909039), commit `7ad05b42122c939a5669c2fdceeae604185aec09`: 5/5 passaggi riusciti, ciascuno 35 test.
- SMS Hook/Bird: run [#40113926527](https://github.com/VocalFlash/vocalflash/actions/runs/40113926527), head `ca1d3f46cef0f8fa38a8c534eb70985500481dcc`: 5/5 passaggi riusciti, ciascuno 11/11 test; anche il run push [#40113921972](https://github.com/VocalFlash/vocalflash/actions/runs/40113921972) è riuscito 5/5.
- Matrice minima: 675 esecuzioni di test riuscite nei tre sottosistemi, senza fallimenti nei run finali verificati. Un run API parallelo precedente è rimasto in-progress, ma il run seriale successivo ha completato tutti e cinque i passaggi.
- Il workflow API ora serializza i cinque passaggi e impone un timeout di 10 minuti per job. Il workflow SMS testa anche body limitato a 20 KiB senza Content-Length e chiave idempotente Bird.

### Non sbloccato dai test unitari
Rimangono NO-GO: conferma titolare atomica, riconciliazione della fonte SQL delle 15 migrazioni, persistenza conversazioni multi-turno, outbox WhatsApp durevole/reconciliation, staging E2E, verifica delle configurazioni Meta/Render e revisione dei rilievi Supabase. Nessuna modifica live, deploy o SMS reale è stato effettuato. Le PR #2, #3 e #9 restano Draft.

## Verification refresh — 24 October 2026

- The latest Assistant API five-pass workflow on the documentation-final candidate `56ef6a85a96325f5a82ffc975de23104c871d9f4` is run [#40114332345](https://github.com/VocalFlash/vocalflash/actions/runs/40114332345): all five job logs explicitly report 89 tests, 89 passed, 0 failed. Earlier code-head run [#40114128653](https://github.com/VocalFlash/vocalflash/actions/runs/40114128653) also completed 5/5.
- Bot CI run [#40113909039](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40113909039): five successful jobs, 35 tests per pass (175 executions).
- SMS/Bird CI run [#40113926527](https://github.com/VocalFlash/vocalflash/actions/runs/40113926527): five successful jobs, 11/11 tests per pass (55 executions). Main matrix total: 675 successful test executions. A second API five-pass run and a second SMS five-pass run bring the total of cited successful executions to 1,175.
- These are repeated automated suites, **not** five full end-to-end staging runs. The live Supabase audit still finds 15 registered migrations without a reconciled authoritative source sequence, no deployed Edge Functions, 15 RLS-enabled tables without policies, 18 foreign keys without covering indexes, and 26 indexes flagged as unused. The owner confirmation/commit RPC path still lacks verified atomic binding of a valid, unexpired, one-time confirmation to the write.
- Persistent multi-turn conversation state, durable outbound outbox/reconciliation, correct Meta staging secret verification, authorized real test member, and integrated staging E2E remain release gates. Keep PR #3, PR #2, and PR #9 Draft. **NO-GO for production release remains unchanged.** No live schema/data mutation, merge, production deployment, real SMS, or paid resource was performed in this refresh.
- Canonical detailed evidence and ordered next steps are recorded in the [Libro sacro operativo](https://github.com/VocalFlash/vocalflash/blob/assistant-conversation-photo-v1/docs/libro-sacro-vocalflash-operational-baseline-v1.md).



## 360-degree verification refresh — 24 October 2026

This refresh is an evidence ledger, not a release approval. The recommendation register and the current Libro sacro section 8 govern all subsequent work.

### Confirmed during this refresh
- The live Supabase migration registry currently returns 15 versions, from 20261001181622 through 20261004213059. The source SQL provenance is still unresolved; do not apply/reconstruct migrations from names.
- The live public schema returns 15 tables. Supabase Security Advisor currently reports 15 RLS-enabled tables without policies; Performance Advisor reports 18 foreign keys without covering indexes. These are actionable findings, not proof that public access is currently granted. No permissive policy or index changes were applied.
- Supabase reports zero deployed Edge Functions for this project. This is relevant to any proposed Auth SMS Hook/Bird integration: PR #9 is draft code only; no hook deployment, Bird configuration, or real SMS has been performed.
- The inspected bot source still holds audio/session/batch state in process memory (sessions, auto_batches, queued_batches, last_audio); Redis is used for deduplication/locks but does not make those audio batches restart-durable. Keep the single-worker constraint until that architecture changes.
- PR #3 (Assistant API), PR #2 (bot), and PR #9 (SMS Hook/Bird) remain Draft release units. PR #3 and #2 must be reviewed and staged together due to the assistant_message contract. PR #9 is an independent optional integration and must not be merged/deployed without its own owner/cost and staging gates.
- Existing component CI reports are not a substitute for integrated Meta → bot → Assistant API → Supabase → WhatsApp runs. The five-run staging release matrix remains NOT RUN/BLOCKED until prerequisites pass.
- Owner-command confirmation stays disabled with ATOMIC_CONFIRMATION_NOT_ENABLED. Atomic binding, expiry, one-time consumption, and write must be verified in one transaction before any enablement.

### 360-degree review matrix (current disposition)
| Area | Current disposition | Evidence / next gate |
|---|---|---|
| Product vision and collaboration guardrails | Documented; recommendations consolidated in Libro sacro §8 | Keep status labels and change-control rules current |
| Legacy audio/transcription/MultiVocale | Historical end-to-end flow existed; current full regression not established | Verify exact current Render deployment and test audio/MultiVocale without disrupting production |
| Python bot/Render | Code inspected; state partly in memory | Durable state/outbox and staging readiness checks |
| Assistant API/Vercel | Draft code and focused CI exist; not a complete release | Re-run CI and Preview for exact current PR head; verify auth/readiness and API contract |
| Cross-repository contract | API/bot are coupled | Test together against same staging candidate |
| Supabase migration provenance | BLOCKED | Recover authoritative SQL source and reconcile all 15 migrations |
| Supabase RLS/policies | BLOCKED / requires policy design | Model roles and tenant access; add least-privilege policies only after review; test anon/authenticated/service_role paths |
| FK indexes/performance | REVIEW REQUIRED | Check actual query patterns and constraints before adding indexes |
| Owner confirmations | BLOCKED; fail-closed runtime retained | Atomic confirmation validation/consumption/write tests |
| Conversation persistence | NOT COMPLETE | Durable multi-turn state across restart, workers, and duplicate/out-of-order events |
| Outbound delivery | NOT COMPLETE for durable reconciliation | Durable outbox and ambiguous provider outcome reconciliation |
| Meta webhook/signature | Unit implementation exists; live configuration unverified | Staging app/number/secrets, signed/invalid payload tests |
| SMS Hook/Bird | Draft implementation only | Owner approval, current provider costs/sender availability, isolated deploy and OTP tests |
| Privacy/retention | Design/release gate remains open | Data inventory, retention/deletion, media lifecycle, logs and access review |
| Account/onboarding/billing | Not production-ready | Identity model, verification, plan lifecycle, cancellation and commercial hosting decision |
| Group WhatsApp | Research/design pending | Verify current Meta API eligibility and constraints before promising feature |
| Cost/latency/observability | Incomplete | Measure Meta, model, Render, Redis, storage and SMS costs with real workload assumptions |
| Integrated QA | NOT RUN / BLOCKED | Run five documented E2E passes only after all prerequisites; include adversarial cases and cleanup |
| Commercial readiness | NO-GO | Resolve all release blockers and review evidence before launch |

### Explicit exclusions in this refresh
No live schema/data changes, no RLS policy creation, no index changes, no migration application, no database branch, no secret changes, no Meta/Render/Vercel production changes, no real SMS, no paid service, no merge, and no production deployment.



## Focused technical inspection — 24 October 2026 (read-only)

### Terminology catalogue structural recheck
- Source: `docs/professional-terminology-catalog-v1-draft.json`, blob `5aa93e3391c10db5b303249f0d4ba54d3aa8d34f`.
- Parsed successfully as JSON. 699 entries; declared and observed sector counts agree: plumbing/maintenance 86, construction/site 105, real estate 102, financial intermediation 82, legal 102, medical 100, generic 122.
- No duplicate `sector + normalized_term` pairs detected in this read-only scan; all entries include the required structural keys checked by the scan.
- Only 120/699 entries currently have non-empty definition, disambiguation, and examples by the scan's basic completeness rule. All 699 entries have `review_status: draft`; catalogue remains NOT APPROVED and must not be treated as a curated, expert-reviewed runtime vocabulary. This is structural validation, not semantic/domain approval.

### Source-level confirmation review
- Current `lib/owner-command-runtime-v1.js` still returns `ATOMIC_CONFIRMATION_NOT_ENABLED` for explicit confirmation before persistence/context/interpretation. This is a safe fail-closed guard, not a completed confirmation workflow.
- Current bot `app.py` on `multivocale-runtime-v2` declares the Meta Graph version `v26.0`, caps files at 12 MiB each / 25 MiB total and max 5 files, but explicitly retains `sessions`, `auto_batches`, `queued_batches`, and `last_audio` in process memory. The source itself says one Gunicorn worker is required until audio batches are durable. Restart resilience for queued audio is therefore not proven.
- SMS Hook source on `auth-bird-sms-hook-v1` has a 20 KiB body limit, signature-based handler design, injected dependencies and 11 focused tests. This remains draft source; no Edge Function is deployed, and no Bird account/sender/configuration or live OTP delivery has been verified.
- Pull request review and inline review-thread APIs returned no submitted reviews/threads for API PR #3, bot PR #2, or SMS PR #9 at the time checked. This means no GitHub review record was returned by those endpoints; it does not mean the changes are approved.
- The latest inspected successful repeated suites remain bound to their recorded historical SHAs/runs. No fresh workflow run was found associated with the latest documentation-only commits; do not infer a new CI PASS for those commits. Re-run CI against exact code heads before release.

### Additional findings and action order
1. **P0 — recover authoritative migration SQL history** and reconcile live migration registry before any DDL or isolated schema reconstruction.
2. **P0 — keep owner writes disabled** until confirmation event, expiry, one-time consumption and write are transactionally bound and tested in isolation.
3. **P0 — implement durable conversation/audio state and outbound outbox/reconciliation** before claiming restart resilience or reliable delivery.
4. **P0 — design/test tenant-specific RLS policies and service-role boundaries** from explicit role/tenant threat model; do not apply permissive policies just to clear advisor warnings.
5. **P1 — establish reproducible staging** with dedicated Meta test app/number, safe credentials and a paired API+bot candidate; then run the release matrix and five integrated E2E passes plus adversarial tests.
6. **P1 — complete vocabulary quality**: review remaining 579 entries for definitions/disambiguation/examples and obtain domain approval by sector; keep all entries draft until accepted.
7. **P1 — resolve commercial readiness**: hosting plan constraints, Meta eligibility, billing lifecycle, privacy/retention, support/monitoring and measured per-customer cost.

This inspection was read-only. No application code, live data/schema, provider configuration, secret, deployment, PR state or paid resource was changed.


### Read-only database privilege cross-check — 24 October 2026
- Direct read-only catalog queries confirmed all 15 public base tables have RLS enabled and zero policies. A separate `information_schema.role_table_grants` aggregate returned 93 grant rows covering the 15 tables for `service_role` only; it returned no table-grant rows for `anon` or `authenticated`.
- Direct function-privilege checks for `vf_resolve_owner_member_by_sender_v1`, `vf_record_owner_command_confirmation_v1`, `vf_commit_owner_note_v1`, `vf_commit_owner_schedule_action_v1`, and `vf_ingest_customer_whatsapp_event_v1` returned `EXECUTE=false` for `anon` and `authenticated`, `EXECUTE=true` for `service_role` and `postgres`.
- This narrows the current observed exposure: the absence of RLS policies is a major future client-access/design blocker, but these specific checks did not show direct table grants to anon/authenticated or execute grants on the five RPCs to those roles. It does not replace a full privilege audit (views, sequences, default privileges, other functions, schema grants, PostgREST exposure, service-key handling, and application authorization still require review).
- No SQL writes were performed. All queries were SELECT-only catalog inspections.

- Full catalog sweep of all functions in schema `public` returned no functions executable by `anon` or `authenticated`. Schema privilege checks show `USAGE=true`, `CREATE=false` for both roles and `service_role`. An attempted lookup through `information_schema.schema_privileges` failed because that relation is not present in this Postgres catalog; the equivalent `has_schema_privilege` check succeeded. The sweep is limited to the public schema and does not cover extension schemas or external application behavior.


### Open pull request inventory refresh — 24 October 2026
A fresh open-PR search found three open PRs in `VocalFlash/vocalflash` and one in `VocalFlash/vocalflash-bot`:
- `VocalFlash/vocalflash` PR #1, “Harden fresh Vercel deployments for ES modules”: open; proposes only `package.json` module-mode fix and records isolated Preview route checks. It also records a separate Preview questionnaire environment secret returning HTTP 401. Treat that as an unresolved diagnostic for that environment; do not assume it is the Assistant API credential or change secrets without tracing the exact deployment/project.
- `VocalFlash/vocalflash` PR #3: Assistant API/customer workflow, open Draft; must ship paired with bot PR #2.
- `VocalFlash/vocalflash` PR #9: SMS Hook/Bird, open Draft; optional independent integration, not deployed.
- `VocalFlash/vocalflash-bot` PR #2: WhatsApp bot, open Draft; coupled to PR #3.

The PR search result does not provide a complete merge-readiness verdict, and the review APIs returned no submitted review records for these PRs. Before any release, recheck each PR's exact head/base SHA, checks, conflicts, and whether PR #1 is already subsumed by PR #3's branch. Do not merge PR #1 separately merely to resolve the module-mode concern without checking dependency order.


### Staging configuration and SECURITY DEFINER refresh — 24 October 2026
- Current SELECT-only row counts differ from the 22 October pre-launch snapshot: one staging-labelled plumbing/maintenance business, one active WhatsApp channel (external account identifier present but not disclosed; channel address absent), zero business members, two workflows (one inactive generic test workflow and one active maintenance request workflow with one required field), one active workflow-level `create_work_item` policy in `confirm` mode, 14 active business vocabulary rows, one work item, four work events, and two routing decisions.
- The empty business-member table is the decisive onboarding/auth blocker: there is no verified owner/member binding. Do not create a placeholder member. The configured policy's `confirm` mode does not supersede the runtime's atomic confirmation guard.
- Full public-schema SECURITY DEFINER function inspection found nine functions; all have explicit function `search_path` settings. None is executable by `anon` or `authenticated`; application RPCs are executable by `service_role` and `postgres`. `rls_auto_enable` is not executable by those application roles in the privilege check, consistent with its use as a trigger helper.
- No personal row values, WhatsApp IDs, phone numbers, or customer message text were selected. All queries were read-only.


## 2026-10-24 — Product-value acceptance table is the primary prioritization rule

Use the table in the [operational baseline](libro-sacro-vocalflash-operational-baseline-v1.md#2026-10-24--riesame-coordinato-e-criterio-primario-di-valore) as the primary product prioritization and acceptance criterion. Technical work, sector coverage and vocabulary size are subordinate to measurable user value. Every proposed feature must identify the user problem, the table row it improves, the acceptance evidence, risk/dependencies and cost. If no observable benefit can be defined, keep the work exploratory rather than promoting it to a roadmap priority.

Latest CI verified on exact commits:
- API/catalogue commit `ab448b7306cd33a5f925b2ec71533477199ee53c`: run 40118965684, 5/5 jobs successful.
- Operational baseline/API commit `d9768031ac6e4990bd08b0630c867786cdec6b2d`: run 40119000634, 5/5 jobs successful.
- Bot PR #2 head `7ad05b42122c939a5669c2fdceeae604185aec09`: run 40113909039, 5/5 jobs successful.

These CI runs are not integrated E2E evidence. Static review found the customer-assistant bot wrapper currently forwards ordinary text to the Assistant API, while audio remains on MultiVocale/legacy paths. A missing/empty `assistant_message` is silently skipped by the bot wrapper. Treat both as explicit pre-pilot gaps. Do not enable owner writes or relax the SQL provenance, identity, RLS, atomic confirmation, durable outbox, and reconciliation gates.
