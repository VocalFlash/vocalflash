# VocalFlash — staging end-to-end release runbook v1

**Updated:** 2026-10-23  
**Status:** execution checklist only. No test in this document is claimed as run. No production deployment, live schema change, secret change, or database branch creation is authorized by this document.

## Release principle

The JavaScript Assistant API PR and Python/Render bot PR are a single release unit. Keep both PRs Draft until the gates below pass with recorded evidence. A green unit-test workflow or Vercel Preview is necessary but not sufficient.

## Preconditions — do not start a live WhatsApp test until all are true

- [ ] Confirm the exact Render staging service/workspace and the dedicated Meta test app/phone number. Do not infer that the production number is a test number.
- [ ] Confirm the Assistant API Preview/staging URL is protected as intended and reachable only by the bot/service credentials.
- [ ] Confirm staging has the matching Meta App Secret, WhatsApp token/phone ID/verify token, Redis URL, Assistant API URL/key, Supabase URL/key, and transcription key configured in the correct secret stores. Never copy secret values into this runbook, issues, logs, or chat.
- [ ] Confirm startup readiness reports each dependency as healthy; do not expose secrets or customer message content in diagnostics.
- [ ] Confirm the staging database is isolated from production and uses synthetic/test data. If no safe development database exists, stop before stateful/write tests; do not use production as a substitute.
- [ ] Confirm the test business has exactly the intended active WhatsApp channel, active workflow catalogue, required-data definitions, explicit creation policy, and authorized test member. Missing configuration must fail closed.
- [ ] Record tested code SHAs, deployment identifiers, timestamps, test message IDs, sanitized outcomes, and provider message IDs. Do not store phone numbers or message bodies in the evidence log.

## Gate A — static and automated checks

- [ ] Site PR CI passes on the current head SHA.
- [ ] Bot PR CI passes on the current head SHA.
- [ ] Vercel Preview for the current site head is Ready.
- [ ] Re-check the cross-repository contract: the API returns assistant_message only under the customer path, and the bot sends only that explicit server-generated field.
- [ ] Re-check PR heads have not changed since the recorded results. Any new commit requires fresh CI and Preview evidence.

## Gate B — webhook authentication and dependency failure

Run only against staging using a harmless synthetic payload.

- [ ] Genuine Meta delivery with a valid signature is accepted and processed once.
- [ ] Missing signature is rejected (expected HTTP 403).
- [ ] Incorrect signature or body changed after signing is rejected (expected HTTP 403).
- [ ] Missing Meta App Secret fails closed (expected HTTP 503); restore the correct staging configuration afterward.
- [ ] Missing/unhealthy Redis fails closed without triggering duplicate processing.
- [ ] An Assistant API outage does not falsely tell the customer that a request was created.
- [ ] Diagnostics contain no credentials, full phone numbers, raw audio, or full customer message bodies.

## Gate C — customer-text assistant, persistence and safety

Use synthetic messages and the staging business only.

- [ ] A simple supported request is routed to the correct active workflow.
- [ ] Missing required fields produce one specific, relevant follow-up question.
- [ ] An uncertain extracted value is explicitly confirmed rather than silently accepted.
- [ ] Unknown/inactive/cross-business workflow, malformed required-data schema, missing policy, ambiguous classification, and multi-workflow classification produce no work-item write.
- [ ] A message that only mentions a vocabulary term does not create intent.
- [ ] Prompt injection in customer text or vocabulary does not change policy or authorize an action.
- [ ] Duplicate delivery of the same external message ID creates no duplicate event/work item/reply.
- [ ] Two concurrent turns from the same sender do not mix fields or create duplicate work.
- [ ] Two unrelated requests from the same sender are not silently merged.
- [ ] An error or ambiguous timeout never results in a claim that a work item was created unless the persisted outcome is verified.
- [ ] Owner commands remain blocked for writes while the runtime returns ATOMIC_CONFIRMATION_NOT_ENABLED. Do not bypass this gate with a caller-supplied boolean or direct production RPC.

**Important:** complete persistent multi-turn conversation state and a durable outbound outbox are not implemented yet. Tests requiring restart-safe field collection, atomic proposal-bound confirmation, or delivery reconciliation are release blockers and must not be marked passed based only on unit tests.

## Gate D — outbound WhatsApp behavior

- [ ] Exactly one reply is attempted for a successfully processed customer text event.
- [ ] The reply accurately reflects the persisted outcome; no “practice opened”, “appointment booked”, or “message delivered” claim without verified evidence.
- [ ] Duplicate webhook delivery does not trigger a second send.
- [ ] A simulated ambiguous send timeout leaves an operational reconciliation case and does not blindly resend.
- [ ] Record the difference between provider acceptance and recipient delivery; do not call them equivalent.

The current Redis marker is an at-most-once guard with a finite TTL, not an exactly-once delivery guarantee. A durable outbox and provider-status reconciliation remain required before reliable commercial launch.

