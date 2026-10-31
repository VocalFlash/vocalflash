# VocalFlash pre-launch readiness audit — 2026-10-22

Status: read-only audit. No database writes, schema changes, merges, or production deployments were performed.

## Verified code and CI

- JavaScript assistant PR: `assistant-conversation-photo-v1` → `assistant-auth-v1`, PR #3, still Draft/open/not merged.
- Source-code head reviewed for the implementation audit: `85293847131493cbad6ad6997d4d788aa239e460`. Subsequent commits on this branch updated audit documentation only; the latest checked documentation commit at this revision was `650af73bcb5cdc2a53f333b8b1b9e68b48ec38f7`.
- GitHub Actions run [#39824601956](https://github.com/VocalFlash/vocalflash/actions/runs/39824601956) passed on code head `85293847131493cbad6ad6997d4d788aa239e460`. After the required-data schema alignment and new regression tests, latest run [#39827480693](https://github.com/VocalFlash/vocalflash/actions/runs/39827480693) passed. The latest checked Preview head at this audit revision is `418c0e7176c972eb6f5e0745a0cdf18d07c24541`, with Vercel status `success` and focused CI run [#39828114612](https://github.com/VocalFlash/vocalflash/actions/runs/39828114612) passing. These are focused CI/Preview checks, not full end-to-end verification.
- Vercel Preview for the current head: READY. This is not a production deployment and not an end-to-end WhatsApp test.
- Python bot PR #2 remains Draft/open/not merged. GitHub Actions run [#39822398223](https://github.com/VocalFlash/vocalflash-bot/actions/runs/39822398223) passed for current head `d110184080471c4129392330ac6bd1d502a14932`.
- The JS and Python changes depend on each other for customer-facing assistant replies and must be released together after staging verification.

## Read-only Supabase snapshot

Project: VocalFlash Assistant, region `eu-west-1`.

Current row counts:
- `businesses`: 1
- `business_channels`: 1
- `business_members`: 0
- `workflows`: 1
- `assistant_policies`: 0
- `business_vocabulary`: 0
- `work_items`: 1
- `work_events`: 4
- `event_routing_decisions`: 2

The only workflow is active but named `Richiesta generica — TEST`; its `required_data` is an empty object. This is not a production-ready business configuration. No owner member, creation policy, or terminology vocabulary is configured.

No Supabase development branches currently exist.

## Security and performance advisor findings

Latest read-only advisor results:
- 15 public tables have RLS enabled but no policies.
- 18 foreign-key constraints lack covering indexes.
- 28 indexes are reported unused.

A separate privilege check found no direct SELECT/INSERT/UPDATE/DELETE grants on these public tables to `anon` or `authenticated`. The application RPC functions inspected were not executable by those roles; the application RPCs were executable by `service_role` only. The inspected SECURITY DEFINER functions have explicit `search_path` settings. Therefore, the RLS-without-policy advisor result is a required hardening/review item, but the privilege check did not show direct table access for `anon` or `authenticated` at this snapshot.

Do not remove unused indexes mechanically: the project is small/test-configured, so the usage statistics may not represent real production traffic. Missing FK indexes should be prioritized by actual query patterns and constraints.

## Already improved in the development branch

- Vocabulary context is scoped to the current business, explicitly active rows only, bounded to 100 entries, and treated as untrusted data rather than authority.
- If the optional vocabulary lookup fails, classification continues without that optional context and logs a generic diagnostic.
- Classifier output validation rejects invalid workflow references, duplicate routes/candidates, invalid confidence, and contradictory decision/clarification fields.
- Multi-workflow intake is explicitly review-only; it cannot auto-split or create a work item.
- Customer replies now distinguish multi-workflow review and unclassified requests without claiming that a practice was opened.
- Regression tests cover the above guardrails.
- The NEW Work Intake Plan now uses the same strict `normalizeRequiredFields` contract as the extractor. Unsupported `required_data` objects and malformed field definitions return `CONFIG_REQUIRED`; the plan exposes normalized field definitions only and keeps creation disabled. The new tests are included in the focused CI workflow.

## Blocked pending explicit approval or business decisions

1. **Development database branch** for persistent multi-turn state, confirmation, media metadata, and delivery outbox. The branch tool previously quoted approximately $0.01344/hour (about $9.80 per 730-hour month before other usage); recalculate immediately before creation and obtain explicit cost approval. Do not create it before approval.
2. **Business configuration**: identify the first pilot business/sector, its real workflows, required fields, creation policy modes, owner/member identity, and vocabulary. The current workflow is explicitly a test fixture.
3. **Confirmation semantics**: define which actions can be automatic, which require customer confirmation, and which require the owner/professional.
4. **Media behavior**: decide the intended handling of image/document-only messages and the consent/retention rules for uploaded media. The existing ingest contract requires non-empty normalized text.
5. **Staging access**: Render workspace selection is not currently set in the connector. The correct workspace must be explicitly selected before inspecting or changing Render resources.
6. **Release authorization**: keep both PRs unmerged and production unchanged until end-to-end staging tests pass and release is explicitly approved.

## Release gates

- Persisted conversation state and confirmation must be atomic/idempotent and tested with concurrency, retries, expiry, wrong sender, and changed proposal.
- Add durable outbound outbox and reconciliation; current WhatsApp send guard is at-most-once and can leave ambiguous sends requiring manual review.
- Complete image/document ingestion without fabricating text; test vision extraction separately from authorization and work creation.
- Configure and test the first pilot business with synthetic/staging data.
- Verify RLS, grants, function privileges, advisors, logs, and data retention after the development migration.
- Run the JS and Python changes together in staging, including real WhatsApp inbound/outbound delivery, before any production release.


## Owner confirmation audit — verified 2026-10-22

The separate [owner confirmation atomicity audit](owner-confirmation-atomicity-audit-v1.md) inspected the live definitions of the owner-command RPCs without changing database state.

- `vf_record_owner_command_confirmation_v1` records a confirmation event tied to a proposal and source event.
- `vf_commit_owner_note_v1` and `vf_commit_owner_schedule_action_v1` accept `p_confirmed` and a proposal ID, but the inspected definitions do not validate a matching confirmation event or enforce its expiry/one-time consumption.
- The inspected RPC privileges showed `EXECUTE` for `service_role` and `postgres`, not `anon` or `authenticated`. This is not evidence of public direct RPC access, but it does leave the service-side contract incomplete.
- Runtime remains fail-closed with `ATOMIC_CONFIRMATION_NOT_ENABLED`. Do not enable confirmation writes until proposal binding, expiry, one-time consumption, and the requested write are validated atomically and tested under concurrency and replay.

The Meta POST signature verification code and tests are present only in the Python development PR. `META_APP_SECRET` has not been verified as configured in Render staging or production; no deployment was performed.


## Additional audits — verified 2026-10-22

- [Supabase migration provenance audit](supabase-migration-provenance-audit-v1.md) records the 15 migrations in the live registry. The authoritative source sequence has not yet been reconciled end to end; this is a release gate, not proof that migration files are absent from every branch/repository.
- The latest required-data guardrail change and its tests passed focused GitHub Actions run [#39827480693](https://github.com/VocalFlash/vocalflash/actions/runs/39827480693). No database or production change was made.


## Read-only configuration refresh — 24 October 2026

The earlier snapshot above is historical; the current counts differ. Direct SELECT-only queries against the live project now return:
- `businesses`: 1; active business sector is `plumbing_maintenance` / staging-labelled.
- `business_channels`: 1; active WhatsApp channel; external account ID is present, channel address is not populated. The value itself was not exposed in this audit.
- `business_members`: 0. No verified owner/member row exists, so owner-command execution and pilot authorization remain blocked.
- `workflows`: 2 total; `generic_request_test` is inactive with an empty required-data object; `maintenance_request` is active and has one required-data field.
- `assistant_policies`: 1 active policy, scope `workflow`, key `create_work_item`, autonomy mode `confirm`, sensitivity `standard`, bound to a workflow.
- `business_vocabulary`: 14 active rows (6 component, 1 equipment, 4 symptom, 1 system, 2 work_action). These are staging-scoped terms, not the 699-entry draft catalog.
- Existing counts for `work_items` (1), `work_events` (4), and `event_routing_decisions` (2) remain as observed by the same count query.

No row content containing names, phone numbers, customer messages, or external account identifiers was retrieved. No data was inserted, updated, or deleted. The staging workflow/policy setup is more complete than the 22 October snapshot, but **zero business members** remains a decisive blocker; do not fabricate one or run a real owner flow without a verified Auth identity and explicit pilot authorization. The active policy's `confirm` mode does not override the runtime's `ATOMIC_CONFIRMATION_NOT_ENABLED` guard.


## Refresh di stato live e ambiente candidato — 27 ottobre 2026

Read-only Supabase: 0 Auth users, 0 business members, 1 work item, 4 work events, 1 workflow attivo, 1 policy attiva, 14 termini di vocabolario attivi; 0 eventi owner-command proposta/conferma/ricevuto. Non esiste quindi una identità owner valida né un caso reale da confermare; non fabbricare utenti o eventi.

Le nuove RPC owner-confirmation v2 non risultano installate nel database live. Le sei tabelle operative ispezionate hanno RLS abilitato ma non forzato e nessuna policy diretta nella catalog query; le RPC legacy esaminate sono `SECURITY DEFINER`, proprietario postgres e `search_path=public, pg_temp`. La verifica deve includere esplicitamente i controlli tenant/member/channel delle funzioni e gli ACL.

L'inventario Vercel, eseguito senza decifrare segreti, mostra che le variabili Preview `VF_ASSISTANT_SUPABASE_URL`, `VF_ASSISTANT_SUPABASE_SECRET_KEY` e `VOCALFLASH_ASSISTANT_API_KEYS` sono associate al branch `assistant-auth-v1`, non alla branch owner-confirmation; `OWNER_COMMAND_CONFIRMATION_TTL_SECONDS` non è presente. Non eseguire l'E2E fino a quando l'ambiente non è configurato con approvazione esplicita.

CI #40493167613 è passata sul pre-audit head `06c616e40f4aedc47b76eb19eb8678b17fa9cfc3` (cinque pass API e contratto PostgreSQL isolato). Questo non prova la parità con schema completo, il Preview configurato o il percorso Meta/WhatsApp. Il baseline pre-registry, il replay completo e i gate legali/privacy restano aperti.


## Corsia questionario/ESM — controllo separato, 27 ottobre 2026

La PR #1 `questionario-e2e-v1` resta Draft su `main`. La correzione proposta aggiunge `type: module` per l'API ESM; i controlli Preview riportati nella PR hanno risposte HTTP attese per le route diagnostiche. Rimane però un problema separato: nel Preview del questionario `SUPABASE_URL` punta al progetto atteso, ma il `SUPABASE_SECRET_KEY` configurato restituisce HTTP 401. Non confondere questo problema con le variabili Assistant `VF_ASSISTANT_*`. Non ruotare o modificare chiavi senza diagnosi e approvazione esplicita. Prima di promuovere il questionario su `main`, risolvere ESM e validare la credenziale del progetto questionario su Preview, poi rieseguire i test sul branch finale. Nessuna credenziale è stata letta o modificata in questo audit.
