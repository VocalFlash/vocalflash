# Supabase Migration Provenance Audit v1

**Date:** 2026-10-24 (rechecked)  
**Mode:** read-only inspection. No migration was applied, no database data was changed, and no development branch was created.

## Why this audit exists

The live Supabase migration registry contains 15 migrations for VocalFlash Assistant. During repository/PR review, the SQL source files corresponding to the full live migration sequence were not located in the inspected source paths or either currently open feature PR. This is a source-of-truth/reproducibility concern; it does **not** prove that the files do not exist elsewhere in the repository or in another repository/branch.

## Live migration registry observed

| Version | Migration name |
|---|---|
| 20261001181622 | `harden_event_audit_functions_v1` |
| 20261001181726 | `add_recent_active_work_events_reader_v1` |
| 20261001183109 | `add_event_routing_decisions_exactly_once_v1` |
| 20261001190227 | `make_event_routing_exactly_once_across_pipeline_versions` |
| 20261001191030 | `minimize_match_link_metadata_v1` |
| 20261002151750 | `owner_command_open_actions_idempotency_v1` |
| 20261002152028 | `owner_command_schedule_commit_v1` |
| 20261002152335 | `owner_command_received_dedupe_v1` |
| 20261002153114 | `owner_command_note_commit_v1` |
| 20261002153943 | `owner_command_confirmation_binding_v1` |
| 20261002160140 | `owner_command_verified_member_resolver_v1` |
| 20261002160225 | `owner_command_verified_member_resolver_fix_v1` |
| 20261002165149 | `customer_whatsapp_ingest_v1` |
| 20261003080614 | `new_work_write_path_exactly_once_v1` |
| 20261004213059 | `customer_whatsapp_replay_conflict_v1` |

## Read-only schema facts rechecked

The live public schema contains 15 base tables:
`appointments`, `assistant_policies`, `business_channels`, `business_members`, `business_vocabulary`, `businesses`, `contacts`, `event_routing_decisions`, `open_actions`, `work_data`, `work_event_links`, `work_events`, `work_items`, `work_participants`, and `workflows`.

The live RPC signatures include:
- `vf_commit_owner_note_v1(..., p_confirmed boolean, p_proposal_event_id uuid)`
- `vf_commit_owner_schedule_action_v1(..., p_confirmed boolean, p_proposal_event_id uuid)`
- `vf_record_owner_command_confirmation_v1(..., p_proposal_event_id uuid, ...)`
- `vf_ingest_customer_whatsapp_event_v1(..., p_normalized_text text, ..., p_content_type text, p_payload jsonb)`

The signatures are inventory only, not proof that the intended safety invariants are fully implemented. The separate owner-confirmation audit documents the proposal/confirmation atomicity gap.

## Required reconciliation before release

1. Find the authoritative SQL source for every migration version listed above, including any source maintained in another private/public repository or deployment pipeline.
2. Compare each file's version/name and SQL body with the live migration registry and current function/schema definitions.
3. Identify any live-only, source-only, renamed, reordered, or manually applied changes. Do not assume registry presence proves source parity.
4. Restore a versioned, reviewable, reproducible migration history in the authoritative repository, without reapplying already-live migrations.
5. Add a CI check that detects duplicate versions, missing migration source files, and ordering/version mismatches.
6. Review the owner-confirmation commit functions as a separate safety gate; do not enable the confirmation runtime until proposal binding, expiry, one-time consumption, and the write are atomic and tested.
7. Do not change live schema/data as part of this reconciliation. Any later remediation must be reviewed and tested in a safe development environment first.

## Release decision

**Open release gate.** The live schema is inspectable, but the migration source-of-truth has not yet been reconciled end to end. No claim is made that all 15 migrations are absent from GitHub; only that their complete authoritative source sequence was not established during this audit.


## Recheck 24 October 2026 — provenance still blocks safe DDL

The live migration registry was queried again and returned the same 15 versions listed above. Repository search for the distinctive migration names and RPC names did not recover the authoritative SQL sequence in the inspected repository/organization results. This is not proof that no copy exists elsewhere; it means provenance is still unresolved from the accessible sources.

The live schema inventory again showed the 15 public tables documented above; Supabase reports no deployed Edge Functions. No migration was applied, no database branch was created, and no schema/data was changed.

**Required next step:** recover migration files from the original deployment repository/backup/CI artifact or another verified source, compare each file's version and checksum/DDL with the live schema and migration registry, then reconstruct a clean local/staging replay. Do not synthesize historical migrations or mark the live database as reconciled based only on table names and function signatures. Any new forward migration must be added only after the full baseline can be replayed in isolation.
