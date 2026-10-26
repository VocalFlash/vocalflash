# VocalFlash — historical decisions and regression cases v1

**Updated:** 2026-10-23  
**Status:** consolidated from available project discussions and repository evidence. Historical test results are labeled as historical; they are not claims about the current deployment.

## Product evolution and decisions

### Original voice-note workflow

- Product began as a WhatsApp voice-note summarizer: customer/user forwards an audio message to the dedicated WhatsApp number; Meta webhook receives the event; Render/Python downloads the media; transcription and summarization produce a WhatsApp reply.
- The main value is a useful concise summary with salient points/actions, not a full transcript by default.
- A previous end-to-end test succeeded after fixing Meta app subscription and adding OpenAI credit. Do not infer that every later branch or new assistant route is deployed from that historic result.
- Current historic deployment shape: `VocalFlash/vocalflash-bot` is the Python/Flask WhatsApp bot on Render; `VocalFlash/vocalflash` is the website and Vercel API. The questionnaire belongs in the site repository, not the bot.

### MultiVocale

- The first vocal must not be lost when a user asks to summarize multiple voice notes; later notes should be appended to the same batch.
- Automatic batching uses a short sliding wait window from the latest arrival, with a bounded wait for in-flight downloads and protection against concurrent events.
- Keep manual commands/buttons and automatic batching compatible.
- Audio collection state previously lived partly in process memory; Redis-backed coordination improves deduplication/locks but does not by itself make audio/session state restart-safe.
- Historical staging work reported CI PASS and Render staging LIVE for a batching fix; a final real test was specified using two consecutive test-number voice notes and requiring one combined response without duplicate summaries/prompts. Do not mark that final manual test complete unless a result is recorded.
- MultiVocale must remain protected from customer-text routing and from new assistant releases.

### Product expansion: assistant that turns messages into action

- The direction changed from transcription utility to “Assistente WhatsApp / dal vocale all'azione”.
- Expected capabilities: recognize intent, extract data, detect missing/uncertain fields, ask the customer for details, apply business rules, propose the next action, request confirmation when required, and report only outcomes actually persisted.
- Customer requests and owner commands are separate security paths. Owner actions require verified identity and an exact proposal-bound confirmation.
- Examples span idraulica, edilizia/cantiere, immobiliare, mediazione finanziaria, legale, medico and generic requests. Do not include the pharmaceutical sector in the initial examples; pharmacy-specific agent workflows can be considered separately.
- The canonical plumber example collects the fault, zone/address, photos when appropriate, when it started, and availability. The assistant must not invent missing facts or confuse a proposed appointment with a booked one.

## Known voice-recognition / summary regression cases

A discussion on 2026-10-21 recorded a test of five voice notes with important errors:
- incorrect or omitted recognition around “sopralluogo”;
- incorrect recognition of “Via Etnea”;
- omission of “controllare le misure del locale”.

These are high-value regression cases because they affect domain terminology, proper names/addresses, and action-item recall. They should be added to a versioned Italian evaluation corpus, with the expected transcript, normalized transcript, summary and action list reviewed by a human. The exact audio samples must be retained only with appropriate rights/consent and privacy controls; otherwise use synthetic paraphrases for repeatable tests.

Acceptance measures should include:
- critical entity accuracy (names, addresses, numbers, dates, technical terms);
- action-item recall (including negation and follow-up tasks);
- unsupported additions / hallucinated details;
- summary usefulness and brevity;
- latency, cost and data-handling behavior.

Before replacing the transcription model, compare current supported providers on the same representative corpus and verify current availability/deprecation notices. Do not change the working production path based only on a single good example.

## Historical customer-discovery signal

A previously shared VocalFlash questionnaire had only two responses. Recorded results:
- WhatsApp used daily: 2/2;
- 0–5 voice notes/day: 2/2;
- re-listen to voice notes “sometimes”: 2/2;
- wanted a summary: 2/2;
- wanted customer data captured: 2/2;
- wanted reminders: 1/2;
- wanted “understand and summarize request”: 2/2;
- one response preferred “summary and let me decide”;
- willingness to pay €6–10: 2/2.

This is an early signal, not statistically representative market validation. It supports testing concise summaries and customer-data extraction first, but not pricing certainty or a broad paid launch. Collect additional evidence from real target businesses before finalizing plans.

## Other tracked product areas

- **Terminology vocabulary:** support reviewed canonical terms, synonyms, definitions, disambiguation, regional variants and examples per business. Vocabulary improves interpretation only; it must not create intent or authorize actions. Current runtime supports bounded approved metadata on the development branch, but the audited database had zero vocabulary rows.
- **Questionnaire:** site/Vercel feature; previous diagnostic found the Preview Supabase secret returned HTTP 401 despite the project URL being correct. This is separate from the Assistant database configuration.
- **Account/billing:** planned flow includes contact verification, plan selection, payment confirmation, activation, renewals/cancellation and server-side entitlement checks. Previous direction was Supabase Auth with Bird SMS Send SMS Hook, not Bird Verify; the integration remains incomplete and should not trigger purchases or secret changes without validation.
- **Privacy/security:** preserve privacy page, keep secrets server-side, minimize logs, define data retention/deletion, reconcile migration sources, review Supabase privileges and test Meta signature verification in staging.
- **VocalFlash Gruppi:** research official Meta API/policy capabilities and cost before promising support for existing groups or scheduled/on-demand summaries. Do not use unofficial scraping/workarounds.
- **VocalFlash Green / Sentinella Naxos Pearl:** future volunteer reporting flow via WhatsApp photo + location + voice/text; extract place, waste type, approximate quantity and need while keeping human review and uncertainty.
- **Commercial launch:** verify Vercel plan eligibility for commercial production, billing integration, support and privacy/legal readiness before launch.

## Current technical release facts

- Assistant API PR #3 and Python bot PR #2 are still Draft and unmerged.
- Latest inspected Assistant CI run on the newly updated docs commit was queued when checked; its result is not yet known. Earlier code/test runs on 2026-10-23 passed.
- Python bot CI passed on its inspected 2026-10-22 commit.
- The two PRs depend on each other and must be validated together in staging.
- Persistent multi-turn state, atomic proposal-bound confirmation, durable outbound outbox/reconciliation, full media-only ingestion, populated pilot configuration, and combined staging E2E remain release gates.
- Do not create a Supabase development branch until its current cost is recalculated and approved; the previous estimate is historical only.
- Do not merge/deploy or alter production as part of this planning record.
