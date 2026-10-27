# VocalFlash — staging end-to-end release runbook v1

**Updated:** 2026-10-23  
**Status:** execution checklist only. No test in this document is claimed as run. No production deployment, live schema change, secret change, or database branch creation is authorized by this document.



- Revisione statica storage: l'azione `health` prima restituiva `storage:true` dopo la sola creazione di una signed-upload URL, senza eseguire upload/download reali. La risposta è stata resa più precisa (`storage_control:true`, `signed_upload_url_creation:true`) nel commit `6b9cb7c8c38f51c4b22baf00f8ccaace05509ccb`. CI GitHub Actions run `40234797459` (`Assistant Customer Pipeline Tests`) ha completato con successo tutti e 5 i job della matrice, inclusi i test mirati. Questo prova la suite automatizzata sul commit, non un round-trip Supabase reale: il gate storage E2E resta aperto.

## Release principle

The JavaScript Assistant API PR and Python/Render bot PR are a single release unit. Keep both PRs Draft until the gates below pass with recorded evidence. A green unit-test workflow or Vercel Preview is necessary but not sufficient.

## Preconditions — do not start a live WhatsApp test until all are true

- [x] Render workspace/service identified from prior chat and verified read-only on 26 October: My Workspace → vocalflash-bot-staging, branch multivocale-runtime-v2. The dedicated Meta test setup was previously used successfully on 4 October; revalidate that the same test app/recipient is still configured before the next live test. Never use the production number.
- [ ] Confirm the Assistant API Preview/staging URL is protected as intended and reachable only by the bot/service credentials.
- [ ] Confirm staging has the matching Meta App Secret, WhatsApp token/phone ID/verify token, Redis URL, Assistant API URL/key, Supabase URL/key, and transcription key configured in the correct secret stores. Never copy secret values into this runbook, issues, logs, or chat.
- [ ] Confirm startup readiness reports each dependency as healthy; do not expose secrets or customer message content in diagnostics.
- [ ] Confirm the staging database is isolated from production and uses synthetic/test data. If no safe development database exists, stop before stateful/write tests; do not use production as a substitute.
- [ ] Confirm the test business has exactly the intended active WhatsApp channel, active workflow catalogue, required-data definitions, explicit creation policy, and authorized test member. Missing configuration must fail closed.
- [ ] Record tested code SHAs, deployment identifiers, timestamps, test message IDs, sanitized outcomes, and provider message IDs. Do not store phone numbers or message bodies in the evidence log.

## Gate A — static and automated checks

- [ ] Site PR CI passes on the current head SHA.
- [ ] Bot PR CI passes on the current head SHA.
- [ ] Vercel Preview for the current site head is Ready.
- [ ] Re-check the cross-repository contract: the API returns assistant_message only under the customer path, and the bot sends only that explicit server-generated field.
- [ ] Re-check PR heads have not changed since the recorded results. Any new commit requires fresh CI and Preview evidence.

## Gate B — webhook authentication and dependency failure

Run only against staging using a harmless synthetic payload.

- [ ] Genuine Meta delivery with a valid signature is accepted and processed once.
- [ ] Missing signature is rejected (expected HTTP 403).
- [ ] Incorrect signature or body changed after signing is rejected (expected HTTP 403).
- [ ] Missing Meta App Secret fails closed (expected HTTP 503); restore the correct staging configuration afterward.
- [ ] Missing/unhealthy Redis fails closed without triggering duplicate processing.
- [ ] An Assistant API outage does not falsely tell the customer that a request was created.
- [ ] Diagnostics contain no credentials, full phone numbers, raw audio, or full customer message bodies.

## Gate C — customer-text assistant, persistence and safety

Use synthetic messages and the staging business only.

