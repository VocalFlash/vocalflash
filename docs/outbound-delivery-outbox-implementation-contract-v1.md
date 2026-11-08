# VocalFlash — durable outbound delivery outbox and reconciliation contract v1

**Status:** implementation contract / design only. No SQL migration, runtime path, secret, provider configuration, or database has been changed.  
**Date:** 8 November 2026  
**Parent baseline:** `assistant-conversation-photo-v1` at `737d42184f618ff6abc009df7af241f30d29131a`.  
**Release decision:** NO-GO for claiming durable duplicate-safe WhatsApp delivery until the contract below is implemented and tested in an isolated database and non-production Meta target.

## 1. Why this is a separate contract

The existing bot recovery design documents the external-side-effect boundary: Meta may accept a send while the worker loses the response or fails before recording the result. Redis leases cannot make the Meta HTTP request atomic with a Redis update. A local retry after an ambiguous send can duplicate a reply.

The Assistant API and MultiVocale bot currently have different sources of work and cannot safely be unified by merely adding a retry loop. This contract defines one durable delivery ledger shared by both paths, while preserving distinct source identities and reply purposes.

This design does not promise exactly-once delivery. If Meta accepts a request but the response and callback are both unavailable, the outcome can remain unknowable. The safe result is a durable `outcome_unknown` record and controlled resolution, never a blind resend.

## 2. Non-negotiable invariants

1. Persist one logical delivery intent before any provider send attempt.
2. Enforce a unique idempotency key for the logical reply, scoped to business and channel.
3. Claim an intent atomically; two workers must never own the same current attempt.
4. Persist an attempt record before crossing the network boundary.
5. Treat a positive Meta HTTP response as **provider accepted**, not delivered/read.
6. Classify timeouts, connection resets after request transmission, process death, unreadable responses, and ambiguous server errors as `outcome_unknown`.
7. Never automatically resend `outcome_unknown` unless a documented provider guarantee or authoritative reconciliation establishes that it is safe.
8. Every worker mutation checks the current lease token/fencing generation. A stale worker cannot overwrite a newer claim.
9. Callback ingestion is signature-verified, idempotent, correlated, and monotonic. An old callback cannot regress a newer state.
10. A delivery payload and recipient identifier must not be stored in plaintext without an approved security and retention design.
11. No provider response, callback, or local HTTP success may be represented to a customer as proof of delivery unless the provider status confirms it.
12. A retry prompt must not imply that a reply definitely failed when its delivery outcome is ambiguous.

## 3. Canonical data model proposal

The following is a logical schema, not executable migration SQL. Exact FK targets, column types, indexes, retention and grants must be reconciled against the recovered schema and approved data-protection design before implementation.

### 3.1 `outbound_delivery_intents`

One row per logical reply:

- `id` UUID primary key; this is the opaque `delivery_id`.
- `business_id`, `business_channel_id`: mandatory tenant/channel scope.
- `source_type`: allow-listed value such as `assistant_event`, `multivocale_batch`, `owner_command`.
- `source_id`: opaque source identifier.
- `reply_purpose` and `reply_version`: distinguish the main reply from follow-up prompts and revisions.
- `idempotency_key`: deterministic opaque key; unique within business/channel.
- `recipient_ref`: trusted contact/provider reference, never a raw phone number in logs.
- `payload_ciphertext` or protected payload reference plus `payload_key_version`; never persist clear message body by default.
- `state`: `pending | sending | accepted | delivered | read | failed_definitive | outcome_unknown | cancelled`.
- `attempt_count`, `next_attempt_at`.
- `lease_token`, `lease_expires_at`, `lease_generation`.
- `provider_message_id`, `accepted_at`, `delivered_at`, `read_at`.
- `last_error_class`, `last_provider_error_code` (strict allow-list; no raw response body).
- `created_at`, `updated_at`, `expires_at`, and a retention class.

Constraints:
- Unique `(business_id, business_channel_id, idempotency_key)`.
- Unique provider message identity scoped by provider/channel where provider guarantees uniqueness.
- A check constraint over the canonical states.
- Composite FK constraints must prove that the channel belongs to the same business.
- The idempotency key must be generated from trusted IDs and reply purpose/version, not from message text or a phone number.
- `outcome_unknown`, `accepted`, `delivered`, `read`, and `failed_definitive` are not eligible for ordinary pending-send claims.

