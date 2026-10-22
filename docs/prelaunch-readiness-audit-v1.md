# VocalFlash pre-launch readiness audit — 2026-10-22

Status: read-only audit. No database writes, schema changes, merges, or production deployments were performed.

## Verified code and CI

- JavaScript assistant PR: `assistant-conversation-photo-v1` → `assistant-auth-v1`, PR #3, still Draft/open/not merged.
- Current head: `43add6c755c81112db2b67f42d2023e1c4345b6d`.
- GitHub Actions run #39769310989: 41 tests passed, 0 failed, 0 skipped; dependency audit reported 0 vulnerabilities.
- Vercel Preview for the current head: READY. This is not a production deployment and not an end-to-end WhatsApp test.
- Python bot PR #2 remains Draft/open/not merged; its last verified CI run passed 10/10 tests.
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