- [ ] A simple supported request is routed to the correct active workflow.
- [ ] Missing required fields produce one specific, relevant follow-up question.
- [ ] An uncertain extracted value is explicitly confirmed rather than silently accepted.
- [ ] Unknown/inactive/cross-business workflow, malformed required-data schema, missing policy, ambiguous classification, and multi-workflow classification produce no work-item write.
- [ ] A message that only mentions a vocabulary term does not create intent.
- [ ] Prompt injection in customer text or vocabulary does not change policy or authorize an action.
- [ ] Duplicate delivery of the same external message ID creates no duplicate event/work item/reply.
- [ ] Two concurrent turns from the same sender do not mix fields or create duplicate work.
- [ ] Two unrelated requests from the same sender are not silently merged.
- [ ] An error or ambiguous timeout never results in a claim that a work item was created unless the persisted outcome is verified.
- [ ] Owner commands remain blocked for writes while the runtime returns ATOMIC_CONFIRMATION_NOT_ENABLED. Do not bypass this gate with a caller-supplied boolean or direct production RPC.

**Important:** persistent multi-turn state for the customer Assistant and a durable outbound outbox/reconciliation are not implemented yet. Separately, MultiVocale V2 has a Redis-backed batch-state store and private object storage for audio bytes, but real storage round-trip and controlled Render restart/recovery have NOT RUN. These are separate gates; do not describe the V2 design as tested runtime behavior.

## Gate D — outbound WhatsApp behavior

- [ ] Exactly one reply is attempted for a successfully processed customer text event.
- [ ] The reply accurately reflects the persisted outcome; no “practice opened”, “appointment booked”, or “message delivered” claim without verified evidence.
- [ ] Duplicate webhook delivery does not trigger a second send.
- [ ] A simulated ambiguous send timeout leaves an operational reconciliation case and does not blindly resend.
- [ ] Record the difference between provider acceptance and recipient delivery; do not call them equivalent.

The current Redis marker is an at-most-once guard with a finite TTL, not an exactly-once delivery guarantee. A durable outbox and provider-status reconciliation remain required before reliable commercial launch.

## Gate E — legacy voice and MultiVocale regression

Run independently from the customer-text assistant test, using the dedicated test number.

- [ ] Send one ordinary voice note and confirm the legacy transcription/concise summary path still works.
- [ ] Send two consecutive voice notes within the documented batching window; verify one combined summary includes both audios in order.
- [ ] Verify the manual “Riepiloga più vocali” command/button still works and does not lose the first audio.
- [ ] Replay a duplicate webhook and verify there is no duplicate summary or prompt.
- [ ] Exercise concurrent/late arrivals and a controlled worker restart; record any loss, reordering, duplicate or stuck batch.
- [ ] Confirm ordinary text requests do not get misrouted into MultiVocale and audio messages are not sent through the customer-text path.
- [ ] Confirm the response prioritizes salient facts and action items rather than dumping a full transcript by default.

Do not claim this gate passed based on historical staging results. Record the actual current run.

## Gate F — media-only messages

- [ ] Verify current behavior for image/document-only messages is explicit and safe.
- [ ] Do not fabricate normalized text or weaken the existing non-empty-text ingest contract merely to make media appear supported.
- [ ] Do not claim vision/media intake is complete until metadata, secure media references, consent, retention/deletion, uncertainty handling, and the end-to-end response path are implemented and tested.

## Evidence record

For every case, record case ID, code SHA, staging deployment ID, start/end time, sanitized input category (not raw personal content), expected outcome, observed outcome, event/work-item/reply identifiers where safe, pass/fail, and follow-up issue. Keep secrets and personal data out of the report.

## Rollback / stop conditions

Stop immediately if any of the following occurs:

- a test writes to production or crosses business boundaries;
- a duplicate work item or duplicate reply is created;
- an unauthorized/ambiguous action is written;
- a webhook without a valid signature triggers processing;
- logs expose secrets or unnecessary personal data;
- the legacy voice/MultiVocale path regresses;
- a test result cannot be distinguished from an unverified assumption.

