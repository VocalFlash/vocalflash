# Owner Confirmation Atomicity Audit v1

**Status:** audit only; no database or runtime behavior changed.  
**Audited:** 2026-10-22  
**Scope:** owner-command runtime in this repository and the live Supabase RPC definitions in project `tkfyfqgtumoeywlqzmdt`.

## Verified current behavior

- `lib/owner-command-runtime-v1.js` returns `ATOMIC_CONFIRMATION_NOT_ENABLED` for an exact confirmation phrase before calling persistence, context loading, interpretation, or execution. Keep this fail-closed behavior.
- `lib/owner-command-confirmation-v1.js` performs exact phrase matching after normalization. Phrase detection is not proof of authorization and does not itself authorize an action.
- The live RPC `vf_record_owner_command_confirmation_v1` verifies that the member is active, the channel is active, and the referenced proposal exists for the same business/member. It records a confirmation event linked to that proposal and source event.
- The live RPCs `vf_commit_owner_note_v1` and `vf_commit_owner_schedule_action_v1` accept `p_confirmed boolean` and `p_proposal_event_id`, but the inspected function definitions do **not** query or validate a corresponding `owner_command_confirmation` event.
- The inspected commit RPCs do not contain expiry or one-time-consumption logic for a confirmation event. They do use transaction-scoped advisory locks and idempotency/conflict handling for their existing write paths.
- The inspected owner-command RPCs are executable by `service_role` and `postgres`; no `anon` or `authenticated` EXECUTE grant appeared in the inspected privilege results.
- GitHub Actions run #87 for the current JS branch head completed successfully, including the focused assistant test job. This does not validate the live SQL write path or a WhatsApp end-to-end flow.

## Release-blocking gap

A boolean supplied by an application caller is not sufficient evidence that the verified owner confirmed the exact pending proposal. Until the database validates and consumes that confirmation atomically with the action, an application path that can supply `p_confirmed = true` could bypass the intended confirmation event binding.

This is a design and integration gap in the inspected RPC contract, not evidence that an external user can directly call these RPCs: the inspected grants restrict execution to `service_role` and `postgres`. The service-side caller still needs a strict contract.

## Required design before enabling confirmations

Implement and review a single transactional database operation (or a transactionally equivalent RPC contract) that:

1. Resolves the business, active member, verified WhatsApp channel, and proposal from trusted identifiers; never trusts model output or caller-supplied role claims.
2. Binds the confirmation event to the same business, member, channel, proposal ID/version, and original source event.
3. Requires a fresh, unexpired proposal and a supported explicit confirmation associated with the exact proposal; vague affirmatives and confirmations that include edits must not pass.
4. Serializes concurrent attempts and consumes the confirmation exactly once in the same transaction as the requested write.
5. Enforces idempotency for repeated webhook deliveries without allowing a replay to apply a second action.
6. Returns distinct, non-ambiguous outcomes for missing, expired, mismatched, already-consumed, replayed, concurrent, and successful confirmations.
7. Does not perform outbound WhatsApp delivery inside the transaction; delivery belongs in a durable outbox with reconciliation.

## Required tests

- Missing proposal, wrong business/member/channel, and unverified sender.
- Missing, vague, edited, expired, or proposal-mismatched confirmation.
- Confirmation replay and repeated webhook delivery.
- Concurrent confirmation attempts against the same proposal.
- Idempotent retry after a committed write.
- Failure before commit versus failure after commit.
- No side effect when validation fails; exactly one effect when valid.
- A staging integration test proving the complete Meta webhook → authenticated routing → proposal → explicit confirmation → database write → customer reply path.

## Current release gates

- Keep `ATOMIC_CONFIRMATION_NOT_ENABLED` in place until the transaction and tests above exist and pass.
- Do not modify live Supabase functions or data as part of this audit.
- Do not deploy to production based only on unit tests or a green Preview.
- Coordinate the JS Assistant API and Python WhatsApp bot releases; the bot PR depends on the companion Assistant API response contract.
- Independently resolve the Meta webhook signature secret/configuration and validate signed/unsigned webhook behavior in staging before deployment.
