# VocalFlash — master roadmap and architecture guardrails v1

**Updated:** 2026-10-24  
**Status:** planning/engineering record on the isolated development branch. This document does not authorize database changes, merges, purchases, or deployments.


## Registro di verifica — 25 ottobre 2026

- Revisione statica del ramo `assistant-conversation-photo-v1`: rimosso un controllo duplicato identico di appartenenza scope in `api/v1/multivocale-storage.js`; il controllo effettivo resta presente prima della generazione del signed URL.
- Commit della sola pulizia: `ab627a35072c38bc15f3fe419080fd012f7ce96f`.
- La verifica GitHub Actions tramite endpoint disponibile non ha restituito run associati al commit; pertanto questa pulizia è **non ancora confermata da CI** in questo registro. Non dichiarare il commit testato finché non è visibile un esito sul commit/branch corrente.
- Nessun deploy, merge, modifica di configurazioni/secret o operazione storage live eseguita.



- Revisione statica storage: l'azione `health` prima restituiva `storage:true` dopo la sola creazione di una signed-upload URL, senza eseguire upload/download reali. La risposta è stata resa più precisa (`storage_control:true`, `signed_upload_url_creation:true`) nel commit `6b9cb7c8c38f51c4b22baf00f8ccaace05509ccb`. CI GitHub Actions run `40234797459` (`Assistant Customer Pipeline Tests`) ha completato con successo tutti e 5 i job della matrice, inclusi i test mirati. Questo prova la suite automatizzata sul commit, non un round-trip Supabase reale: il gate storage E2E resta aperto.

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
- The legacy app.py handler still declares in-memory sessions/auto_batches/queued_batches/last_audio. However, app_customer.py routes MultiVocale audio/commands to PersistentMultivocaleRuntime, which stores batch metadata in Redis and audio bytes in private object storage via signed URLs. The V2 restart-recovery and real storage round-trip tests remain NOT RUN; do not infer runtime proof from static code. Keep the single-worker constraint only for any reachable legacy in-memory path.
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
- Current app.py on multivocale-runtime-v2 declares Meta Graph v26.0, caps files at 12 MiB each / 25 MiB total and max 5 files, and retains legacy in-memory structures. The active app_customer.py V2 path stores batch state in Redis and audio in private object storage; restart resilience remains NOT PROVEN until a controlled staging restart/recovery test passes.
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


Follow-up verified 2026-10-24:
- Bot commit `5c0cf3b830389471f5ff1a9770b5593d95e6721b` now fails visibly with `ASSISTANT_REPLY_MISSING` if a successful Assistant API response lacks a usable customer reply; a focused unit test was added. CI run 40120662180 passed 5/5 jobs.
- Documentation/table commit `ee094608ee6f45adb06f9eebfbb5b7f06168e693` passed API/catalogue CI run 40120606969, 5/5 jobs.
- This closes only the silent-empty-reply handling gap at unit-test level. Ordinary text is still the only input currently routed to the customer Assistant workflow; audio remains on MultiVocale/legacy. Integrated staging E2E remains a release gate.


Verification update 2026-10-24:
- Documentation commit `bb800588d079f4920c19b96cc87e8ffe9e64d0dd` passed run 40120754178, 5/5 jobs.
- Bot test commit `28f381aec6635197b67d010bc7308902c7fa2b7a` passed run 40121561641, 5/5 jobs. The missing-reply test now explicitly verifies inbound dedup release in Redis and local state.
- No authoritative source for the 15 live SQL migrations was found in accessible repositories; keep all database-write and owner-action gates closed.
- Audio-to-operational-assistant integration remains a design/test task, not implemented. Preserve the MultiVocale single-summary behavior and do not reroute audio until its acceptance matrix covers batching, duplicate webhooks, ambiguous sends, transcription failures, missing data, and reply idempotency.


## Aggiornamento 25 ottobre 2026 — Redis isolation gate

- Implementato sul branch Draft bot, non rilasciato: namespace Redis opaco derivato dal servizio Render e dal WA_PHONE_ID; applicato a chiavi MultiVocale, deduplica webhook, lock mittente e marker risposta.
- Test sul nuovo head: NOT VERIFIED. Il controllo GitHub non ha restituito un run CI/status associato al commit candidato 197f610d271b92374566080e4f748bdae7fde06c.
- Deploy: staging ancora su multivocale-runtime-v2; produzione ancora su main. Nessuna modifica live.
- Gate immediati: (1) eseguire la suite Python sull'head esatto; (2) validare test di isolamento stesso mittente tra servizi/account; (3) definire drain/migrazione dei vecchi batch e della cleanup queue prima di qualsiasi deploy del nuovo namespace; (4) test restart/recovery.
- Rischio separato: Redis è condiviso tra staging e produzione e la persistenza su disco è disattivata. Il namespace affronta collisioni di chiavi ma non la perdita completa dello stato Redis. Nessun GO-LIVE finché entrambi i rischi non hanno un trattamento verificato.


## Gate aggiuntivi — MultiVocale namespace e lease (25 ottobre 2026)