### 3.2 `outbound_delivery_attempts`

Append-only attempt evidence:

- opaque attempt ID and FK to delivery intent;
- monotonically increasing attempt number;
- lease generation/token reference;
- started/finished timestamps;
- normalized result: `accepted | definitive_rejection | outcome_unknown`;
- HTTP status and allow-listed provider error code, if safe;
- provider message ID when known.

Do not store request/response bodies, access tokens, full recipient identifiers, or customer content in attempt rows.

### 3.3 `outbound_delivery_callback_receipts`

Minimal idempotent callback ledger:

- opaque receipt ID;
- delivery ID when correlated;
- provider message ID;
- channel/phone-number account reference;
- normalized status and provider timestamp;
- deterministic callback fingerprint;
- signature verification result and received timestamp.

Unique callback fingerprint prevents duplicate application. Do not retain raw callback JSON or recipient phone number. Confirm the exact Meta status callback shape and event identifier semantics for the deployed Graph API version before choosing the fingerprint fields.

## 4. Transactional RPC contract

All state-changing operations are server-side and tenant-scoped. Prefer `SECURITY INVOKER`; if a narrowly scoped `SECURITY DEFINER` function is unavoidable, pin `search_path`, validate every business/channel relationship, revoke default PUBLIC execution, and grant EXECUTE only to `service_role`. Do not expose these tables or RPCs to `anon` or `authenticated`.

Proposed RPC boundaries:

### `vf_enqueue_outbound_delivery_v1(...)`

- Validates business/channel/source scope.
- Inserts the intent and returns the existing row on an idempotency conflict only if the immutable intent identity matches.
- A conflict with different source, purpose, recipient reference, or payload hash returns `IDEMPOTENCY_CONFLICT`; it must not silently reuse a different message.
- Must be called in the same transaction as the business operation where the user-visible response depends on that operation's result.

### `vf_claim_outbound_delivery_v1(p_worker_id, p_lease_seconds)`

- Atomically selects one eligible `pending` row using row locking / `SKIP LOCKED`.
- Increments attempt count and lease generation, creates a fresh unpredictable lease token, marks `sending`, and appends the attempt row before returning the protected payload reference.
- Returns no work when nothing is eligible.
- Does not reclaim an expired `sending` attempt as a fresh send. Expiry transitions it to `outcome_unknown` for reconciliation.

### `vf_record_outbound_delivery_result_v1(...)`

- Requires delivery ID, attempt ID, current lease token and generation.
- Accepts only the current owner of the current attempt.
- Records provider acceptance only with a validated successful response and provider message ID.
- Records definitive rejection only for provider responses whose semantics have been verified as definitive for that API/version.
- Otherwise records `outcome_unknown`.
- A stale token returns `STALE_CLAIM` without mutating state.

### `vf_reconcile_whatsapp_status_v1(...)`

- Called only after webhook signature verification.
- Resolves by provider message ID first and opaque callback data as a correlation aid where supported.
- Inserts the callback receipt idempotently, then applies a monotonic transition.
- If a callback arrives before the HTTP response has been persisted, it may attach to the existing intent; a later HTTP response cannot regress `delivered/read`.
- Unknown IDs are recorded only as bounded sanitized diagnostics, not as newly created outbound work.

### `vf_expire_outbound_delivery_leases_v1(...)`

- Converts expired `sending` attempts to `outcome_unknown`; it does not put them back into `pending`.
- Exposes aged unknown records for controlled reconciliation/manual resolution.
- No automatic resend of unknown records.

## 5. State transition matrix

| From | To | Condition |
|---|---|---|
| pending | sending | successful atomic claim |
| pending | cancelled | cancelled before network attempt |
| sending | accepted | validated provider success + message ID |
| sending | failed_definitive | verified definitive rejection only |
| sending | outcome_unknown | ambiguous send/transport/process/persistence failure |
| accepted | delivered | authenticated delivery callback |
| accepted | read | authenticated read callback, if supported |
| delivered | read | authenticated read callback, if supported |
| outcome_unknown | accepted/delivered/read | authoritative callback/reconciliation evidence |
| outcome_unknown | failed_definitive | authoritative evidence only |
| any terminal state | pending | **forbidden** |