Do not promote either PR independently. After all gates pass, review both PRs together, confirm cost/security/business configuration decisions, obtain explicit release authorization, and deploy to production only through the approved release procedure.


## Snapshot evidenze automatizzate — 24 ottobre 2026

Questa sezione aggiorna il Gate A senza dichiarare concluso lo staging end-to-end.

- [PASS] API Assistant, commit `77fbddfa19d04a7a163e3af1ba6c9ed379abee97`: [GitHub Actions #40114128653](https://github.com/VocalFlash/vocalflash/actions/runs/40114128653), cinque passaggi riusciti; ciascuno 89 test passati, zero fallimenti.
- [PASS] Bot WhatsApp, commit `7ad05b42122c939a5669c2fdceeae604185aec09`: [GitHub Actions #40113909039](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40113909039), cinque passaggi riusciti; ciascuno 35 test.
- [PASS] SMS Hook/Bird, head `ca1d3f46cef0f8fa38a8c534eb70985500481dcc`: [GitHub Actions #40113926527](https://github.com/VocalFlash/vocalflash/actions/runs/40113926527), cinque passaggi riusciti; ciascuno 11 test, zero fallimenti. Un secondo run sullo stesso head ha superato anch'esso cinque passaggi.
- [PASS] Preview Vercel del commit API `77fbddfa19d04a7a163e3af1ba6c9ed379abee97` = `success`; non è produzione.
- [NOT RUN] Webhook Meta reale firmato in staging, configurazione Render/Meta segreti, persistenza multi-turno dopo restart, scrittura titolare atomica, outbox/reconciliation, prova end-to-end customer→API→Supabase→bot e regressione audio su numero test.
- [BLOCKED] Conferma titolare atomica, fonte SQL delle 15 migrazioni, ambiente staging DB isolato non stabilito/approvato.
- Nessun SMS reale, deploy, modifica schema live, credenziale, utente Auth o business member creato.

Il totale dei tre test matrix principali è 675 esecuzioni riuscite (API 445 + bot 175 + SMS 55), zero fallimenti nei run finali verificati. Questo non autorizza a promuovere le PR: mantenere Draft e NO-GO fino al completamento dei gate E2E e delle decisioni di costo/configurazione.

## Gate status refresh — 24 October 2026

**Do not execute or mark the integrated E2E as passed yet.** The automated component suites have five successful passes each (API 89 tests/pass, bot 35/pass, Bird SMS 11/pass), but prerequisites for safe integrated staging remain unverified. Before the five E2E repetitions: recover and reconcile all 15 authoritative migrations; prepare an isolated replayable staging database without adding paid resources absent approval; implement and test atomic confirmation; complete durable conversation state and outbound outbox/reconciliation; verify staging-only Meta credentials and authorized test identity. Then run five independent, traceable E2E attempts with synthetic data and record inbound event, routing, persisted state, outbound attempt and final/ambiguous delivery outcome. Never infer delivery from HTTP acceptance alone. Production release remains NO-GO.


## Addendum — storage scope enforcement implementation (2026-10-25, CI pending)

### Implementato nel branch candidato
- `api/v1/multivocale-storage.js` ora richiede una mappatura server-side `VOCALFLASH_ASSISTANT_API_KEY_SCOPES` in JSON. La chiave della mappatura è il digest Git blob SHA-1 della chiave API effettiva; il valore è uno scope stabile, ad esempio `staging-bot` o `production-bot`. I valori delle API key non vanno inseriti nella mappatura né nella documentazione.
- La mappatura mancante/malformata per una chiave autenticata fallisce chiuso con HTTP 503; credenziali non valide continuano a ricevere HTTP 401.
- Il percorso degli oggetti è stato versionato implicitamente come `tmp/<scope-uuid>/<batch-uuid>/<sha256>.<ext>`. Download e cancellazione rifiutano oggetti appartenenti a un altro scope (HTTP 403) e rifiutano il vecchio formato non scoped (HTTP 400). L'upload firmato usa lo stesso scope server-side.
- Aggiunto `api/v1/multivocale-storage.test.js` con casi per mapping assente, download/cancellazione cross-scope e rifiuto del formato legacy; la suite CI è stata aggiornata per eseguire questi test.

### Stato delle prove e impatto di compatibilità
- I cambiamenti sono stati registrati nel branch `assistant-conversation-photo-v1`; non sono state modificate variabili Vercel/Render e non sono stati letti valori segreti.
- **CI per i nuovi test: in attesa di run verificabile; non dichiarare i test superati finché il run non è visibile e verde.**
- Il nuovo formato non è retrocompatibile con object key già presenti nel formato `tmp/<batch-uuid>/<sha256>.<ext>`. Prima del deploy bisogna drenare le raccolte attive e pianificare una migrazione/bonifica controllata del vecchio stato e degli oggetti; non aggiungere un bypass legacy cross-scope e non cancellare oggetti senza inventario. Nessuna migrazione è stata eseguita.
- Configurare la nuova variabile scope solo dopo aver preparato mapping distinti per staging e produzione e un piano di rollback. Le variabili richieste non risultano associate al branch Preview corrente; nessun cambio env è autorizzato/eseguito.
- Nessun deploy, merge, modifica live, restart Render, invio WhatsApp reale o scrittura DB è stato effettuato. Release **NO-GO** invariato.


### Addendum di verifica — scope duplicati e trigger CI (2026-10-25)
- Rafforzato il fail-closed: se due credenziali hanno lo stesso scope, l'endpoint rifiuta la mappatura. Aggiunto test per questo caso.
- Il workflow dei test ora include il file di regressione storage e un trigger `pull_request` oltre al push sul branch candidato.
- Verifica CI completata: run GitHub Actions `40223697873` (`Assistant Customer Pipeline Tests`) **success**, cinque passaggi della matrice riusciti. In ciascun passaggio sono risultati **103 test passati, 0 fallimenti**; i test storage nuovi sono inclusi (mapping mancante, scope duplicati, download cross-scope, delete cross-scope, rifiuto delle chiavi legacy). Totale: 515 esecuzioni di test riuscite sulla matrice. Run verificato sul commit `1be9c9f8230c51406f5e6835e27da1479b435c26`; i commit successivi interessano soltanto i documenti canonici, quindi il codice testato è invariato.
- Il contratto richiede credenziali distinte per staging e produzione e scope distinti; il mapping usa Git blob SHA-1 della chiave come chiave JSON. La nuova variabile `VOCALFLASH_ASSISTANT_API_KEY_SCOPES` va configurata solo quando saranno autorizzate e pianificate le modifiche env. Nessuna chiave è stata generata, ruotata o cambiata.


## Aggiornamento runbook — 25 ottobre 2026

Prima del test storage end-to-end, leggere il log di readiness solo come `storage_control`: conferma che il bot raggiunge l'endpoint di controllo e che la health action crea una signed-upload URL. Non prova che upload, download o delete funzionino realmente. Il bot commit `0ab11b0fab036f27a2ecebbfd8ab7ba580a71274` contiene questa correzione; verificare CI sul commit prima di procedere. Il test E2E resta un gate separato e va eseguito soltanto in staging autorizzato, con oggetto sintetico e verifica esplicita della cancellazione. Nessun test live è stato eseguito in questo ciclo.

- Gate CI del bot: completato con successo nella run `40235440651` sul commit `0ab11b0fab036f27a2ecebbfd8ab7ba580a71274`. Questo non sostituisce il test staging E2E. La CI API sul più recente commit documentale risultava ancora in corso al controllo; non usare il suo stato come indicatore di storage live.


## Stato CI — aggiornamento finale del ciclo, 25 ottobre 2026

La CI bot run `40235440651` sul commit `0ab11b0fab036f27a2ecebbfd8ab7ba580a71274` è `success`. La CI API run `40235503317` sul commit documentale `2fb250205556ae967195b08197c618464184b624` è `success`, con tutti e cinque i job riusciti. La Preview Vercel associata a quest'ultimo commit è `READY`. Prima di dichiarare il rilascio pronto rimangono obbligatori i test E2E in staging: upload/download/delete reale, restart e recupero, isolamento delle chiavi, controllo env e prova coordinata API-bot-Meta. Nessun deploy produzione o test WhatsApp reale eseguito in questo ciclo.

## Gate di routing aggiunto — 25 ottobre 2026

Prima del rilascio, verificare la CI del branch bot dopo la correzione che impedisce il fallback legacy per audio e comandi MultiVocale non gestiti da V2. Commit codice `d5e75a618d48a17a1f120153213167134bebe52f`; test aggiunti nel commit `ee9127f480746f83cb301822be153ddbfb993244`. Al momento dell'annotazione non è stata confermata una run CI verde per il nuovo head. Se la CI non parte automaticamente, il gate resta aperto: eseguire il workflow appropriato o correggere il trigger, poi verificare i job. Non testare con messaggi WhatsApp reali finché non è autorizzato il test staging controllato.

### Esito CI routing — 25 ottobre 2026

La run bot `40237092071` sul commit `ee9127f480746f83cb301822be153ddbfb993244` è verde; il job `test` è completato senza fallimenti. Questo gate CI è chiuso. Procedere comunque ai test staging solo dopo che l'ambiente e le credenziali saranno verificate e il test live sarà autorizzato; non interpretare il verde CI come prova E2E.

## Aggiornamento verifica — 26 ottobre 2026
- CI Assistant API head PR #3 `77ecff859726656a39d2e7b946cd22f96ed7e3fc`: run `40237237326`, tutti e 5 i job della matrice completati con successo.
- CI bot WhatsApp commit `ee9127f480746f83cb301822be153ddbfb993244`: run `40237092071` completata con successo; il run precedente `40237070328` è stato cancellato e non è l'esito finale.
- Le CI verdi non equivalgono a test live. Restano NON ESEGUITI: round-trip reale Supabase Storage e test cross-scope live, prova di recupero dopo riavvio Render, test webhook Meta con firme reali e flusso combinato WhatsApp end-to-end.
- Storage scoped: pianificare compatibilità/migrazione delle chiavi legacy prima del deploy; il nuovo formato rifiuta le chiavi non scoped. Verificare anche che le variabili Preview siano associate al branch candidato corretto.
- PR #3 (Assistant API) e PR #2 (bot) restano Draft/non unite; nessun merge o deploy di produzione autorizzato. Release NO-GO fino al superamento dei gate live. Nessuna nuova risorsa a pagamento, modifica di secret o operazione distruttiva eseguita.


## Riconvalida read-only — 26 ottobre 2026 (sessione di prosecuzione)

- Supabase project `tkfyfqgtumoeywlqzmdt`: stato `ACTIVE_HEALTHY`; registry migrazioni confermata a 15 record (dal 2026-10-01 al 2026-10-04); nessun branch di sviluppo. Nessuna migrazione applicata e nessun dato modificato.
- Riconfermata la criticità di conferma atomica leggendo le definizioni live delle RPC `vf_commit_owner_note_v1` e `vf_commit_owner_schedule_action_v1`: i percorsi di commit verificano il booleano `p_confirmed` e la proposta, ma non risultano validare e consumare atomicamente il corrispondente evento `owner_command_confirmation`. Il runtime applicativo continua correttamente a fallire chiuso con `ATOMIC_CONFIRMATION_NOT_ENABLED`. Gate di rilascio bloccante, da correggere solo con migrazione SQL autorevole in ambiente isolato.
- Vercel: deployment Preview READY sul branch candidato, head documentale `8f8a225433515209fc19ecbd5404201289c4547b`; Preview del codice API `77ecff859726656a39d2e7b946cd22f96ed7e3fc` anch'essa READY. Sono build Preview, non test E2E né produzione.
- Render: nota superata dalla riconvalida read-only del 26 ottobre 2026. Workspace e servizi sono stati identificati e verificati senza modifiche; il deploy live e i gate di staging sono descritti nell'addendum successivo.
- Nessuna prova reale Supabase Storage, restart Render o Meta/WhatsApp E2E è stata eseguita in questa sessione. Non dichiararle superate. Nessun merge, deploy di produzione, cambio di segreti, scrittura SQL o operazione distruttiva è stata eseguita.


## Riconciliazione ambiente effettivo — 26 ottobre 2026

### Render — configurazione corrente letta in sola lettura
- Workspace: My Workspace (tea-dadhee67bikc73c68s40).
- Servizio staging: vocalflash-bot-staging (srv-db03iaid0e5s739vhj0g), URL https://vocalflash-bot-staging.onrender.com, branch multivocale-runtime-v2, start gunicorn app_customer:app, auto-deploy disabilitato.
- Deploy live corrente: 34c63efb6e0e720e8dc07c10c3c457a5d59ae5b5 del 4 ottobre 2026. Non è il candidato bot ee9127f480746f83cb301822be153ddbfb993244. Nessun deploy è stato avviato.
- Produzione vocalflash-bot è separata su main; non usare per test.

### Vercel — variabili branch-specifiche
- Il filtro per il branch assistant-conversation-photo-v1 non ha restituito variabili dedicate.
- Nell'inventario generale, VOCALFLASH_ASSISTANT_API_KEYS, VF_ASSISTANT_SUPABASE_URL, VF_ASSISTANT_SUPABASE_SECRET_KEY, VF_MULTIVOCALE_STORAGE_BUCKET risultano Preview associati al branch assistant-auth-v1, non al branch candidato.
- VOCALFLASH_ASSISTANT_API_KEY_SCOPES non è comparsa nell'inventario. La storage API attuale richiede questo mapping JSON per hash Git blob SHA-1 della chiave; se assente/malformato restituisce 503 fail-closed. Nessun valore segreto è stato decrittato o cambiato.
- Gate A ambiente: BLOCKED fino a una configurazione branch-specifica verificata, con scope distinti e senza riutilizzare chiavi tra staging e produzione. Preparare la modifica solo dopo approvazione del titolare; non inserire valori segreti in Git o in questo documento.

### CI e Preview correnti
- API PR #3 head a12364b2fa06bf737a839222b6e5931c838d8842: run 40376454322, cinque job success; Preview Vercel READY.
- Bot PR #2 head ee9127f480746f83cb301822be153ddbfb993244: run 40237092071, job test success.
- Questi risultati non chiudono alcun gate E2E.

### Supabase migration provenance
La registry contiene gli stessi 15 record descritti sopra; non esiste un branch di sviluppo. La ricerca dei nomi distintivi delle migrazioni non ha trovato la sequenza SQL autorevole nei risultati accessibili. Non applicare DDL o creare migrazioni sintetiche: recuperare prima la fonte originale, confrontare le definizioni e preparare un replay isolato.

### Gate aggiornati
- [PASS] CI API e bot sui commit sopra indicati.
- [PASS] Preview Vercel sul head API documentale corrente.
- [BLOCKED] Configurazione Vercel branch-specifica per il candidato e mapping storage scope.
- [BLOCKED] Deploy del candidato su staging (nessun deploy avviato; auto-deploy disabilitato).
- [BLOCKED] Conferma atomica, fonte migrazioni, storage round-trip reale, recovery restart, Meta signature live e flusso end-to-end.
- Nessun merge, deploy, modifica env/secret, scrittura Supabase o invio WhatsApp è stato eseguito.


## E2E storico recuperato — 4 ottobre 2026

Le conversazioni precedenti documentano un test riuscito sullo staging allora distribuito: webhook WhatsApp ricevuto, audio 14.684 byte, chiamata VocalFlash API HTTP 200, un credito consumato e risposta WhatsApp HTTP 200. Un test MultiVocale separato ha elaborato due file audio con API HTTP 200. Non sono disponibili message ID o provider message ID, quindi non è possibile ricostruire una traccia completa retroattiva.

**Interpretazione obbligatoria:** il risultato storico non equivale al test del candidato corrente. Il servizio Render staging risulta ancora sul commit 34c63efb6e0e720e8dc07c10c3c457a5d59ae5b5 del 4 ottobre; il bot candidato è ee9127f480746f83cb301822be153ddbfb993244 e include la verifica HMAC della firma webhook e modifiche di routing. Il candidato non è stato distribuito.

La ricerca dei log Render per 23–26 ottobre 2026 ha restituito zero righe e l'ultimo evento deploy disponibile è del 4 ottobre. Registrare questo come assenza di log recenti, non come prova di guasto né di funzionamento.

- [PASS storico, vecchio deploy] Webhook/audio/risposta WhatsApp e MultiVocale due audio.
- [NOT RUN sul candidato corrente] firma Meta HMAC in staging, storage scoped round-trip, restart/recovery e test combinato aggiornato.
- Prima del test aggiornato: configurare branch Preview e scope storage corretti, verificare META_APP_SECRET nello staging e confermare che il destinatario sia il numero di test autorizzato; nessun callback Meta o produzione va modificato.


## Nuovi casi obbligatori per Gate C — replay della conferma titolare

La verifica read-only del 26 ottobre ha individuato che la RPC di registrazione della conferma, quando incontra un conflitto sull'indice (business_channel_id, external_message_id), può restituire CONFIRMATION_EXISTS senza verificare che l'evento esistente abbia lo stesso event_type, business member, proposal_event_id e source event della richiesta.

Aggiungere prima del rilascio:
- [ ] Ripetizione identica di una conferma: risposta di replay senza nuovo effetto.
- [ ] Stesso external message ID ma proposal_event_id diverso: REPLAY_CONFLICT/DENIED, nessuna write.
- [ ] Stesso ID ma membro diverso o event_type diverso: fail-closed, nessuna write.
- [ ] Verifica che CONFIRMATION_EXISTS da sola non autorizzi il commit.
- [ ] Concorrenza e consumo singolo della conferma nella stessa transazione della write.
Questi test sono NOT RUN; la funzione live non è stata modificata.


## Recupero migrazioni Supabase dal registro live — 26 ottobre 2026

Sono stati recuperati in sola lettura i 15 corpi SQL conservati in supabase_migrations.schema_migrations.statements e ricostruiti come file versionati in supabase/migrations. Il manifest registra Git blob SHA-1 e lunghezza dei corpi. Nessun SQL è stato eseguito. La provenienza è ora ricostruita dal registro applicato, ma non ancora validata con replay completo in un database isolato; il gate di riproducibilità resta aperto fino a quel confronto. Non creare branch a pagamento o applicare migrazioni live senza autorizzazione. La conferma titolare resta fail-closed e non è risolta da questo recupero.


## Nota sul gate migrazioni — aggiornamento 26 ottobre 2026

I 15 corpi incrementali registrati sono stati recuperati dal registro Supabase e versionati, con manifest Git blob SHA-1 e controllo automatico di nomi, ordine, lunghezze e checksum in CI. Non sono una baseline autonoma: alcuni riferiscono tabelle/funzioni create prima del primo record. Il Gate di replay resta BLOCKED finché il baseline preesistente non è recuperato e l'intera sequenza non è riprodotta e confrontata in un database isolato. Nessun SQL è stato eseguito in questo recupero.


## Verifica provenienza SQL — esito del confronto diretto

- [PASS] 15/15 file migration confrontati direttamente con statements[1] del registro Supabase live, per versione e nome: corpi esattamente uguali, lunghezze e Git blob SHA-1 coerenti.
- [PASS] CI run 40381380389: validatore migrazioni e suite API focalizzata verdi sul commit ef89c1274fc7d749aa3af10bf9a0413607a21451.
- [BLOCKED] Baseline schema precedente alla prima migrazione e replay completo in ambiente isolato. Non eseguire i file sul progetto live e non considerare questo confronto come prova di clean install.


## Sequenza esecutiva aggiornata — conferma titolare (26 ottobre 2026)

### Gate A — database riproducibile
- [x] Recuperati dal registro live tutti i 15 corpi SQL.
- [x] Confronto diretto: 15/15 corpi identici a statements[1], per versione e nome; validatore CI PASS.
- [ ] Recuperare il baseline pre-2026-10-01 oppure uno snapshot schema completo revisionato.
- [ ] Ricostruire database isolato, applicare in ordine il baseline + 15 migrazioni e confrontare schema, funzioni, indici, grants e trigger.
- [ ] Nessun replay sul progetto live.

### Gate B — contratto di conferma
- [ ] Inventariare definizioni reali di eventi, payload, indici univoci, campi timestamp e grants; identificare tutti i chiamanti JS/API.
- [ ] Specificare la scadenza di proposta/conferma e la regola per timestamp affidabile; non assumere un TTL non definito.
- [ ] Modificare la RPC di registrazione affinché collisione identica = REPLAY_MATCH, collisione con binding differente = REPLAY_CONFLICT/DENIED. Confrontare business, membro, canale, tipo evento, proposta e source event.
- [ ] Introdurre commit atomico: lock di proposta e conferma, verifica esplicita e freschezza, binding completo all'azione/payload, consumo singolo e write nella stessa transazione.
- [ ] Mantenere grants server-only e separare invio WhatsApp via outbox durevole.
- [ ] Mantenere il runtime fail-closed; nessuna rimozione di ATOMIC_CONFIRMATION_NOT_ENABLED in anticipo.

### Gate C — test obbligatori in ambiente isolato
- [ ] Conferma mancante, vaga, modificata o scaduta; proposta scaduta.
- [ ] Business, membro, canale, proposal ID, source event o payload azione non corrispondenti.
- [ ] Replay identico senza nuovo effetto; stesso external message ID con proposta/membro/event type diverso deve fallire chiuso.
- [ ] Due commit concorrenti sulla stessa conferma: al massimo una write.
- [ ] Retry dopo commit senza duplicazione; errore prima/dopo il commit; rollback senza effetti parziali.
- [ ] Verifica privilegi: ruoli anon/authenticated non possono invocare le RPC protette.
- [ ] Tutti i casi negati dimostrano zero side effect; caso valido dimostra un solo effetto.

### Gate D — runtime ed E2E staging
- [ ] Integrare JS runtime e contratto bot/API con esiti non ambigui; test unitari/contratto aggiornati.
- [ ] Rimuovere il blocco di conferma solo dopo PASS del Gate C e uso effettivo della nuova RPC.
- [ ] E2E candidato: Meta webhook con firma valida/non valida → proposta → conferma → singola write → risposta, verificando outbox e retry.
- [ ] PR #3 e #2 coordinate, ancora Draft; nessun merge o produzione impliciti.


## Riscontro schema live aggiuntivo — 26 ottobre 2026, sola lettura

L'inventario delle colonne di public.work_events conferma che la tabella ha occurred_at e created_at, ma non una colonna dedicata expires_at o consumed_at. Le proposte/conferme sono eventi con payload JSONB. Questo non prova che nel payload non esista alcuna convenzione, quindi prima di implementare occorre cercare e validare le convenzioni effettive nei payload e in tutti i chiamanti; non inventare una scadenza o uno stato di consumo. Se il modello attuale non offre una rappresentazione affidabile di scadenza/consumo, la migrazione forward dovrà introdurre un modello esplicito e atomico, provato soltanto nel database isolato. Nessuna scrittura è stata eseguita.


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