### Confermato staticamente
- Il sottotipo timing effettivamente importato usa la chiave `due` namespaced; la correzione è presente nel commit `9997affa1b4d1afe4f0eaa17a1345af071020284`, con test aggiornati nel commit `3e80f7034205ad6271b411e9394ebabea258f740`.
- Il workflow Python include il branch `assistant-conversation-photo-v1` nel trigger push e offre `workflow_dispatch`.

### Non verificato
- Nessun status check né workflow run è stato restituito per il commit candidato `3e80f7034205ad6271b411e9394ebabea258f740`. Il clone locale non è riuscito perché l'ambiente non risolve `github.com`. Non attribuire un esito verde al nuovo head.
- La lease di 120 secondi viene rinnovata periodicamente; il ramo di errore interrompe il rinnovo ma il processing continua fino al successivo controllo. Serve un test di fencing dopo perdita del rinnovo prima di promuovere il branch.
- La presenza delle strutture legacy in memoria va valutata seguendo il routing effettivo, senza presumere che siano attive o inattive in base alla sola dichiarazione.

### Gate invariati
1. Suite Python verde sul commit esatto e risultati verificati.
2. Test di isolamento account/servizio, lease persa, concorrenza e restart/recovery.
3. Inventario e procedura di drain/migrazione del vecchio namespace prima di staging.
4. Trattamento separato della perdita totale Redis: persistenza su disco disattivata.
5. Nessun merge/deploy o modifica live senza i gate e l'autorizzazione separata.


## Evidenza CI aggiornata — run MultiVocale 40208605377 (25 ottobre 2026)

