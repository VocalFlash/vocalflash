# Owner Confirmation Atomicity Audit v1

**Status:** audit only; no database or runtime behavior changed.  
**Audited:** 2026-10-24 (rechecked)  
**Scope:** owner-command runtime in this repository and the live Supabase RPC definitions in project `tkfyfqgtumoeywlqzmdt`.

## Verified current behavior

- `lib/owner-command-runtime-v1.js` returns `ATOMIC_CONFIRMATION_NOT_ENABLED` for an exact confirmation phrase before calling persistence, context loading, interpretation, or execution. Keep this fail-closed behavior.
- `lib/owner-command-confirmation-v1.js` performs exact phrase matching after normalization. Phrase detection is not proof of authorization and does not itself authorize an action.
- The live RPC `vf_record_owner_command_confirmation_v1` verifies that the member is active, the channel is active, and the referenced proposal exists for the same business/member. It records a confirmation event linked to that proposal and source event.
- The live RPCs `vf_commit_owner_note_v1` and `vf_commit_owner_schedule_action_v1` accept `p_confirmed boolean` and `p_proposal_event_id`, but the inspected function definitions do **not** query or validate a corresponding `owner_command_confirmation` event.
- The inspected commit RPCs do not contain expiry or one-time-consumption logic for a confirmation event. They do use transaction-scoped advisory locks and idempotency/conflict handling for their existing write paths.
- The inspected owner-command RPCs are executable by `service_role` and `postgres`; no `anon` or `authenticated` EXECUTE grant appeared in the inspected privilege results.
- GitHub Actions run [#39824601956](https://github.com/VocalFlash/vocalflash/actions/runs/39824601956) passed for code head `85293847131493cbad6ad6997d4d788aa239e460`; later documentation-only branch commits also passed focused assistant CI, including run [#39825666950](https://github.com/VocalFlash/vocalflash/actions/runs/39825666950) for commit `650af73bcb5cdc2a53f333b8b1b9e68b48ec38f7`. Latest focused CI run [#39828114612](https://github.com/VocalFlash/vocalflash/actions/runs/39828114612) also passed on commit `418c0e7176c972eb6f5e0745a0cdf18d07c24541`. These runs do not validate the live SQL write path or a WhatsApp end-to-end flow.

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


## Recheck 24 October 2026 — release decision unchanged

The live RPC definitions were inspected again. The two commit RPCs still accept `p_confirmed boolean` and a proposal event ID without verifying, locking, expiring, and consuming the corresponding owner-confirmation event in the same transaction as the write. Existing advisory locks and write idempotency do not close that authorization gap.

**Decision: keep `ATOMIC_CONFIRMATION_NOT_ENABLED`.** No SQL was applied and no live write behavior was changed. Do not implement a migration against the live schema or infer the missing table/column semantics from function names. Next implementation must be based on the recovered authoritative migration history and tested against an isolated database. Required tests include wrong business/member/proposal, absent confirmation, expired confirmation, replay/second consumption, concurrent duplicate commit, mismatched action/payload, and transaction rollback on any failed check. Verify grants remain restricted to trusted service execution and prove that invalid confirmation leaves no side effect.


## Recheck addendum — 26 October 2026: replay binding gap

The live definition of vf_record_owner_command_confirmation_v1 was retrieved again. It checks active member/channel and a proposal belonging to the same business/member, then inserts an owner_command_confirmation event containing proposal_event_id and owner_command_source_event_id. However, if INSERT ... ON CONFLICT returns no new row, the fallback lookup selects an existing work_events row using only business_channel_id + external_message_id and returns CONFIRMATION_EXISTS without validating the existing row's event_type, business_id, business_member_id, proposal_event_id, or source event against the current request.

The live unique index work_events_external_message_uidx is unique on (business_channel_id, external_message_id). Therefore a duplicate external message ID associated with a different member/proposal or a different event type can be reported by this RPC as an existing confirmation unless the caller independently verifies the returned event. The RPC must not treat this status alone as authorization.

Required correction in the future isolated, authoritative migration:
- On conflict, fetch the full existing event and compare business, member, channel, event type, proposal ID, and source-event binding; return a distinct REPLAY_MATCH only for an exact match, otherwise REPLAY_CONFLICT/DENIED with no write.
- The atomic commit RPC must lock the proposal and confirmation event, validate the same binding, validate expiry and explicit confirmation, consume the confirmation once, and commit the requested action in the same transaction.
- Add tests for same external ID with identical replay, same ID with different proposal, different member/business, and collision with another event type; assert no unauthorized side effect.
- This finding is read-only. No live SQL or data was changed; do not patch the live function until the authoritative 15-migration source sequence and an isolated replayable database are available.


## Piano di remediation preciso — revisione 26 ottobre 2026, sera

### Fatto e verificato
- Runtime fail-closed verificato in lib/owner-command-runtime-v1.js: ATOMIC_CONFIRMATION_NOT_ENABLED viene restituito prima di qualsiasi chiamata a persistence/context/interpretazione.
- Le definizioni live confermano che la RPC di registrazione verifica membro/canale attivi e proposta dello stesso business/membro, ma il ramo conflitto legge l'evento usando solo canale + external_message_id e restituisce CONFIRMATION_EXISTS senza confronto completo.
- Le RPC di commit note e schedule non provano di validare, bloccare, scadere e consumare la conferma nella stessa transazione della write.
- Tutti i 15 corpi SQL incrementali sono recuperati e confrontati esattamente con il registro live; manca ancora il baseline pre-registro e il replay isolato.

### Remediation da implementare (non ancora eseguita)
1. Baseline: recuperare uno schema iniziale completo o snapshot verificato; replay solo in ambiente isolato e confronto di funzioni, indici, trigger, policy e grants.
2. Specifica: determinare la durata di validità della proposta e della conferma, la fonte timestamp affidabile e il comportamento in caso di timestamp tardivi. Nessun TTL va inventato.
3. Registrazione/replay: rendere la RPC idempotente ma non permissiva. Su conflitto confrontare business ID, member ID, channel ID, event type, proposal_event_id e owner_command_source_event_id; includere gli altri identificatori stabili richiesti dallo schema. Esito REPLAY_MATCH solo per identità completa; altrimenti REPLAY_CONFLICT/DENIED. Non restituire un successo autorizzativo generico.
4. Commit atomico: sostituire il pattern booleano p_confirmed come prova sufficiente. Una RPC transazionale deve risolvere e lockare la proposta e la conferma, verificare stato/freschezza/binding e corrispondenza del payload dell'azione, consumare la conferma una sola volta e scrivere nota/schedule nella stessa transazione. Una seconda azione con la stessa conferma deve fallire senza side effect.
5. Idempotenza e delivery: distinguere il replay della richiesta già committed dal tentativo di riusare la conferma per un'altra azione. La risposta WhatsApp non deve essere inviata dentro la transazione; usare outbox durevole con retry/reconciliation.
6. Privilege review: mantenere EXECUTE solo ai ruoli server previsti; testare che anon/authenticated e un chiamante non autorizzato non possano scrivere o consumare conferme.
7. Test richiesti: conferma/proposta mancanti o scadute; business/membro/canale/proposta/source errati; payload/azione alterati; replay identico; external ID riusato con proposta, membro o tipo evento differente; due richieste concorrenti; retry dopo commit; rollback; zero side effects per ogni diniego e una sola write per il caso valido.
8. Abilitazione runtime: mantenere ATOMIC_CONFIRMATION_NOT_ENABLED fino a quando il nuovo contratto è effettivamente chiamato dal runtime e tutta la matrice SQL/RPC + test di integrazione è PASS. Quindi eseguire E2E staging con Meta firmato, proposta, conferma, write, outbox e risposta.
9. Rilascio: la migrazione forward deve essere versionata e provata in isolamento; nessun DDL live, merge o deploy produzione senza autorizzazione specifica.

### Stato
NO-GO conferma titolare. I punti sopra sono piano operativo, non implementazione completata. Non è stata eseguita alcuna scrittura SQL live.


## Riscontro schema live aggiuntivo — 26 ottobre 2026, sola lettura

L'inventario delle colonne di public.work_events conferma che la tabella ha occurred_at e created_at, ma non una colonna dedicata expires_at o consumed_at. Le proposte/conferme sono eventi con payload JSONB. Questo non prova che nel payload non esista alcuna convenzione, quindi prima di implementare occorre cercare e validare le convenzioni effettive nei payload e in tutti i chiamanti; non inventare una scadenza o uno stato di consumo. Se il modello attuale non offre una rappresentazione affidabile di scadenza/consumo, la migrazione forward dovrà introdurre un modello esplicito e atomico, provato soltanto nel database isolato. Nessuna scrittura è stata eseguita.


## Implementazione isolata v2 — 27 ottobre 2026

È stato aperto il draft PR #10, branch `owner-command-atomic-confirmation-v3`, sopra il branch di lavoro aggiornato. Nessun merge, deploy o SQL live.

### Modifiche nel draft
- Il runtime non registra più una conferma come un normale evento ricevuto: prima risolve una proposta pendente per attività, membro e canale, poi registra la conferma associata e invoca la RPC atomica.
- La proposta richiede un `expires_at` generato dal runtime. La durata non ha un default: se `OWNER_COMMAND_CONFIRMATION_TTL_SECONDS` non è stata verificata nel target, il runtime restituisce `CONFIG_REQUIRED` e non registra una proposta.
- Il file SQL proposto aggiunge un resolver che rifiuta proposte mancanti/ambigue e una RPC che blocca proposta e conferma, verifica binding e scadenza, esegue una sola azione supportata e registra il consumo nello stesso transaction scope. I replay esatti restituiscono il risultato già registrato; i conflitti vengono rifiutati.
- Il SQL è in `docs/proposed-migrations/`, non in `supabase/migrations/`: il manifesto verificato delle 15 migrazioni recuperate resta invariato.

### Gate ancora obbligatori
La CI del draft PR #10 è in coda al momento della registrazione. Il SQL non è stato eseguito su PostgreSQL isolato: non considerarlo validato né pronto per migrazione. Prima di promuovere il file occorre recuperare la baseline storica, testare transazioni/concorrenza/replay/rollback su database isolato e riconciliare la migrazione forward con il registro live. La configurazione della TTL richiede ancora una decisione esplicita; finché non viene impostata il flusso resta fail-closed.


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


## Conclusione verifica migrazione — 27 ottobre 2026

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


## Riesame incrociato progetto e schema live — 27 ottobre 2026

- [PASS] La run CI `40489729525` è completata con successo sul head PR `9dde053f67874a609d29387c5e6b4b1395a4aeb2`: cinque pass Assistant API e il job PostgreSQL transazionale risultano verdi.
- [PASS] Tracciato il collegamento runtime nel repository: `api/v1/assistant.js` costruisce le dipendenze owner e invoca `processOwnerCommandMessage` attraverso `dispatchAssistantWhatsappMessage`. Il flusso è quindi collegato al dispatcher del candidato, ma non è pronto per l'uso finché le nuove RPC non sono distribuite nel database target.
- [PASS read-only] Le tabelle `work_events`, `work_items`, `open_actions`, `appointments`, `business_members` e `business_channels` hanno RLS attivo; la catalog query non ha trovato policy dirette su queste sei tabelle. Le funzioni live ispezionate sono `SECURITY DEFINER`, proprietario `postgres`, con `search_path=public, pg_temp`; le RPC owner-command elencate risultano eseguibili da `service_role`, non da `anon`/ruoli autenticati nell'ACL osservata. Non cambiare questo modello senza revisione.
- [PASS read-only] Confermati l'indice univoco `work_events_external_message_uidx` su canale + external message ID e gli indici univoci per source event su proposta/nota e azione. I trigger osservati sulle tabelle rilevanti sono aggiornamenti `updated_at` su `business_channels`, `business_members`, `open_actions` e `work_items`; nessun trigger non interno è stato rilevato su `work_events`.
- [BLOCKED] Le funzioni `vf_resolve_pending_owner_command_proposal_v2` e `vf_commit_owner_command_confirmation_v2` non sono presenti nel database live; la proposta SQL resta non applicata. Un candidato runtime invocato contro il live prima della distribuzione delle nuove RPC fallirebbe chiuso/errore di persistenza, senza prova di un effetto valido.
- [BLOCKED] I test PostgreSQL passano su schema minimo isolato con corpi delle RPC legacy recuperati, non su copia completa dello schema live; il baseline pre-registry non è ancora disponibile; TTL target non verificato; E2E Meta → Render/Vercel → Assistant API → Supabase non eseguito.

**Decisione:** mantenere Draft e NO-GO rilascio. Nessun DDL o dato live modificato, nessuna migrazione applicata e nessun messaggio WhatsApp inviato durante questo riesame.


## Verifica ambiente Preview Vercel — 27 ottobre 2026, sola lettura

È stato controllato il progetto Vercel `vocalflash` senza decifrare né leggere i valori dei segreti:
- La query filtrata per branch `owner-command-atomic-confirmation-v3` non restituisce variabili branch-specific.
- `VF_ASSISTANT_SUPABASE_URL`, `VF_ASSISTANT_SUPABASE_SECRET_KEY` e `VOCALFLASH_ASSISTANT_API_KEYS` risultano associate a Preview del branch `assistant-auth-v1`, non al branch candidato corrente. La secret Supabase è anche presente come target Development, ma non è una configurazione Preview generale.
- `OWNER_COMMAND_CONFIRMATION_TTL_SECONDS` non compare nell'inventario delle variabili Vercel.
- Esistono variabili generiche `SUPABASE_URL`/`SUPABASE_SECRET_KEY`, ma il codice `api/v1/assistant.js` usa esplicitamente le variabili `VF_ASSISTANT_*`: le generiche non sostituiscono automaticamente quelle attese.

**Conseguenza:** il Preview del branch candidato non è configurato per eseguire correttamente il percorso Assistant DB/owner confirmation. Senza le variabili `VF_ASSISTANT_*` il codice risponde con errore di configurazione DB; senza TTL la creazione della proposta fallisce chiusa. Nessun valore è stato decifrato, nessuna variabile è stata modificata. Prima dell'E2E occorre approvare e configurare esplicitamente lo scope Preview corretto e scegliere un TTL; non riutilizzare automaticamente segreti di un altro branch.
