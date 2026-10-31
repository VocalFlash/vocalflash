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


## Recupero delle migrazioni applicate dal registro Supabase — 26 ottobre 2026

- Risoluzione parziale della lacuna di provenienza: la tabella live supabase_migrations.schema_migrations conserva il corpo SQL in statements. In sola lettura sono stati recuperati tutti i 15 corpi, ciascuno con una singola voce statements e lunghezze verificate contro l'inventario precedente; il controllo automatico non ha trovato pattern comuni di credenziali.
- I corpi SQL sono stati ricostruiti come file versionati in supabase/migrations usando il testo registrato senza eseguire SQL. Il manifest contiene lunghezza e Git blob SHA-1 di ogni corpo. Le colonne rollback non contengono istruzioni di rollback per queste 15 righe.
- Questo è recupero dal registro delle migrazioni effettivamente applicate, non prova che sia stata recuperata la formattazione del file originale conservato dallo sviluppatore. La riproducibilità resta da dimostrare con replay completo in un database isolato e confronto dello schema/funzioni risultanti; non dichiarare ancora il gate pienamente chiuso.
- Non eseguire questi file sul progetto live: il loro scopo è ricostruire la cronologia versionata e consentire una futura replay controllata. Nessuna migrazione è stata applicata, nessun branch di sviluppo è stato creato e nessun dato/schema è stato modificato.
- Il gate atomico della conferma titolare resta aperto: il recupero della cronologia non risolve i difetti già descritti nell'audit, incluso il replay che non confronta tutti gli identificatori e la mancata validazione/consumazione atomica nella write RPC.


## Scope limitation found during recovery — 26 October 2026

The recovered 15 SQL bodies are the incremental statements recorded by the live migration registry, but they are not a standalone initial schema baseline. Multiple statements alter or reference core public tables/functions that already existed before version 20261001181622. Consequently, the SQL files restore the registered incremental history but do not by themselves enable a clean install/replay from an empty database. The original pre-registry baseline (or a reviewed equivalent reconstructed from a schema snapshot) remains missing. Keep the replayability gate open until that baseline is recovered and the combined sequence is replayed and compared in an isolated environment.


## Exact-body verification — 26 October 2026

The 15 reconstructed files were each compared directly to the matching live supabase_migrations.schema_migrations.statements[1] value, keyed by exact version and name. Result: **15/15 exact matches**, matching lengths and Git blob SHA-1 checksums. CI run 40381380389 passed the recovered-source inventory validator and focused API test matrix on commit ef89c1274fc7d749aa3af10bf9a0413607a21451. The remaining migration gate is not file fidelity: it is the missing pre-registry bootstrap baseline and isolated replay/schema comparison.


## Sequenza corretta per il prossimo lavoro — 26 ottobre 2026, sera

La provenienza dei 15 corpi incrementali è già verificata 15/15 contro il registro live. Non ripetere il recupero. Il gate successivo è il baseline schema anteriore alla prima migrazione registrata: recuperare uno snapshot completo e verificabile oppure la migrazione iniziale autorevole, quindi ricostruire e confrontare tutto esclusivamente in un ambiente isolato. Solo dopo il replay/schema parity si può implementare e testare la migrazione forward della conferma atomica. Nessun DDL live o branch a pagamento è stato autorizzato.


## Aggiornamento 27 ottobre 2026 — conferma titolare v2 isolata

È stato creato il draft PR #10 sul branch `owner-command-atomic-confirmation-v3`. Il runtime ora instrada le conferme esplicite verso un resolver di proposta pendente e una nuova RPC atomica proposta; i test runtime dedicati sono inclusi nel workflow CI. Nessun merge, deploy, modifica a Supabase live o invio WhatsApp.

La scadenza è obbligatoria ma non viene inventata: il runtime richiede `OWNER_COMMAND_CONFIRMATION_TTL_SECONDS` e, se manca, restituisce `CONFIG_REQUIRED` senza creare la proposta. Il SQL rimane in `docs/proposed-migrations/`, fuori dall'inventario delle 15 migrazioni recuperate, per non falsare il controllo di provenienza.

Stato non ancora GO: CI del draft da attendere; SQL non eseguito su PostgreSQL isolato; baseline storica da recuperare; replay/concorrenza/rollback e privilegi da testare su DB isolato; TTL da decidere/configurare prima dell'eventuale staging. `ATOMIC_CONFIRMATION_NOT_ENABLED` resta il fallback se mancano le nuove dipendenze di persistenza.


## Stato finale verificato del draft owner confirmation v2 — 27 ottobre 2026