Callbacks may arrive out of order. State application must be monotonic and use provider timestamps plus an explicit transition precedence; a later-arriving older callback cannot regress the state.

## 6. Worker protocol

1. The business operation and outbound intent are committed atomically where possible.
2. A worker claims one intent and persists `sending` plus attempt evidence.
3. The worker resolves the protected recipient and decrypts the payload only immediately before use.
4. It sends once, adding the opaque `delivery_id` as `biz_opaque_callback_data` only after confirming support for the exact Graph API version and message type.
5. It validates the response and persists `accepted` with Meta's message ID.
6. If persistence after provider acceptance fails, it does not resend. It leaves the intent reconcilable and emits only sanitized diagnostics.
7. A timeout or process death after the send boundary becomes `outcome_unknown`.
8. The customer-facing pipeline receives a typed result: `accepted`, `definitive_rejection`, or `outcome_unknown`. It must not collapse these to a boolean.
9. MultiVocale batch completion is decoupled from delivery status. Audio synthesis can be complete while delivery is accepted, unknown, or awaiting callback.

The Redis lease may remain a short-lived worker coordination/cache mechanism, but the database outbox is authoritative. Redis persistence being disabled must not destroy the only record of a pending/ambiguous send.

## 7. Privacy and retention gates

Before creating the schema, decide and document:

- whether message bodies are stored encrypted in the database or in encrypted object storage;
- encryption key ownership, rotation, recovery and access boundaries;
- how the recipient is resolved without copying raw phone numbers into the outbox;
- retention periods for payloads, attempts, callback receipts and sanitized diagnostics;
- deletion behavior when a contact/business requests erasure;
- data residency, DPA, subprocessors and operational access;
- whether message payloads are minimized/redacted before persistence.

Until these decisions exist, do not create a plaintext payload column or store real customer content in the outbox. A delivery ledger without recoverable payload bytes cannot safely resume a pending send, so payload protection is a blocking design decision, not a detail to postpone.

## 8. Test plan and acceptance criteria

### SQL/transaction tests
- Concurrent enqueue with the same key returns one intent.
- Same key with different immutable payload/source returns conflict.
- Two workers racing to claim one intent yield exactly one current lease.
- Expired `sending` lease becomes `outcome_unknown`, never `pending`.
- Stale lease token cannot record a result.
- Callback receipt duplicates are no-ops.
- Callback before HTTP result is correlated; later response cannot regress state.
- Callback status order permutations never regress state.
- Cross-business/channel references are rejected.
- `anon` and `authenticated` cannot read/write tables or execute privileged RPCs.

### Worker tests
- Crash before claim; crash after claim before network; crash after request transmission; provider acceptance then local DB failure.
- Definitive provider rejection vs ambiguous 5xx/timeout classification.
- Restart with pending, sending-expired, accepted, delivered and unknown intents.
- Same logical reply across duplicate inbound webhook events is enqueued once.
- Main reply and follow-up prompt have distinct idempotency keys.
- MultiVocale synthesis success does not imply delivery success.
- Logs contain no payload, access token, raw callback body or full recipient identifier.

### Staging acceptance
- Isolated Supabase schema replay and advisors pass.
- Non-production Meta signed and unsigned webhook tests pass.
- Real test-recipient send is approved and records Meta message ID.
- Signed delivered/read/failed callbacks are correlated and idempotently applied.
- Restart/load/concurrency test evidence is recorded for exact API and bot SHAs.
- No production service or number is used during this stage.

## 9. Dependency order and explicit blockers

1. Reconcile the pre-registry Supabase bootstrap baseline; the 15 recovered incremental migrations are exact copies of the live registry bodies but are not a clean-install baseline.
2. Approve the payload encryption and retention model.
3. Implement and test the outbox schema/RPCs in an isolated database; keep RLS enabled and direct client grants absent.
4. Implement the bot typed send result and durable worker integration.
5. Implement signed Meta status callback parsing and reconciliation for the exact Graph API version.
6. Integrate the Assistant API and MultiVocale producers using deterministic idempotency keys.
7. Run SQL concurrency, worker crash-boundary and staging E2E tests.
8. Only after all evidence passes, request explicit approval for production promotion.

No schema, data, secrets, paid resources, production deployment, WhatsApp/SMS send, or PR merge was performed in this design phase.
