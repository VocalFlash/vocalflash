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
