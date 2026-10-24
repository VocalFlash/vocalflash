# Cross-repository Assistant release verification matrix v1

Status: test plan only. No live end-to-end run is claimed by this document.

Scope: site/API PR #3 and bot PR #2, treated as one release unit. The purpose is to turn the existing runbook and newly identified release blockers into reproducible evidence. Do not use production data, production writes, production secrets in local test logs, or a production deployment to complete this matrix.

## Evidence labels

- **PASS**: command/test was executed against the exact candidate commit and the result is retained.
- **FAIL**: a reproducible failure exists; include sanitized request shape, expected/actual result, and candidate SHA.
- **BLOCKED**: cannot safely test until the prerequisite is met.
- **NOT RUN**: no evidence yet. Never convert NOT RUN or BLOCKED into PASS based on code review alone.

Every result must record repository, full commit SHA, test environment, timestamp, result, and evidence URL. Redact tokens, phone numbers, customer messages, media URLs, and personal data.

## Gate 0 — candidate identity and change control

- [ ] Record exact site/API candidate SHA and bot candidate SHA.
- [ ] Confirm both PRs remain Draft until all gates are reviewed.
- [ ] Confirm no unexpected changes to production environment, database schema/data, secrets, or deployments.
- [ ] Re-run CI for the exact candidate SHAs after any code or test change.
- [ ] Verify Preview is not mistaken for a production deployment.

## Gate 1 — API authentication, readiness, and credentials

- [ ] Missing/invalid X-VocalFlash-Assistant-Key is rejected.
- [ ] Authenticated liveness is distinguished from dependency readiness.
- [ ] Missing Supabase URL or secret cannot produce a ready status.
- [ ] A bounded, read-only dependency probe failure or timeout cannot produce a ready status.
- [ ] Modern sb_secret_ credential headers are tested for REST and RPC requests.
- [ ] Legacy service-role JWT handling, if supported, is documented and tested separately.
- [ ] Origin lookup, customer event ingest, workflow/policy reads, and owner persistence use the same documented credential policy.
- [ ] Health responses reveal no secrets, database URLs, customer data, or internal stack traces.

Related blockers: site issues #6 and #7. Keep this gate BLOCKED until code and automated tests demonstrate the required behavior; a static review is not a passing test.

## Gate 2 — Meta webhook trust boundary

- [ ] Correct HMAC-SHA256 signature and unchanged request body are accepted.
- [ ] Missing, malformed, incorrect, and body-tampered signatures are rejected.
- [ ] Missing META_APP_SECRET fails closed.
- [ ] Signature validation happens before parsing or processing event content.
- [ ] Staging uses the secret belonging to the correct Meta app; only presence/status is recorded in evidence.
- [ ] Genuine Meta staging delivery is processed and the response path is confirmed.
- [ ] No live webhook test is performed against production without explicit release authorization.

The automated signature suite is not proof that the matching secret is configured in Render.

## Gate 3 — inbound idempotency, durable outbound, and failure ambiguity

- [ ] Duplicate inbound webhook before processing completes.
- [ ] Duplicate inbound webhook after the inbound dedup TTL.
- [ ] Assistant API commits its result but its HTTP response is lost.
- [ ] Meta accepts a send but the client times out before receiving the response.
- [ ] Definitive provider rejection versus ambiguous timeout are handled differently.
- [ ] Concurrent workers attempt the same outbound intent.
- [ ] Process restart occurs while an outbound message is pending.
- [ ] Provider status callbacks are reconciled with the stored outbound intent.
- [ ] Retry policy never turns an unknown send outcome into an unbounded duplicate-send risk.
- [ ] The outbound intent has a durable unique key based on source event, business/channel, and reply version.

Related blocker: bot issue #3. The current 24-hour Redis marker is at-most-once protection, not durable exactly-once delivery. This gate is BLOCKED until an outbox/reconciliation design is implemented and tested.

## Gate 4 — business routing and safe writes

- [ ] Active WhatsApp channel resolves to exactly one business.
- [ ] Inactive, absent, or ambiguous channel fails closed.
- [ ] Customer and owner senders route to separate processing paths.
- [ ] An unverified or inactive member cannot execute owner commands.
- [ ] Cross-business member, workflow, policy, or event IDs are denied.
- [ ] Required or uncertain customer data returns a clarification request without a business write.
- [ ] Every extracted PROVIDED value and its evidence are literal excerpts of the source message after only Unicode/whitespace/case normalization; unsupported field-specific normalization must fail closed.
- [ ] Confidence is finite and within the declared 0–1 range; confidence alone never authorizes a write.
- [ ] Fabricated values, fabricated evidence, malformed confidence, and promised-future data are covered by regression tests.
- [ ] A single authorized action writes only when policy allows it.
- [ ] Duplicate source event replays return the existing result and do not create another work item.
- [ ] Owner confirmation replay is idempotent and proposal-bound.
- [ ] Multi-action batches remain review-only until batch atomicity is supported.
- [ ] No side-effecting test runs against production.

## Gate 5 — legacy audio and MultiVocale regression

- [ ] One audio message follows the established transcription/summarization path.
- [ ] The response emphasizes salient points and actions, not the full transcript by default.
- [ ] First voice is retained when later voices are added.
- [ ] Automatic batching and manual “summarize now” do not create duplicate summaries.
- [ ] Simultaneous arrivals, provider retries, worker failure, and process restart are tested.
- [ ] Text-only messages do not get swallowed by the MultiVocale handler.
- [ ] Media errors produce safe, actionable responses and do not leak credentials or media URLs.

