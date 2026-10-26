# Recovered Supabase migration registry source — 2026-10-26

These SQL files were reconstructed read-only from the applied Supabase migration registry, table supabase_migrations.schema_migrations, column statements[1], project tkfyfqgtumoeywlqzmdt.

**Important:** this is recovered applied SQL, not proof of the original local file formatting. No SQL in this directory was executed by this recovery operation. Before any replay or DDL, use an isolated database, replay all migrations in order, compare the resulting schema/functions and inspect security-sensitive statements. The live project already records these versions as applied. Do not run them directly against the live project.

The registry reported one stored SQL statement per version and no rollback statements for all 15 records. Hashes are SHA-256 of the exact recovered SQL string encoded as UTF-8.

| Version | Name | File | SQL chars | SHA-256 |
|---|---|---|---:|---|
| 20261001181622 | harden_event_audit_functions_v1 | 20261001181622_harden_event_audit_functions_v1.sql | 245 | b442804f5a6e8e936ce82faacd7e55722cffbeb77237fddd8c714feddd47b623 |
| 20261001181726 | add_recent_active_work_events_reader_v1 | 20261001181726_add_recent_active_work_events_reader_v1.sql | 1824 | b65d8c7d8c3429c746f3f1ed377ba4909bf9aa5108f0ff8ebd0b713e8fcac742 |
| 20261001183109 | add_event_routing_decisions_exactly_once_v1 | 20261001183109_add_event_routing_decisions_exactly_once_v1.sql | 6092 | 144227fc24995f1ae5e8ec7df49a490ce40f7e5518c61978cbf492c97e8d1c15 |
| 20261001190227 | make_event_routing_exactly_once_across_pipeline_versions | 20261001190227_make_event_routing_exactly_once_across_pipeline_versions.sql | 5452 | 1696a9702cf192a47d14c95cb2d7c183d3b878177a54584068ca6e0d6b1116bd |
| 20261001191030 | minimize_match_link_metadata_v1 | 20261001191030_minimize_match_link_metadata_v1.sql | 4701 | 4037ef8ab1193f207a0f26576086584cd02a9f59e6336b2f6d2c7a327ee8bd1d |
| 20261002151750 | owner_command_open_actions_idempotency_v1 | 20261002151750_owner_command_open_actions_idempotency_v1.sql | 213 | 38c39a709fd003110b6ac50bc3ef4e8843d4f5e22464844e5fbba136c88720cb |
| 20261002152028 | owner_command_schedule_commit_v1 | 20261002152028_owner_command_schedule_commit_v1.sql | 8992 | 02118498cf486c28579b3f59399567957306b974ade21b374266cec12864a9e8 |
| 20261002152335 | owner_command_received_dedupe_v1 | 20261002152335_owner_command_received_dedupe_v1.sql | 2515 | ea577d8342697115e816ed2aa9aa7492136c2a4b1fa8a64ec4e7d5a701c9dc99 |
| 20261002153114 | owner_command_note_commit_v1 | 20261002153114_owner_command_note_commit_v1.sql | 5372 | abf036e0290a97639be9ef5224a2702c617c62d2ad186bcb9d07eb5e34fe73ec |
| 20261002153943 | owner_command_confirmation_binding_v1 | 20261002153943_owner_command_confirmation_binding_v1.sql | 16791 | f564740bb6c688e8ba9ef4f8a14ee8432e10fdd40bd166055fa241b4e52aeabc |
| 20261002160140 | owner_command_verified_member_resolver_v1 | 20261002160140_owner_command_verified_member_resolver_v1.sql | 2878 | cd438251ae0ce8adae5a57881135ac38c2c351d8b1292042230fc80802994116 |
| 20261002160225 | owner_command_verified_member_resolver_fix_v1 | 20261002160225_owner_command_verified_member_resolver_fix_v1.sql | 3687 | a441de625d3c8bd3359a44f53e1cb428d4f34e21ad8865942aec943c5aacae67 |
| 20261002165149 | customer_whatsapp_ingest_v1 | 20261002165149_customer_whatsapp_ingest_v1.sql | 5486 | 9c0de794ea8755f58a3093cb0b78914e0420f92f7850352c2885557a3d73d596 |
| 20261003080614 | new_work_write_path_exactly_once_v1 | 20261003080614_new_work_write_path_exactly_once_v1.sql | 10065 | e749874a16c14df1da0619c0484e863dc3f898026b364a5ca0dad649ea6a1208 |
| 20261004213059 | customer_whatsapp_replay_conflict_v1 | 20261004213059_customer_whatsapp_replay_conflict_v1.sql | 6323 | ff17db755c8fbc006e9efcb5483f3e35dc40abcbd7236c8f6bbee5865291a98e |
