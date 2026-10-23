# VocalFlash — master roadmap and architecture guardrails v1

**Updated:** 2026-10-23  
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
- The draft catalog now has 699 unique sector-scoped entries; a read-only structural audit found 40 enriched plumbing entries and no duplicate sector/normalized-term pairs. All entries remain draft; no expert review or runtime import is implied.
- Added `scripts/validate-professional-terminology-catalog.mjs` and added its invocation to the Assistant test workflow. Its GitHub Actions result is pending confirmation; do not treat the local structural audit as CI evidence.
- Next autonomous glossary step: enrich another carefully scoped batch and add semantic/sector review checks without promoting terms to approved or importing draft entries into the database.