## Gate 6 — Italian ASR and multi-sector quality

- [ ] Run a lawful synthetic or explicitly consented corpus with frozen expected transcripts and expected action extraction.
- [ ] Include terms and phrases such as “sopralluogo”, “Via Etnea”, and “controllare le misure del locale”.
- [ ] Score transcription fidelity separately from summary quality and action-item recall.
- [ ] Test plumbing/maintenance, construction, real estate, financial mediation, legal, medical, generic, ambiguous, multi-workflow, vocabulary-only, and adversarial inputs.
- [ ] Compare model/provider options on the same corpus, recording latency, token use, cost estimate, and errors.
- [ ] No production model/provider switch until acceptance thresholds and rollback criteria are approved.

The existing classifier test plan and resolver results must not be treated as evidence that this full Assistant/ASR corpus has passed.

## Gate 7 — release decision

Release is **NO-GO** if any of these remain unresolved:
- health/readiness can give a false positive;
- Supabase key format and REST/RPC header behavior are unverified;
- durable outbound intent and ambiguous-outcome reconciliation are absent;
- persistent conversation state and confirmation atomicity remain incomplete for the enabled flows;
- Meta signature configuration is not verified in staging;
- any staging end-to-end gate has no evidence.

A GO decision requires review of exact candidate SHAs, all gate evidence, rollback procedure, monitoring/owner, and explicit release approval. Passing CI alone is insufficient.

## Current status at document creation

- CI for the previously reviewed site/API candidate: PASS (run 39919606346).
- Vercel Preview status for that candidate: PASS, Preview only.
- CI for the previously reviewed bot candidate: PASS (run 39822398223).
- Full current-candidate staging end-to-end: NOT RUN.
- Gates 1 and 3: BLOCKED by the issues cited above.
- Supabase isolated development environment: BLOCKED pending current cost check and explicit approval.

## Risultati CI aggiornati — 24 ottobre 2026

### PASS — suite automatizzate ripetute 5 volte
- API Assistant commit `77fbddfa19d04a7a163e3af1ba6c9ed379abee97`: [run #40114128653](https://github.com/VocalFlash/vocalflash/actions/runs/40114128653), 5/5 job success; ogni job 89 test passati, 0 falliti.
- Bot WhatsApp commit `7ad05b42122c939a5669c2fdceeae604185aec09`: [run #40113909039](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40113909039), 5/5 job success; ogni job 35 test.
- SMS Hook head `ca1d3f46cef0f8fa38a8c534eb70985500481dcc`: [run #40113926527](https://github.com/VocalFlash/vocalflash/actions/runs/40113926527), 5/5 job success; ogni job 11 test, 0 fallimenti. Il secondo evento [#40113921972](https://github.com/VocalFlash/vocalflash/actions/runs/40113921972) ha anch'esso 5/5 job success.
- Le suite automatizzate sommano almeno 675 esecuzioni riuscite nei tre sottosistemi. I test coprono i rispettivi casi unitari; non costituiscono prova di un flusso end-to-end live.

### Stato dei gate di rilascio
- Gate 0 candidato/CI: PASS per i commit sopra indicati; PR #2, #3, #9 ancora Draft.
- Preview Vercel per commit API `77fbddfa19d04a7a163e3af1ba6c9ed379abee97`: `success`, Preview soltanto.
- Gate 1 credenziali/readiness: test automatizzati passati; la verifica di staging di tutte le configurazioni e del servizio reale resta NOT RUN.
- Gate 2 Meta trust boundary: suite di firma bot passata; configurazione segreto e delivery reale in staging NOT RUN.
- Gate 3 outbox/reconciliation: BLOCKED; protezioni dedup/ambiguous-send esistenti non equivalgono a outbox durevole e riconciliazione.
- Gate 4 scritture/confirm: BLOCKED; `ATOMIC_CONFIRMATION_NOT_ENABLED` resta attivo.
- Gate 5 audio/MultiVocale: regressioni unit test bot passate; prova corrente su numero Meta di test e restart worker NOT RUN.
- Gate 6 ASR/multisettore: corpus completo congelato con score di qualità NOT RUN.
- Gate 7: **NO-GO** finché i blocchi sopra e staging E2E non sono chiusi.

### Supabase live
15 migrazioni registrate, nessuna Edge Function distribuita; advisor aggiornati: 15 tabelle RLS senza policy, 18 FK senza indice di copertura, 26 indici inutilizzati segnalati. La provenienza delle migrazioni resta aperta. Non modificare policy/indici né applicare schema senza fonte SQL riconciliata e test in ambiente isolato.

## Recheck refresh — 24 October 2026

Repeated automated suite results have been verified from individual GitHub Actions logs: Assistant API 5 × 89/89, WhatsApp bot 5 × 35/35, Bird SMS Hook 5 × 11/11. Main matrix: 675 successful test executions. Additional API and SMS five-pass runs add 500 and 55 successful executions respectively. These remain unit/focused suites; no five-run integrated staging E2E evidence exists.

Release gates remain open: authoritative 15-migration baseline reconciliation, atomic one-time owner confirmation bound to writes, durable multi-turn conversation state, outbound outbox/reconciliation, and signed Meta-to-WhatsApp staging E2E. No live DB change, merge, or production deploy was performed. Detailed current evidence is in the Libro sacro operativo and the refreshed atomicity/migration audits.