- Draft PR #10, branch `owner-command-atomic-confirmation-v3`, head applicativo `9550ac57510585a41ff6522062095e416f850f8b`.
- GitHub Actions run #40479095192 sul medesimo head: **success**, tutti e cinque i job/pass completati con successo. Comprende i test runtime aggiunti e i controlli statici del contratto SQL; non è un'esecuzione SQL su PostgreSQL.
- La registrazione di conferma rifiuta ora il riuso conflittuale dell'identificativo esterno confrontando attività, membro, canale, tipo evento, testo, proposta e sorgente. La persistenza verifica anche il testo nel replay.
- Il SQL proposto rimane in `docs/proposed-migrations/`; il manifesto recuperato delle 15 migrazioni non è stato alterato. Nessuna scrittura Supabase live, merge, deploy o invio WhatsApp.
- **NO-GO rilascio:** mancano ancora baseline storica autorevole, test transazionali/concorrenza/rollback su PostgreSQL isolato e staging E2E. `OWNER_COMMAND_CONFIRMATION_TTL_SECONDS` non è stata verificata nel target e non ha un default nel codice: il runtime fallisce chiuso senza proposta finché la durata non viene decisa e configurata esplicitamente.


## Risultato PostgreSQL isolato — 27 ottobre 2026

Il commit applicativo `fb181f162ee3fa3351f45761fc397d53b9dc120d` ha superato GitHub Actions run #40480060789: **tutti i cinque pass JavaScript e il job PostgreSQL isolato sono verdi**.

Il job PostgreSQL ha caricato il SQL proposto su PostgreSQL 16 effimero, prima con mock e poi con i corpi legacy recuperati, e ha superato: commit nota, commit azione pianificata, replay identico, replay conflittuale, conferma scaduta, rollback dopo errore simulato, consumo monouso sotto due commit concorrenti e controllo privilegi `service_role`/ `anon`.

**Limite del test:** il job usa uno schema minimo e mock delle due RPC di scrittura preesistenti; prova la sintassi e l'atomicità del wrapper proposto, ma non sostituisce l'esecuzione contro lo schema completo e le policy reali di VocalFlash. Nessuna migrazione è stata applicata a Supabase live. Il SQL resta in `docs/proposed-migrations/` finché baseline storica e provenienza non saranno risolte.

Il gate di rilascio resta NO-GO: baseline storica non recuperata; integrazione con lo schema completo da verificare; staging E2E WhatsApp da eseguire; valore di `OWNER_COMMAND_CONFIRMATION_TTL_SECONDS` non verificato nel target e senza default nel codice. Se la variabile manca, il runtime non crea la proposta.


## Estensione del test PostgreSQL con le RPC legacy recuperate — 27 ottobre 2026

Ulteriore CI verde: run #40480990100 sul commit `bb7c3b3dc99d41bea640adcb1bfb34368ca98d6f`, con tutti i cinque pass JavaScript e il job PostgreSQL completati con successo.

Il job ora esegue due profili isolati: (1) schema minimo con RPC di scrittura simulate per verificare la transazione del wrapper; (2) database separato con i corpi delle RPC legacy `vf_commit_owner_note_v1` e `vf_commit_owner_schedule_action_v1` recuperati dalla migrazione sorgente, con policy, permessi, tabella note/azioni e trigger di test. Anche nel secondo profilo passano nota, azione pianificata, replay identico e conflittuale, scadenza, rollback e due commit concorrenti con una sola azione.

Questo è un controllo più forte, ma non è ancora una copia integrale dello schema live né un E2E su Supabase/WhatsApp. Il SQL proposto resta fuori da `supabase/migrations/`; nessuna modifica live, merge o deploy.


## Distinzione tra migrazione strutturale e rilascio funzioni SQL — 27 ottobre 2026

### Risultato verificato
- Il file proposto `docs/proposed-migrations/20261027090000_owner_command_atomic_confirmation_v2.sql` contiene soltanto tre `CREATE OR REPLACE FUNCTION` e i relativi `REVOKE`/`GRANT` per i ruoli; non contiene `CREATE/ALTER TABLE`, nuove colonne, indici, trigger o nuove tabelle.
- Quindi, con il disegno attuale, **non emerge la necessità di una migrazione strutturale dello schema**: i metadati di scadenza/consumo sono conservati nel `payload` JSONB già presente in `public.work_events`.
- Questo non significa che si possa abilitare la conferma senza alcun rilascio SQL. Le RPC live attuali non verificano e consumano la conferma nella stessa transazione dell'effetto; per attivare il flusso in sicurezza è necessario distribuire una modifica versionata delle funzioni DB (oppure un contratto SQL equivalente verificato). Eseguire SQL manuale fuori versione non è la strada raccomandata.
- Le funzioni esistenti e gli indici live sono stati ispezionati in sola lettura. La proposta resta fuori da `supabase/migrations/`; nessuna scrittura Supabase live è stata eseguita.

