# Customer conversation state — design v1

Status: design only. This document does not change the database schema, deploy code, or authorize automatic work creation.

## Verified constraints from the current implementation

- Inbound WhatsApp messages are persisted as `public.work_events` through `vf_ingest_customer_whatsapp_event_v1`.
- Ingest currently rejects empty `p_normalized_text`; image/document-only messages therefore cannot use the existing path safely.
- `public.work_data` is keyed to an existing `work_item_id`. It cannot by itself hold fields collected before a work item exists.
- `public.event_routing_decisions` records routing per source event; it is not a multi-turn conversation state store.
- New-work creation is gated by workflow, required data, policy, routing, and persistence checks. Missing policy/configuration must continue to fail closed.
- The active database has no Supabase development branches. Do not apply this design directly to the live schema.

## Goal

Resume a customer conversation after a later inbound message, process retries safely, and keep different businesses/channels/senders isolated. A conversation is orchestration state; it is not a substitute for the immutable event history or the canonical work-item data.

## Proposed persistence model

Introduce a dedicated `customer_conversations` table only after a development database branch and migration/test path are available.

Minimum fields:
- `id` UUID primary key.
- `business_id` and `business_channel_id` with composite foreign-key constraints that prevent cross-business references.
- `contact_id` and normalized sender identity; do not use the sender phone number alone as a global key.
- `state`: constrained enum/text values such as `collecting`, `awaiting_confirmation`, `authorized`, `completed`, `handoff`, `expired`.
- `active_work_item_id`, nullable until a real work item exists.
- `workflow_id` and workflow version, nullable until a workflow has been resolved.
- `pending_data` JSONB for pre-creation candidate fields, each retaining value, status (`collected` / `needs_confirmation`), source event ID, confidence/evidence metadata, and field key. Do not silently promote uncertain values to confirmed facts.
- `last_event_id`, `expires_at`, `version` for optimistic concurrency, and created/updated timestamps.
- Optional `metadata` restricted to non-sensitive operational details; do not duplicate full message bodies or media.

Identity and concurrency:
- Scope every conversation to the business and channel as well as the customer/contact.
- Enforce at most one active conversation per scoped sender with a partial unique index over the canonical key for non-terminal states.
- Serialize updates by conversation ID (transaction-scoped advisory lock or equivalent row lock); use `version` compare-and-swap to reject stale writes.
- Treat a duplicate external WhatsApp message ID as replay, not as a new turn. Replays must not append data twice or trigger a second work-item creation.
- Define deterministic behavior for a new request arriving while another is active: ask whether it continues the existing request or starts a new one when intent is ambiguous; never merge distinct requests solely because they share a sender.

## Turn-processing sequence

1. Validate and normalize the inbound event; persist it through the existing ingest contract. Do not fabricate text for media-only messages.
2. Load/resolve the conversation using the scoped identity and latest event, with locking/idempotency.
3. Run routing against the persisted event and current open-work context.
4. If it is a continuation, merge only fields supported by the new event; retain provenance and distinguish missing from uncertain values.
5. If no work item exists yet, persist pending field candidates in conversation state. If a work item exists, write accepted field updates to `work_data` through a separately validated atomic operation.
6. Recompute required-data completeness from the active workflow. Ask a targeted question when required fields are missing or uncertain.
7. When all required data is complete, resolve policy. No policy/configuration means no write. `confirm` requires a separately persisted, scoped, unexpired confirmation tied to the exact proposal; a Boolean supplied by the caller is not sufficient evidence.
8. Create/link the work item atomically and idempotently, then update conversation state in the same transaction where possible. If a single transaction is not possible, add an explicit recoverable state machine and reconciliation job.
9. Build the customer-facing reply only from verified outcomes; enqueue outbound delivery durably rather than treating an HTTP send attempt as proof of delivery.

## State-transition rules

- `collecting` → `awaiting_confirmation` only when the proposal is complete and policy requires confirmation.
- `collecting` → `authorized` only when required data is complete and effective policy is `auto`.
- `awaiting_confirmation` → `authorized` only after a validated confirmation event matches the current proposal, sender/member, business, expiry, and one-time consumption constraints.
- `authorized` → `completed` only after the work-item write is confirmed or reconciled.
- Any active state may move to `handoff` when policy requires a professional; terminal states must not silently reopen on replay.
- Expiration must not delete source events or work history; it only closes the conversation state.

## Security requirements

- Enable RLS; do not grant direct table access to `anon` or `authenticated` by default.
- Use server-side service-role access only through the trusted backend, or narrowly scoped database functions with pinned `search_path`, explicit authorization checks, and restricted EXECUTE grants.
- Never expose service-role credentials to the browser or pass Meta access tokens to Vercel.
- Keep logs free of message bodies, phone numbers, secrets, and sensitive field values.
- Run Supabase security/performance advisors after migration and inspect function privileges before enabling the path.

## Required tests before staging integration

1. First turn creates one conversation and stores the source event.
2. Follow-up fills a missing field and resumes the same conversation after process restart.
3. Uncertain candidate is confirmed explicitly and never auto-promoted.
4. Duplicate webhook delivery does not duplicate state changes, replies, links, or work items.
5. Two concurrent messages cannot overwrite each other or create duplicate work items.
6. Same sender across two businesses/channels remains isolated.
7. New unrelated request does not merge with the current request.
8. Missing workflow/policy fails closed.
9. Confirmation replay, expiry, wrong sender, and changed proposal are rejected.
10. Expired/terminal conversation behavior is deterministic.
11. Database transaction failure is recoverable and does not claim a write succeeded.
12. Existing ingest/routing/new-work regression suites remain green.

## Release gates

- Create/use a Supabase development branch or isolated test project.
- Implement a migration through the repository's verified migration workflow; do not hand-apply to production.
- Test SQL constraints/functions with synthetic data and no real customer data.
- Add application-level unit tests and staging end-to-end tests.
- Verify logs, RLS, grants, idempotency, concurrency, and recovery.
- Release the API and bot together only after staging checks pass. Keep production branches and services unchanged until explicitly approved.
