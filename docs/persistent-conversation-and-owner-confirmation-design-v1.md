# VocalFlash — Persistent conversation, concurrency and atomic confirmation design v1

**Status:** design and audit record; not a schema migration and not runtime-enabled.  
**Reviewed:** 24 October 2026  
**Release gate:** NO-GO for enabling owner-authorized writes until atomic confirmation and persistent state are implemented and tested.

## 1. Scope and non-goals

This design covers multi-turn intake, recovery after process restart, concurrent inbound events, and confirmation of a proposed business write. It complements the MultiVocale outbound delivery recovery design in `VocalFlash/vocalflash-bot`.

It does not authorize schema changes, data backfills, production deployment, or paid infrastructure. Existing migration provenance is unresolved; do not invent migration files or apply a reconstructed schema.

## 2. Identity and context boundaries

A conversation state must be scoped by stable trusted identifiers, at minimum:
- business/tenant ID;
- channel/provider account ID;
- provider conversation or customer reference;
- workflow instance ID;
- state version.

Phone number and customer text are not suitable as sole authorization identifiers. Tenant/business scope must be validated on every read and write. A term from vocabulary or an LLM-extracted field is never a source of tenant identity.

Conversation state should distinguish:
- current active workflow;
- collected fields and provenance per field;
- missing fields;
- candidate values requiring clarification/confirmation;
- workflow/policy version used for the current plan;
- pending owner confirmation, if any;
- timestamps, expiry and retention class.

Each extracted field should retain provenance: source message/media ID, extraction time, confidence/uncertainty where available, and whether the value was explicitly stated, normalized, or proposed. Never silently promote an inferred value to a confirmed fact.

## 3. Multi-turn state machine

Suggested conceptual states:
- `collecting`: required information is incomplete;
- `needs_clarification`: one or more candidate values are ambiguous;
- `ready_for_owner_review`: requirements are satisfied and policy evaluation permits presenting a proposal;
- `awaiting_owner_confirmation`: an immutable proposal/version has been shown to the authorized owner;
- `confirmed`: the owner explicitly confirmed that exact proposal/version;
- `committing`: a worker atomically claimed the confirmed write;
- `committed`: the write result is durably verified;
- `commit_outcome_unknown`: a write may have succeeded but the result cannot be established;
- `cancelled` or `expired`.

A new inbound message may update the draft state, but if it changes a field relevant to a pending proposal it must invalidate the prior confirmation. Reconfirmation is required for the new proposal. An old confirmation must never authorize a newer state version.

## 4. Atomic owner confirmation contract

Before a write:
1. Persist an immutable proposal containing business ID, workflow instance ID, operation/policy identifier, normalized field values, source provenance references, policy version and proposal version/hash.
2. Authenticate and authorize the owner against the exact business and permitted role.
3. Accept confirmation only for the exact proposal ID/version/hash, with a short expiry and a one-time nonce or equivalent replay protection.
4. In one database transaction or equivalent atomic compare-and-set, verify the proposal is still pending, unexpired, unchanged, authorized, and not previously consumed; consume confirmation and create a durable write command/idempotency key.
5. Enforce uniqueness on the logical operation so simultaneous callbacks, retries, double clicks or two workers cannot create the same work item twice.
6. Verify the persisted result before replying that the practice was created.

If the storage layer cannot atomically consume confirmation and create the durable command, do not enable the write path. Never emulate atomicity with a sequence of unguarded HTTP calls.

## 5. Concurrency, leases and fencing

- Serialize state transitions per workflow instance using optimistic version checks/compare-and-set or a transactional row lock where supported.
- Use leases for work claiming, with a monotonically increasing fencing token or attempt generation.
- Every local mutation by a worker must verify that it still owns the current lease/version.
- Lease expiry permits another worker to recover local processing but does not prove an external side effect did not happen.
- Avoid holding a database transaction open during an LLM or provider network call.
- Where duplicate inbound provider events are possible, persist a unique inbound event identifier and make processing idempotent.

## 6. Restart recovery

On process startup or worker recovery:
- scan only durable eligible states;
- reclaim expired leases atomically;
- resume safe local work from persisted input and output checkpoints;
- do not re-run expensive or external actions merely because the process restarted;
- preserve the same logical idempotency key across retries;
- classify uncertain external outcomes as `outcome_unknown` and reconcile before any retry;
- use bounded retries only for failures known to be safe and transient;
- retain a minimal append-only audit trail without storing secrets or unnecessary message/media content.

In-memory maps may be caches but cannot be the authoritative state for active workflows or delivery. Cache loss must not lose the only copy of a conversation or the status of a sent message.

## 7. Durable WhatsApp outbox integration

For each logical response, persist a unique delivery intent before sending. A worker claims it, records an attempt, sends to Meta, and stores the returned provider message ID and response metadata. Signed Meta status callbacks must be correlated and idempotently applied.

Canonical delivery states should distinguish `pending`, `sending`, `accepted`, `delivered`, optional `read`, `failed_definitive`, `outcome_unknown`, and `cancelled`. Callback ordering must not regress state. A Meta HTTP acceptance is not proof of delivery.

If the send succeeds at Meta but the process crashes before local persistence, no local lock can make that side effect atomic. Do not promise exactly-once. Do not automatically resend `outcome_unknown` unless documented provider idempotency or authoritative reconciliation establishes safety. Never send a contradictory “please retry” prompt when the original answer may already have been sent.

## 8. Privacy and observability

- Do not log OTPs, access tokens, webhook secrets, full phone numbers, full customer content, media URLs or raw provider payloads.
- Use opaque IDs and sanitized error classes for diagnostics.
- Define retention and deletion for conversation state, message payloads, media references, attempt history and callback receipts before production.
- Restrict read access and enforce tenant scope at the data layer, not just in prompts.
- Monitor stale leases, pending/unknown deliveries, repeated retries, callback lag and confirmation conflicts without exposing content.

## 9. Required tests before enabling writes

Minimum automated cases:
- two concurrent inbound messages update the same workflow;
- duplicate inbound event is processed once;
- owner confirms proposal while a customer update changes a required field;
- replay/double-click confirms the same proposal twice;
- wrong tenant or non-owner tries to confirm;
- expired or superseded proposal confirmation;
- crash before and after command persistence;
- worker lease expires and stale worker tries to write;
- write response times out after possible commit;
- outbound Meta accepts but local state persistence fails;
- callback is duplicated or arrives out of order;
- restart recovers safe work but does not resend unknown delivery blindly;
- malformed or missing required data blocks the write.

Tests must run against the exact candidate commit and, before release, be supplemented by isolated staging evidence. None of these tests is claimed to have passed merely because this design exists.

## 10. Current implementation status

- Existing bot delivery recovery design already documents the Meta accepted-send / Redis state-update gap, missing status-callback reconciliation, and the need for `outcome_unknown` without blind resend.
- The current Assistant branch has fail-closed validation and a bounded read-only readiness probe, but the complete persistent multi-turn state machine and atomic owner-confirmation transaction are not yet established as implemented end-to-end.
- No schema migration was created or applied for this design.
- No production database, secrets, environment settings, paid resource or deployment was changed.