- Il workflow è stato aggiornato per attivare la suite anche sulle pull request verso `multivocale-runtime-v2`.
- Run [GitHub Actions #40208605377](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40208605377) sul branch candidato: completato con successo; log verificato, **46 test eseguiti, OK**.
- La suite è una verifica deterministica/unitaria; non certifica Redis reale, concorrenza distribuita, restart/recovery E2E, Meta/WhatsApp live o durabilità Redis.
- Gate rimanenti tracciati nell'[issue #5](https://github.com/VocalFlash/vocalflash-bot/issues/5). Nessun merge o deploy autorizzato da questo risultato.


## CI finale — 47 test e controllo dei trigger duplicati (25 ottobre 2026)

- Il test aggiunto sul confine pre-consegna verifica che un fallimento della lease impedisca l'invio della sintesi e del prompt MultiVocale.
- Run [#40208741560](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40208741560): 47 test, OK.
- Per rispettare la regola canonica anti-duplicazione CI, il workflow usa push sul branch base `multivocale-runtime-v2`, pull request verso il branch base e dispatch manuale. Il branch candidato non ha più anche un trigger push concorrente con il trigger PR.
- Run finale dopo la modifica: [#40208821196](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40208821196), **47 test, OK**.
- Non ancora dimostrati: rinnovo lease che fallisce durante elaborazione lunga con secondo worker concorrente, Redis reale, restart/recovery end-to-end, migrazione del vecchio namespace e Meta/WhatsApp live.
- Tracciamento: [issue #5](https://github.com/VocalFlash/vocalflash-bot/issues/5). Nessun rilascio autorizzato.


## Preview Vercel — stato read-only del branch candidato (25 ottobre 2026)

- Deployment Preview `dpl_8yxnr8L7cXmpi22EzPF57LhkMGDq` sul commit documentale `082f1e7ac99cea0bbca80b8aa1beb1aa92ff7167` verificato `READY`; il log contiene `Build Completed` e `Deployment completed`.
- Questa è una verifica di build Preview, non test semantico o end-to-end. Il contratto tra PR bot #2 e PR API #3 resta da validare congiuntamente; entrambe le PR restano Draft.
- Nessun merge/deploy di produzione. Gate tracciati nell'[issue #5](https://github.com/VocalFlash/vocalflash-bot/issues/5).


## Release-gate update — lease renewal failure under long processing (2026-10-25)
- Added a fail-closed guard in the MultiVocale runtime: when processing fails after the worker has lost its fencing token, the stale worker checks persisted state and suppresses customer-facing failure/retry messages if another worker owns or has completed the batch.
- Added a deterministic concurrency regression test: long-running first worker, renewal-thread failure, lease expiry, second-worker recovery and successful delivery, then late return of the stale worker. Acceptance checks cover no stale summary, no stale retry message, exactly one successful follow-up, and final batch state remains completed.
- CI run [#40209993482](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40209993482), commit `d31878080a94975a605b39b74c90790bf2fc9180`: **48 tests, OK**, including the new regression.
- The test uses FakeRedis and deterministic orchestration. Real Redis concurrency and end-to-end restart/recovery remain open. No merge, Render deployment, production change or real WhatsApp send.


## Real Redis and client-restart recovery evidence — 2026-10-25
- Candidate CI starts an ephemeral redis:7-alpine service and runs integration tests against real Redis using unique prefixes; tests do not flush the database.
- Run #40210411337 (https://github.com/VocalFlash/vocalflash-bot/actions/runs/40210411337), bot commit 15fb25eb73c45b8d08a766f9bde8696a10eb974c: 59 tests, OK; the workflow job and log were inspected.
- Real Redis test verified exactly one winner for two simultaneous lease claims, then confirmed the old fencing token cannot write the answer or finalize after recovery.
- A second test closes and recreates the Redis client/store, reads the persisted processing state and ready answer, then recovers an expired lease. This verifies client/store recreation against the same Redis service; it is not a Redis server restart or Render process E2E.
- CI hygiene: the duplicate five-pass customer diagnostics workflow is manual-only; the primary PR suite includes webhook signature and lease-heartbeat tests, with the fake store fixture aligned to current lease-token semantics.
- Remaining: full restart/recovery with actual audio storage, Redis durability/eviction configuration, old-namespace inventory/drain, and Meta/WhatsApp E2E. No merge/deploy/live change or real WhatsApp send.


## Release gate update — audio object reference survives Redis client recovery (2026-10-25)

- Verified candidate bot commit `74806b1bac489279b247bebb1600f99194f5a6cf`: [GitHub Actions run #40215225458](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40215225458) succeeded; the job log reports **59 tests, OK**.
- Real-Redis CI covers concurrent lease claims, stale fencing after recovery, and client/store recreation. The recovery test additionally asserts one persisted file reference with `status=ready` and `object_key=test-object/audio.ogg`, then recovers the expired lease and finalizes using the new token.
- Evidence boundary: the storage key is a fixture, and Redis is an ephemeral CI service. This does not prove the object exists in the configured storage provider or that a signed download works after an actual process restart. No Redis server or Render service was restarted.
- Next dependencies remain: real storage + process-restart E2E; read-only inventory and tested drain/migration of the old namespace; durability plan for shared Redis without disk persistence; staging Meta signature/Assistant API checks; joint bot/API contract review.
- Release remains NO-GO. No merge/deploy/live mutation or real WhatsApp send.


## Audio/storage architecture review — 2026-10-25

- Static inspection confirms candidate audio/interactive routing through the V2 MultiVocale runtime, private temporary object storage via signed upload/download URLs, and Redis persistence of batch metadata/object keys. The storage client test suite uses mocks; real provider behavior remains unverified.
- Legacy in-memory dictionaries are still declared in `app.py`; the candidate handler routes audio messages and MultiVocale commands to V2. Static inspection alone is not sufficient to certify every legacy path unreachable.
- Security review item added: storage endpoint validates object-key shape but does not take a distinct service/account identity or explicitly bind object ownership to that identity. Internal Assistant-key authentication is present, but must not be treated as an object-level ownership policy. Resolve before GO-LIVE.
- Redis legacy-keyspace inventory is blocked: available Render connector actions expose resource metadata/logs, not a safe read-only Redis key enumeration. No live keyspace was read, no namespace emptiness assumed, and no `FLUSHDB` used.
- No runtime code changes or live operations in this review. Real storage + process restart, ownership isolation, legacy-path regression, old namespace drain/migration, and Redis durability remain release gates.


## Stato aggiornato CI/API/Preview — 25 ottobre 2026

- Bot head documentale `d8f8c6c9c1a3de53af44e182c88580a740745832`: run [#40215503185](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40215503185) success, **59 test OK**.
- API head documentale `99ad18b738c1cd50225176138319d601ff89aa78`: run [#40215818314](https://github.com/VocalFlash/vocalflash/actions/runs/40215818314) success; 5/5 job riusciti; log letto: **98 test, 0 fallimenti**.
- Preview Vercel sullo SHA API `99ad18b...` = `READY` (`dpl_Bc9B9HaHhTqTaobQWAFN2xYpcjpL`); non equivale a E2E integrato.
- I test del bot includono isolamento delle chiavi V2 per namespace e casi di perdita lease/delivery ambiguo. Le chiavi V2 incorporano un digest derivato da service ID e WhatsApp phone ID. La review statica non certifica il keyspace legacy né il provider storage reale.
- Release NO-GO fino a storage/restart E2E, ownership oggetti, audit legacy, inventario e drain del namespace precedente, durabilità Redis e staging Meta/Assistant.


## System audit checkpoint — 2026-10-25 (read-only)

### Verified
- Render staging live commit: `34c63efb6e0e720e8dc07c10c3c457a5d59ae5b5` (4 Oct); production live commit: `788eecf280e0bb6eb22424669b89ed7ad0abc432` (3 Oct). Staging auto-deploy off; production auto-deploy on.
- Both services use the same Render Key Value `vocalflash-redis`, Free/Oregon, persistence off.
- Render error/warning and request log queries for 24 Oct 00:00–25 Oct 16:00 UTC returned no rows; staging HTTP metrics were empty and production HTTP metrics were not returned. These observations do not certify service health or absence of errors.
- Supabase active project is healthy; 15 live migrations are listed through `customer_whatsapp_replay_conflict_v1`. Auth users=0, business_members=0; counts: 1 business, 2 workflows, 1 policy, 14 vocabulary entries, 1 business channel.
- Supabase advisors report 15 public tables with RLS enabled but no policies; 18 foreign keys without covering indexes; 26 indexes marked unused. Findings need context-specific review; no DB changes made.
- PR #2 bot and PR #3 API remain Draft/open/unmerged. Their latest referenced CI jobs succeeded; API Preview for head `34664de90acf860cb11b8b0a04bc54b5e90adb28` is READY, which is build evidence only.
- Vercel runtime-error query returned 403; runtime-error check is not verified.

### Release blockers unchanged / clarified
- No safe Render tool for enumerating Redis keys: old namespace, pending batches and cleanup references are unknown. No FLUSHDB.
- Real storage upload/download and signed URL after actual Render process restart not tested.
- Object ownership binding, legacy path reachability, Redis durability/recovery, Meta App Secret/signature in staging, bot/API contract E2E and migration-source reconciliation remain open.
- RLS policy/privilege model must be reviewed before exposing user-facing DB access; do not add permissive policies without ownership tests.
- **NO-GO:** no merge, deploy, live configuration/data change, or real WhatsApp E2E authorized/performed.


## Addendum — verifica estesa piattaforme e cronologia disponibile (2026-10-25, UTC)

### Stato della verifica
- Sono stati riletti i due libri canonici e la roadmap, consultati i registri/riassunti delle conversazioni VocalFlash disponibili in ChatGPT Library e recuperato lo stato live delle piattaforme con accessi read-only. Questo consolida le evidenze recuperabili; non va descritto come lettura manuale esaustiva di ogni singola chat dell'account, perché l'interfaccia non espone un inventario completo delle conversazioni.
- Nessun merge, deploy, restart, modifica di variabili/secret, scrittura o DDL su database live, invio WhatsApp reale o acquisto è stato eseguito.

### GitHub / Vercel
- Commit documentale API corrente: `730bfdd642307b5b3c06c54ce26eec64aea3ed55`; deployment Vercel `dpl_4XGZiWPAMnXjEurq8e2mENDbHwaP` ora risulta **READY**. È una Preview (target non production), non prova E2E né stato di produzione.
- Il progetto Vercel `vocalflash` ha Node.js `24.x`; SSO protection è abilitata per tutti gli ambienti eccetto i domini custom; password protection è disabilitata. Domini custom `api.vocalflash.it`, `vocalflash.it` e `www.vocalflash.it` risultano verificati; apex reindirizza a www con 308. Questa verifica non prova che ogni endpoint applicativo sia sano.
- Inventario env Vercel read-only (valori non letti): `VF_ASSISTANT_SUPABASE_URL`, `VF_ASSISTANT_SUPABASE_SECRET_KEY`, `VF_MULTIVOCALE_STORAGE_BUCKET` e `VOCALFLASH_ASSISTANT_API_KEYS` risultano solo per Preview con branch `assistant-auth-v1) (la secret Supabase ha anche un target development). Non risultano assegnati al branch Preview `assistant-conversation-photo-v1` nell'inventario consultato. Le variabili legacy `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `VOCALFLASH_API_KEYS`, `OPENAI_API_KEY` hanno target più ampi. **Da fare:** confrontare i nomi richiesti dal codice del branch candidato con target/branch reali e correggere il binding solo dopo aver validato la necessità; non copiare né mostrare valori segreti. La presenza di una variabile non prova che il valore sia valido.
- GitHub PR bot #2 e API #3 restano Draft/non unite secondo l'ultimo stato verificato. I risultati CI positivi su commit precedenti non si trasferiscono automaticamente ai successivi commit documentali; verificare il commit esatto prima di ogni gate.

### Render
- Servizio staging `vocalflash-bot-staging`: branch `multivocale-runtime-v2`, avvio `gunicorn app_customer:app`, auto-deploy OFF, piano Free, 1 istanza, Oregon, pubblico `0.0.0.0/0), nessun health check configurato.
- Produzione `vocalflash-bot`: branch `main`, avvio `gunicorn app:app`, auto-deploy ON ad ogni commit, piano Free, 1 istanza, Oregon, pubblico `0.0.0.0/0), nessun health check configurato.
- Ultimi deploy live rimangono staging commit `34c63efb6e0e720e8dc07c10c3c457a5d59ae5b5` del 4 ottobre e produzione commit `788eecf280e0bb6eb22424669b89ed7ad0abc432` del 3 ottobre.
- Entrambi i servizi condividono `vocalflash-redis`: Free, Oregon, Redis 8.1.10, `maxmemoryPolicy=noeviction), `persistenceMode=off). Rischio P0: separare staging/produzione e definire durabilità/recupero prima del pilota. Non eseguire flush né migrazione distruttiva.
- Gli strumenti Render usati non espongono in modo affidabile l'inventario dei valori/nomi di tutte le env var né un keyspace Redis enumerabile in sicurezza. Questi punti restano **non verificati**, non “a posto”. Eventi recenti interrogati non restituiscono righe; questo non dimostra assenza di incidenti.
- **Da fare:** aggiungere health check appropriato e testare dipendenze, dopo aver identificato endpoint sicuro e semantica; non modificare il servizio live in questa fase.

### Supabase
- Progetto attivo `VocalFlash Assistant`, ID `tkfyfqgtumoeywlqzmdt`, stato `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.171, regione eu-west-1.
- Esiste anche `VocalFlash's Project`, ID `miavlccjtknaemnmjoqb`, stato INACTIVE: va chiarito se resta il backend del questionario storico o se è dismesso; non cancellare né riattivare senza verificare dipendenze e dati.
- Il progetto Assistant mostra 15 migrazioni live fino a `20261004213059 customer_whatsapp_replay_conflict_v1); la fonte SQL versionata completa resta non riconciliata. Nessuna development branch e nessuna Edge Function nel progetto Assistant al controllo corrente.
- Advisor security: 15 tabelle public con RLS abilitata e nessuna policy (livello INFO). È necessario confermare grants, percorsi server-side e modello di accesso; non creare policy permissive automaticamente.
- Advisor performance: 18 foreign key senza indice di copertura; analizzare query e workload prima di aggiungere indici. Gli indici inutilizzati restano solo segnalazioni, non candidati a cancellazione automatica.
- Non creare la development branch: costo già stimato in precedenza, ma non approvato. Non applicare migrazioni live per colmare il drift.

### P0 confermati e ordine di intervento
1. Riconciliare la provenienza delle 15 migrazioni e rendere riproducibile lo schema in un ambiente isolato autorizzato.
2. Separare Redis di staging e produzione; inventario e drain del namespace legacy con procedura non distruttiva; definire durabilità e recovery.
3. Verificare binding delle env Vercel al branch Preview corretto senza esporre segreti; inventariare in modo sicuro le env Render, dato che il connettore non le ha rese verificabili.
4. Eseguire test storage audio reale + signed URL dopo restart effettivo, ownership degli oggetti e audit dei percorsi legacy in RAM.
5. Verificare META_APP_SECRET e firma webhook nel vero staging, quindi test congiunto bot/API, delivery ambiguity/outbox e callback.
6. Correggere/validare health check e accessibilità dei servizi; valutare piano Vercel commerciale/DPA, privacy, retention e subprocessori prima del lancio.
7. Rivedere il progetto Supabase inattivo del questionario e la coerenza dei target di ambiente; nessuna cancellazione senza prova di non dipendenza.

### Stato release
**NO-GO** invariato. La Preview corrente READY chiude solo il build per quel commit. Nessuna delle verifiche read-only autorizza merge, deploy, modifiche live o messaggi reali.


## Addendum — esito audit cleanup Redis e gate chiavi storage (2026-10-25)

- **Fix verificato nel ramo candidato bot:** rimosso l'uso residuo della costante statica `CLEANUP_KEY` dai percorsi operativi di cleanup; tutte le operazioni usano ora `_cleanup_key(config)`. Aggiunti test per isolamento delle cleanup queue tra namespace e fail-closed se su Render manca il helper di namespace.
- **CI bot:** run #40222372611, head `cb1d7a7483f41e51f5cbf82c73ccee486b373e8e`, esito success, **60 test passati**. Include test Redis reale in CI per concorrenza/fencing e ricostruzione client/store; non simula il riavvio del server Redis/Render e non verifica il provider storage reale.
- **Redis namespace:** viene derivato dal codice da `RENDER_SERVICE_ID` + `WA_PHONE_ID`; non richiede un cambio manuale del Redis URL. La migrazione dal namespace legacy non è automatica: inventario e drain/rollback prima di qualunque merge/deploy.
- **Nuovo gate storage P0:** la API storage usa una credenziale Assistant condivisa e valida il formato di `object_key`, ma non lega ancora in modo server-side ogni oggetto al bot/ambiente autenticato. Progettare scope per credenziale (per ambiente/account) prima dell'E2E; eventuali nuove variabili/segreti vanno introdotti coordinando Vercel e Render, senza valori nei documenti.
- **Stato:** PR bot #2 e PR API #3 restano Draft/non unite. Nessun merge, deploy, modifica live, migrazione DB o invio WhatsApp reale. **NO-GO** invariato.


## Addendum — audit sicurezza storage API, binding Preview e percorsi legacy (2026-10-25)

### Evidenze verificate in sola lettura
- La funzione `api/v1/multivocale-storage.js` autentica con `VOCALFLASH_ASSISTANT_API_KEYS` come lista di chiavi condivise; non ricava da tale autenticazione uno scope server-side distinto per ambiente/servizio/account.
- La validazione di `object_key` controlla il formato `tmp/<UUID>/<sha256>.<estensione>`, ma non prova che l'oggetto appartenga al chiamante autenticato. Le azioni `prepare_download` e `delete` non effettuano una verifica di ownership persistente prima di firmare il download o rimuovere l'oggetto. È un gap di isolamento da chiudere prima del pilota.
- L'inventario Vercel con valori non decifrati restituisce **zero variabili** associate al branch Preview `assistant-conversation-photo-v1`. Le variabili Assistant/storage risultano invece legate a Preview `assistant-auth-v1`. Non sono stati letti né copiati valori segreti. Quindi la Preview verde non dimostra che il branch corrente abbia le variabili necessarie a runtime.
- Nel bot, app_customer.py mantiene app.py per compatibilità, ma il runtime MultiVocale V2 usa Redis per stato batch e storage privato per i byte audio. Le strutture in memoria appartengono al percorso legacy; la CI copre alcuni casi di fallback bloccato, ma un test di restart/recovery reale deve ancora confermare l'assenza di percorsi legacy raggiungibili e la ripresa corretta.
- L'API storage offre un'azione `health` che crea un URL di upload firmato per una chiave casuale; non è stata eseguita una prova reale di upload/download né un test dopo un riavvio effettivo del processo Render.

### Decisione tecnica / gate
- Non ruotare o sostituire ancora alcuna chiave live e non copiare una chiave tra ambienti. Prima definire un contratto autenticato che leghi credenziale a scope (almeno ambiente/servizio), includa lo scope nella chiave oggetto e verifichi ownership per upload/download/delete; aggiungere test positivi e negativi per accesso incrociato.
- Coordinare in seguito il nome/target delle variabili Vercel Preview e Render; verificare soltanto la presenza/target senza leggere i valori. Il cambio sarà richiesto solo dopo aver definito il contratto e preparato un piano di transizione/rollback.
- Auditare e testare i rami di fallback legacy per testo, vocali, comandi MultiVocale, errori storage e riavvio. Non dichiarare chiusa la persistenza finché non è stata provata su un servizio staging isolato.
- Nessun segreto o variabile è stato modificato; nessun deploy, restart, scrittura DB, invio WhatsApp reale o merge è stato eseguito. Release **NO-GO** invariato.


## Addendum — storage scope enforcement implementation (2026-10-25, CI pending)

### Implementato nel branch candidato
- `api/v1/multivocale-storage.js` ora richiede una mappatura server-side `VOCALFLASH_ASSISTANT_API_KEY_SCOPES` in JSON. La chiave della mappatura è il digest Git blob SHA-1 della chiave API effettiva; il valore è uno scope stabile, ad esempio `staging-bot` o `production-bot`. I valori delle API key non vanno inseriti nella mappatura né nella documentazione.
- La mappatura mancante/malformata per una chiave autenticata fallisce chiuso con HTTP 503; credenziali non valide continuano a ricevere HTTP 401.
- Il percorso degli oggetti è stato versionato implicitamente come `tmp/<scope-uuid>/<batch-uuid>/<sha256>.<ext>`. Download e cancellazione rifiutano oggetti appartenenti a un altro scope (HTTP 403) e rifiutano il vecchio formato non scoped (HTTP 400). L'upload firmato usa lo stesso scope server-side.
- Aggiunto `api/v1/multivocale-storage.test.js` con casi per mapping assente, download/cancellazione cross-scope e rifiuto del formato legacy; la suite CI è stata aggiornata per eseguire questi test.

### Stato delle prove e impatto di compatibilità
- I cambiamenti sono stati registrati nel branch `assistant-conversation-photo-v1`; non sono state modificate variabili Vercel/Render e non sono stati letti valori segreti.
- **CI per i nuovi test: in attesa di run verificabile; non dichiarare i test superati finché il run non è visibile e verde.**
- Il nuovo formato non è retrocompatibile con object key già presenti nel formato `tmp/<batch-uuid>/<sha256>.<ext>`. Prima del deploy bisogna drenare le raccolte attive e pianificare una migrazione/bonifica controllata del vecchio stato e degli oggetti; non aggiungere un bypass legacy cross-scope e non cancellare oggetti senza inventario. Nessuna migrazione è stata eseguita.
- Configurare la nuova variabile scope solo dopo aver preparato mapping distinti per staging e produzione e un piano di rollback. Le variabili richieste non risultano associate al branch Preview corrente; nessun cambio env è autorizzato/eseguito.
- Nessun deploy, merge, modifica live, restart Render, invio WhatsApp reale o scrittura DB è stato effettuato. Release **NO-GO** invariato.


### Addendum di verifica — scope duplicati e trigger CI (2026-10-25)
- Rafforzato il fail-closed: se due credenziali hanno lo stesso scope, l'endpoint rifiuta la mappatura. Aggiunto test per questo caso.
- Il workflow dei test ora include il file di regressione storage e un trigger `pull_request` oltre al push sul branch candidato.
- Verifica CI completata: run GitHub Actions `40223697873` (`Assistant Customer Pipeline Tests`) **success**, cinque passaggi della matrice riusciti. In ciascun passaggio sono risultati **103 test passati, 0 fallimenti**; i test storage nuovi sono inclusi (mapping mancante, scope duplicati, download cross-scope, delete cross-scope, rifiuto delle chiavi legacy). Totale: 515 esecuzioni di test riuscite sulla matrice. Run verificato sul commit `1be9c9f8230c51406f5e6835e27da1479b435c26`; i commit successivi interessano soltanto i documenti canonici, quindi il codice testato è invariato.
- Il contratto richiede credenziali distinte per staging e produzione e scope distinti; il mapping usa Git blob SHA-1 della chiave come chiave JSON. La nuova variabile `VOCALFLASH_ASSISTANT_API_KEY_SCOPES` va configurata solo quando saranno autorizzate e pianificate le modifiche env. Nessuna chiave è stata generata, ruotata o cambiata.


## Registro avanzamento — 25 ottobre 2026

- Readiness: distinguere esplicitamente `storage_control` da storage E2E. La health action crea una signed-upload URL ma non esegue round-trip. Correzione nel bot commit `0ab11b0fab036f27a2ecebbfd8ab7ba580a71274`; CI su tale commit ancora da verificare.
- API head `c348cc0d6d1ba5b8334328570aaeb904cb9aa581`: CI run `40234931191` verde, cinque job; Vercel Preview `READY`. Nessuna evidenza di test E2E storage o produzione.
- Gate prioritari invariati: upload/download reale, restart e recovery, env staging verificate, isolamento e pulizia oggetti legacy, integrazione API-bot-Meta. PR #3 e #2 restano Draft e non unite.

- Nuova evidenza: bot CI run `40235440651` completata con successo sul commit `0ab11b0fab036f27a2ecebbfd8ab7ba580a71274`. La CI API sul commit documentale più recente risultava in corso al controllo; il codice applicativo API verificato resta quello del commit `c348cc0d6d1ba5b8334328570aaeb904cb9aa581`, CI verde e Preview READY.


## Stato verifiche — aggiornamento finale del ciclo, 25 ottobre 2026

- CI bot: run `40235440651` verde sul commit `0ab11b0fab036f27a2ecebbfd8ab7ba580a71274`.
- CI API: run `40235503317` verde sul commit documentale `2fb250205556ae967195b08197c618464184b624`, tutti e cinque i job riusciti.
- Vercel Preview del commit `2fb250205556ae967195b08197c618464184b624`: `READY` al controllo successivo. La produzione non è stata toccata.
- Questi esiti chiudono il controllo CI dei commit citati, non i gate di storage reale, restart/recovery, env staging, migrazione legacy e E2E Meta.

## Nuovo gate di routing MultiVocale — 25 ottobre 2026

- **Rilevato in revisione statica:** un audio rifiutato/non gestito dal runtime V2 poteva raggiungere il gestore legacy con stato in memoria; anche i comandi testuali MultiVocale non gestiti potevano ricadere nel percorso legacy.
- **Correzione implementata sul branch bot:** commit `d5e75a618d48a17a1f120153213167134bebe52f`.
- **Test aggiunti:** commit `ee9127f480746f83cb301822be153ddbfb993244`, per audio non gestito e comando MultiVocale non gestito.
- **Verifica:** CI del nuovo head ancora da confermare. Finché non è verde, stato = implementato, non ancora validato.
- **Non cambia il NO-GO di rilascio:** restano storage E2E, recovery dopo restart, env staging, migrazione/isolamento oggetti legacy e integrazione API-bot-Meta.

### Chiusura gate CI routing — 25 ottobre 2026

La run bot `40237092071` sul commit `ee9127f480746f83cb301822be153ddbfb993244` è `success`, con job `test` completato senza step falliti. Il rischio di fallback legacy per audio/comando non gestito è coperto dai nuovi test automatizzati. Restano aperti i gate di staging e integrazione end-to-end.

## Aggiornamento verifica — 26 ottobre 2026
- CI Assistant API head PR #3 `77ecff859726656a39d2e7b946cd22f96ed7e3fc`: run `40237237326`, tutti e 5 i job della matrice completati con successo.
- CI bot WhatsApp commit `ee9127f480746f83cb301822be153ddbfb993244`: run `40237092071` completata con successo; il run precedente `40237070328` è stato cancellato e non è l'esito finale.
- Le CI verdi non equivalgono a test live. Restano NON ESEGUITI: round-trip reale Supabase Storage e test cross-scope live, prova di recupero dopo riavvio Render, test webhook Meta con firme reali e flusso combinato WhatsApp end-to-end.
- Storage scoped: pianificare compatibilità/migrazione delle chiavi legacy prima del deploy; il nuovo formato rifiuta le chiavi non scoped. Verificare anche che le variabili Preview siano associate al branch candidato corretto.
- PR #3 (Assistant API) e PR #2 (bot) restano Draft/non unite; nessun merge o deploy di produzione autorizzato. Release NO-GO fino al superamento dei gate live. Nessuna nuova risorsa a pagamento, modifica di secret o operazione distruttiva eseguita.


## Riconvalida read-only — 26 ottobre 2026 (sessione di prosecuzione)

- Supabase project `tkfyfqgtumoeywlqzmdt`: stato `ACTIVE_HEALTHY`; registry migrazioni confermata a 15 record (dal 2026-10-01 al 2026-10-04); nessun branch di sviluppo. Nessuna migrazione applicata e nessun dato modificato.
- Riconfermata la criticità di conferma atomica leggendo le definizioni live delle RPC `vf_commit_owner_note_v1` e `vf_commit_owner_schedule_action_v1`: i percorsi di commit verificano il booleano `p_confirmed` e la proposta, ma non risultano validare e consumare atomicamente il corrispondente evento `owner_command_confirmation`. Il runtime applicativo continua correttamente a fallire chiuso con `ATOMIC_CONFIRMATION_NOT_ENABLED`. Gate di rilascio bloccante, da correggere solo con migrazione SQL autorevole in ambiente isolato.
- Vercel: deployment Preview READY sul branch candidato, head documentale `8f8a225433515209fc19ecbd5404201289c4547b`; Preview del codice API `77ecff859726656a39d2e7b946cd22f96ed7e3fc` anch'essa READY. Sono build Preview, non test E2E né produzione.
- Render: nota superata dalla riconvalida read-only del 26 ottobre 2026. Workspace e servizi sono stati identificati e verificati senza modifiche; il deploy live e i gate di staging sono descritti nell'addendum successivo.
- Nessuna prova reale Supabase Storage, restart Render o Meta/WhatsApp E2E è stata eseguita in questa sessione. Non dichiararle superate. Nessun merge, deploy di produzione, cambio di segreti, scrittura SQL o operazione distruttiva è stata eseguita.


## Aggiornamento evidenze verificate — 26 ottobre 2026 (Render/Vercel)

- Workspace Render già noto: My Workspace (tea-dadhee67bikc73c68s40). Staging vocalflash-bot-staging (srv-db03iaid0e5s739vhj0g) è collegato a multivocale-runtime-v2, auto-deploy disabilitato; deploy live corrente sul commit 34c63efb6e0e720e8dc07c10c3c457a5d59ae5b5 del 4 ottobre. Il candidato bot ee9127f480746f83cb301822be153ddbfb993244 non è quindi distribuito su staging. Produzione è separata e non è stata toccata.
- Inventario Vercel senza decrittazione: le variabili Preview branch-specifiche VOCALFLASH_ASSISTANT_API_KEYS, VF_ASSISTANT_SUPABASE_URL, VF_ASSISTANT_SUPABASE_SECRET_KEY, VF_MULTIVOCALE_STORAGE_BUCKET risultano collegate a assistant-auth-v1, non al branch candidato assistant-conversation-photo-v1. VOCALFLASH_ASSISTANT_API_KEY_SCOPES non compare nell'inventario restituito. Non aggiornare variabili né segreti senza autorizzazione.
- CI corrente: API head documentale a12364b2fa06bf737a839222b6e5931c838d8842, run 40376454322, cinque job success; bot head ee9127f480746f83cb301822be153ddbfb993244, run 40237092071, success. Preview Vercel del nuovo head API è READY. Questi risultati non sono E2E.
- Supabase: 15 migrazioni note, nessun branch di sviluppo; le ricerche per due nomi di migrazione distintivi non hanno recuperato fonti SQL autorevoli. Il blocco è di provenienza/riproducibilità, non autorizza a generare una falsa baseline.
- Sequenza dipendenze: recupero fonte migrazioni → ambiente isolato riproducibile senza costi non approvati → correzione atomica e testata della conferma → piano oggetti legacy + configurazione storage scoped → deploy solo staging autorizzato → test storage, restart/recovery, firma Meta e cinque prove E2E tracciabili → revisione congiunta PR #3/#2. Nessuna promozione a produzione prima del superamento di tutti i gate.


## Distinzione E2E storico vs candidato — 26 ottobre 2026

- Le conversazioni precedenti attestano un E2E PASS il 4 ottobre sul vecchio deploy staging: webhook ricevuto, audio 14.684 byte, VocalFlash API HTTP 200, 1 credito consumato, risposta WhatsApp HTTP 200; anche MultiVocale con due audio e API HTTP 200. Mancano message ID/provider ID.
- Il PASS storico resta valido per il deploy e la configurazione di quel momento. Non è una prova del candidato PR #2/#3: Render staging è ancora sul commit 34c63efb6e0e720e8dc07c10c3c457a5d59ae5b5; il candidato bot ee9127f480746f83cb301822be153ddbfb993244 non è distribuito e include la verifica HMAC Meta e routing aggiornato.
- Log Render dal 23 al 26 ottobre: zero righe restituite; ultimo evento deploy riuscito il 4 ottobre. Non interpretare l'assenza di log come guasto o come readiness.
- La roadmap deve quindi tenere separati E2E storico PASS e E2E candidato NOT RUN; prima del test candidato servono branch/env scoped e Meta App Secret corretti, senza toccare callback o produzione.


## Gate sicurezza conferma — dettaglio aggiuntivo 26 ottobre 2026

La RPC live vf_record_owner_command_confirmation_v1, in caso di conflitto su work_events_external_message_uidx (business_channel_id, external_message_id), recupera l'evento esistente senza confrontare event_type, membro, proposal_event_id e source event con la richiesta corrente. Aggiungere alla remediation atomica una distinzione tra replay identico e replay conflittuale; la sola risposta CONFIRMATION_EXISTS non deve autorizzare una write. Testare collisioni stesso ID/differente proposta, membro e tipo evento. Nessuna patch live: attendere fonte autorevole delle 15 migrazioni e database isolato riproducibile.


## Recupero migrazioni Supabase dal registro live — 26 ottobre 2026

Sono stati recuperati in sola lettura i 15 corpi SQL conservati in supabase_migrations.schema_migrations.statements e ricostruiti come file versionati in supabase/migrations. Il manifest registra Git blob SHA-1 e lunghezza dei corpi. Nessun SQL è stato eseguito. La provenienza è ora ricostruita dal registro applicato, ma non ancora validata con replay completo in un database isolato; il gate di riproducibilità resta aperto fino a quel confronto. Non creare branch a pagamento o applicare migrazioni live senza autorizzazione. La conferma titolare resta fail-closed e non è risolta da questo recupero.


## Baseline database — stato aggiornato 26 ottobre 2026

Le 15 migrazioni incrementali sono state recuperate dal registro live, versionate e corredate di manifest Git blob SHA-1 con validazione automatica in CI. Non costituiscono però un bootstrap schema: alterano/riutilizzano oggetti core che precedono la prima versione registrata. La roadmap resta bloccata sul recupero del baseline pre-2026-10-01 e sul replay isolato comparativo; nessun DDL live va applicato.