## Gate E — legacy voice and MultiVocale regression

Run independently from the customer-text assistant test, using the dedicated test number.

- [ ] Send one ordinary voice note and confirm the legacy transcription/concise summary path still works.
- [ ] Send two consecutive voice notes within the documented batching window; verify one combined summary includes both audios in order.
- [ ] Verify the manual “Riepiloga più vocali” command/button still works and does not lose the first audio.
- [ ] Replay a duplicate webhook and verify there is no duplicate summary or prompt.
- [ ] Exercise concurrent/late arrivals and a controlled worker restart; record any loss, reordering, duplicate or stuck batch.
- [ ] Confirm ordinary text requests do not get misrouted into MultiVocale and audio messages are not sent through the customer-text path.
- [ ] Confirm the response prioritizes salient facts and action items rather than dumping a full transcript by default.

Do not claim this gate passed based on historical staging results. Record the actual current run.

## Gate F — media-only messages

- [ ] Verify current behavior for image/document-only messages is explicit and safe.
- [ ] Do not fabricate normalized text or weaken the existing non-empty-text ingest contract merely to make media appear supported.
- [ ] Do not claim vision/media intake is complete until metadata, secure media references, consent, retention/deletion, uncertainty handling, and the end-to-end response path are implemented and tested.

## Evidence record

For every case, record case ID, code SHA, staging deployment ID, start/end time, sanitized input category (not raw personal content), expected outcome, observed outcome, event/work-item/reply identifiers where safe, pass/fail, and follow-up issue. Keep secrets and personal data out of the report.

## Rollback / stop conditions

Stop immediately if any of the following occurs:

- a test writes to production or crosses business boundaries;
- a duplicate work item or duplicate reply is created;
- an unauthorized/ambiguous action is written;
- a webhook without a valid signature triggers processing;
- logs expose secrets or unnecessary personal data;
- the legacy voice/MultiVocale path regresses;
- a test result cannot be distinguished from an unverified assumption.

Do not promote either PR independently. After all gates pass, review both PRs together, confirm cost/security/business configuration decisions, obtain explicit release authorization, and deploy to production only through the approved release procedure.


## Snapshot evidenze automatizzate — 24 ottobre 2026

Questa sezione aggiorna il Gate A senza dichiarare concluso lo staging end-to-end.

- [PASS] API Assistant, commit `77fbddfa19d04a7a163e3af1ba6c9ed379abee97`: [GitHub Actions #40114128653](https://github.com/VocalFlash/vocalflash/actions/runs/40114128653), cinque passaggi riusciti; ciascuno 89 test passati, zero fallimenti.
- [PASS] Bot WhatsApp, commit `7ad05b42122c939a5669c2fdceeae604185aec09`: [GitHub Actions #40113909039](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40113909039), cinque passaggi riusciti; ciascuno 35 test.
- [PASS] SMS Hook/Bird, head `ca1d3f46cef0f8fa38a8c534eb70985500481dcc`: [GitHub Actions #40113926527](https://github.com/VocalFlash/vocalflash/actions/runs/40113926527), cinque passaggi riusciti; ciascuno 11 test, zero fallimenti. Un secondo run sullo stesso head ha superato anch'esso cinque passaggi.
- [PASS] Preview Vercel del commit API `77fbddfa19d04a7a163e3af1ba6c9ed379abee97` = `success`; non è produzione.
- [NOT RUN] Webhook Meta reale firmato in staging, configurazione Render/Meta segreti, persistenza multi-turno dopo restart, scrittura titolare atomica, outbox/reconciliation, prova end-to-end customer→API→Supabase→bot e regressione audio su numero test.
- [BLOCKED] Conferma titolare atomica, fonte SQL delle 15 migrazioni, ambiente staging DB isolato non stabilito/approvato.
- Nessun SMS reale, deploy, modifica schema live, credenziale, utente Auth o business member creato.

Il totale dei tre test matrix principali è 675 esecuzioni riuscite (API 445 + bot 175 + SMS 55), zero fallimenti nei run finali verificati. Questo non autorizza a promuovere le PR: mantenere Draft e NO-GO fino al completamento dei gate E2E e delle decisioni di costo/configurazione.

## Gate status refresh — 24 October 2026

**Do not execute or mark the integrated E2E as passed yet.** The automated component suites have five successful passes each (API 89 tests/pass, bot 35/pass, Bird SMS 11/pass), but prerequisites for safe integrated staging remain unverified. Before the five E2E repetitions: recover and reconcile all 15 authoritative migrations; prepare an isolated replayable staging database without adding paid resources absent approval; implement and test atomic confirmation; complete durable conversation state and outbound outbox/reconciliation; verify staging-only Meta credentials and authorized test identity. Then run five independent, traceable E2E attempts with synthetic data and record inbound event, routing, persisted state, outbound attempt and final/ambiguous delivery outcome. Never infer delivery from HTTP acceptance alone. Production release remains NO-GO.
