# Recovered Supabase migration registry source — 2026-10-26

These SQL files were reconstructed read-only from the applied Supabase migration registry, table supabase_migrations.schema_migrations, column statements[1], project tkfyfqgtumoeywlqzmdt.

**Important:** this is recovered applied SQL, not proof of the original local file formatting. No SQL in this directory was executed by this recovery operation. Before any replay or DDL, use an isolated database, replay all migrations in order, compare the resulting schema/functions and inspect security-sensitive statements. The live project already records these versions as applied. Do not run them directly against the live project.

The registry reported one stored SQL statement per version and no rollback statements for all 15 records. The checksum column contains the Git blob SHA-1 for each exact file content, matching the GitHub Contents API blob ID.

| Version | Name | File | SQL chars | Git blob SHA-1 |
|---|---|---|---:|---|
| 20261001181622 | harden_event_audit_functions_v1 | 20261001181622_harden_event_audit_functions_v1.sql | 245 | adb8c1d6fa362f8cabc9c434116776528a45065c |
| 20261001181726 | add_recent_active_work_events_reader_v1 | 20261001181726_add_recent_active_work_events_reader_v1.sql | 1824 | 27393486e6283f16bb3ca22587bdb65a1de6302d |
| 20261001183109 | add_event_routing_decisions_exactly_once_v1 | 20261001183109_add_event_routing_decisions_exactly_once_v1.sql | 6092 | a6e630fdef5a43ba29eb85b3ac4515e8bb3e3ad6 |
| 20261001190227 | make_event_routing_exactly_once_across_pipeline_versions | 20261001190227_make_event_routing_exactly_once_across_pipeline_versions.sql | 5452 | 70257aab5150ca92336c697d7bfee67a28ffabdd |
| 20261001191030 | minimize_match_link_metadata_v1 | 20261001191030_minimize_match_link_metadata_v1.sql | 4701 | 25ba3bc4510871c2e1996888d9ec591534ecb8ac |
| 20261002151750 | owner_command_open_actions_idempotency_v1 | 20261002151750_owner_command_open_actions_idempotency_v1.sql | 213 | a93288ede1a3cd6bb4ea0df664e28ae1a76ca848 |
| 20261002152028 | owner_command_schedule_commit_v1 | 20261002152028_owner_command_schedule_commit_v1.sql | 8992 | f8c40e951d3b9f82ae82b652cac45a08361a42ba |
| 20261002152335 | owner_command_received_dedupe_v1 | 20261002152335_owner_command_received_dedupe_v1.sql | 2515 | e7b52709f681dbbbeaa81534f9fe3c6b07c297d4 |
| 20261002153114 | owner_command_note_commit_v1 | 20261002153114_owner_command_note_commit_v1.sql | 5372 | 8583106e8599f94c2e392e1b7022fde90445cdd6 |
| 20261002153943 | owner_command_confirmation_binding_v1 | 20261002153943_owner_command_confirmation_binding_v1.sql | 16791 | 56f7f0bf1beae254079a6164353d7a66d5750529 |
| 20261002160140 | owner_command_verified_member_resolver_v1 | 20261002160140_owner_command_verified_member_resolver_v1.sql | 2878 | ee1e8189b9d46b14e541ab6048c877dd9442cf9b |
| 20261002160225 | owner_command_verified_member_resolver_fix_v1 | 20261002160225_owner_command_verified_member_resolver_fix_v1.sql | 3687 | 3bd5366fa14596e24cfc06996d55f5f29f676398 |
| 20261002165149 | customer_whatsapp_ingest_v1 | 20261002165149_customer_whatsapp_ingest_v1.sql | 5486 | 16f8e2a48995533ad0fb1f01db94b563652dc580 |
| 20261003080614 | new_work_write_path_exactly_once_v1 | 20261003080614_new_work_write_path_exactly_once_v1.sql | 10065 | 7cd44ccbf9f68f378eae5482a6de96e1026e8272 |
| 20261004213059 | customer_whatsapp_replay_conflict_v1 | 20261004213059_customer_whatsapp_replay_conflict_v1.sql | 6323 | 3238c17dd7ece312d85a4239a13af14eb0778586 |

## Scope limitation — not a standalone bootstrap baseline

These 15 registry entries are incremental migrations, not the complete initial schema: several statements alter or define functions against public tables and helper objects that pre-date the first registered version. Therefore, these files alone must not be treated as a clean-install baseline or replayed into an empty PostgreSQL instance. A faithful isolated replay requires recovering/constructing and reviewing the pre-2026-10-01 baseline first, then applying these 15 files in order and comparing the resulting schema/functions. This baseline gap remains open.