### Decisione operativa
- Non aggiungere tabelle/colonne e non applicare la proposta al live in questa fase.
- Valutare il rilascio come **migrazione SQL function-only**, non come migrazione strutturale, mantenendo la versione e i test tracciabili.
- Prima di promuoverla, verificare compatibilità con schema/policy/grants completi, provenienza del registro, chiamanti e rollback; configurare esplicitamente `OWNER_COMMAND_CONFIRMATION_TTL_SECONDS`; completare staging E2E.
- Fino al completamento dei gate, mantenere `ATOMIC_CONFIRMATION_NOT_ENABLED` e lo stato **NO-GO**. Nessun merge, deploy o SQL live autorizzato da questa nota.


## Riesame live di funzioni, RLS, indici e CI — 27 ottobre 2026

- CI run #40489729525: success sul head PR `9dde053f67874a609d29387c5e6b4b1395a4aeb2`, inclusi cinque pass API e contratto PostgreSQL isolato.
- Le nuove RPC `vf_resolve_pending_owner_command_proposal_v2` e `vf_commit_owner_command_confirmation_v2` non risultano installate nel live; SQL proposto ancora fuori da `supabase/migrations/`.
- RLS attivo sulle sei tabelle operative esaminate; nessuna policy diretta trovata nella query di catalogo. Le RPC owner-command live osservate sono `SECURITY DEFINER`, proprietario postgres, `search_path=public, pg_temp`, ACL `service_role`. Indici univoci esistenti confermati per deduplica dei messaggi e idempotenza per source event. Trigger non interni su `work_events`: nessuno; trigger `updated_at` presenti su canali, membri, azioni e pratiche.
- Queste verifiche sono read-only e non sostituiscono una prova su schema completo: il baseline anteriore alla prima migrazione registrata e il replay integrale restano aperti. TTL target non verificato e staging E2E non eseguito.

**Esito:** nessuna migrazione strutturale appare necessaria per il design corrente; resta necessario un rilascio SQL function-only versionato, subordinato ai gate elencati. Nessuna modifica al live.


## Esito aggiornato di provenienza e compatibilità — 27 ottobre 2026

Le 15 migrazioni risultano registrate nel database live. Non è stato recuperato il baseline storico precedente alla prima migrazione; non dichiarare la catena completamente riproducibile finché non si ricostruisce e si esegue il replay integrale su database isolato. Il file proposto resta function-only (tre funzioni e ACL), non è una migrazione strutturale e non è applicato.

La query read-only conferma RLS abilitato ma non forzato e zero policy dirette su `work_events`, `work_items`, `open_actions`, `appointments`, `business_members`, `business_channels`. Le RPC legacy ispezionate sono `SECURITY DEFINER`, owner postgres, `search_path=public, pg_temp`, privilegio EXECUTE osservato. Indici univoci per deduplica e source-event presenti; nessun trigger non interno su `work_events`. La verifica su schema completo deve provare i controlli espliciti di business/member/channel e gli ACL, non affidarsi alla sola RLS.

CI #40493167613 ha passato il contratto PostgreSQL isolato e i cinque pass API sul pre-audit head `06c616e40f4aedc47b76eb19eb8678b17fa9cfc3`. Restano aperti schema parity, baseline/replay, TTL e staging E2E; nessuna migrazione live applicata.


## Refresh advisor Supabase — 27 ottobre 2026, 11:17 UTC

- Advisor Security: `rls_enabled_no_policy` = **15 tabelle** (livello INFO), tutte con RLS attivo ma senza policy; nessuna policy è stata aggiunta. Va documentato e testato il modello di accesso server-only, specialmente per le RPC `SECURITY DEFINER`.
- Advisor Performance: **18 foreign key senza indice di copertura** e **26 indici segnalati inutilizzati** (livello INFO). Non aggiungere o rimuovere indici in massa: confrontare ogni FK con gli indici composti esistenti, i piani di query e il carico previsto, poi validare su ambiente isolato.
- L'elenco dei branch Supabase è vuoto: nessun ambiente di sviluppo isolato esistente. Non crearne uno senza nuova quotazione e approvazione esplicita del costo.
- Le osservazioni sono consultive; nessun DDL, indice, policy o dato è stato modificato.
