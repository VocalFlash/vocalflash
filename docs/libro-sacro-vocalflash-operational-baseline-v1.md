# VocalFlash — Libro sacro operativo v1

**Data di riferimento:** 2026-10-23  
**Stato:** fonte di verità operativa per roadmap, guardrail, risultati verificati e release gate.  
**Repository:** VocalFlash/vocalflash, branch isolato `assistant-conversation-photo-v1`.  
**Vincolo:** questo documento non autorizza merge, deploy in produzione, acquisti o modifiche di schema.

## 1. Regole inderogabili di collaborazione e rilascio

1. Prima di ogni intervento rileggere questo documento, la roadmap master, le decisioni precedenti, le PR e i test più recenti.
2. Distinguere sempre **implementato**, **testato**, **progettato**, **bloccato** e **non iniziato**. Non attribuire a un test più di ciò che ha effettivamente verificato.
3. Mantenere le PR dell'Assistant API e del bot WhatsApp in Draft fino al superamento dei gate di staging; non rilasciarle separatamente perché il bot dipende dal contratto `assistant_message` dell'API.
4. Nessun merge, deploy in produzione, modifica di Meta reale, segreti, configurazioni Render, billing o risorse a pagamento senza autorizzazione appropriata.
5. Nessuna nuova risorsa Supabase a pagamento o database branch senza prima presentare il costo e ottenere conferma esplicita. La stima precedente non va considerata corrente senza ricalcolo.
6. Non applicare migrazioni allo schema live per aggirare la mancanza di un ambiente di sviluppo sicuro.
7. Non creare identità, numeri WhatsApp o membri aziendali fittizi. Il titolare deve essere collegato a un utente Supabase Auth verificato.
8. Non dichiarare una pratica aperta, un messaggio consegnato o un'azione eseguita senza stato persistito che lo confermi.
9. Non promettere “exactly once” per invii esterni finché il sistema non dispone di outbox persistente e riconciliazione; un timeout può lasciare l'esito sconosciuto.
10. Le voci del vocabolario sono contesto lessicale non attendibile: non possono creare intenti, autorizzare azioni, sostituire una policy o risolvere ambiguità.
11. Nessuna risposta al cliente deve esporre segreti, dati privati non necessari, eccezioni grezze o URL sensibili.
12. Dopo ogni modifica: rileggere lo stato, eseguire i test pertinenti, controllare gli effetti collaterali, aggiornare questo documento e la roadmap.

## 2. Definizione del prodotto

VocalFlash è un assistente WhatsApp “dal vocale all'azione”, non un semplice trascrittore. Deve sintetizzare i punti salienti, riconoscere l'intento, estrarre soltanto informazioni supportate dal messaggio, individuare dati mancanti o incerti, fare domande mirate e preparare una richiesta operativa. La creazione di una pratica è consentita solo se il workflow e la policy la autorizzano e tutte le verifiche sono superate.

La sintesi vocale deve privilegiare informazioni rilevanti e azioni, senza riportare automaticamente l'intera trascrizione. Il percorso legacy audio/MultiVocale va protetto da regressioni.

## 3. Stato tecnico verificato al 23 ottobre 2026

### Assistant API — PR #3
- PR Draft, aperta, non integrata: https://github.com/VocalFlash/vocalflash/pull/3
- Ultimo head verificato dopo seed, test e documentazione: `1b4b4cc34fb09fa90de7978a099a431708a33b1b`. La seed è stata aggiunta con commit `3561c8c3f47208e711c0cdbaf49467ad72b41e60`; i test di policy sono stati aggiunti in `50588712dc6b85b981c61116669d5a55730fc4e5`.
- CI run `39998680330` sul commit `1b4b4cc34fb09fa90de7978a099a431708a33b1b`: **success**; il test step, inclusi i nuovi test della policy, è completato con esito positivo. Preview Vercel sullo stesso commit: **READY**. È una Preview, non produzione, e non costituisce prova end-to-end.
- La pipeline di sviluppo contiene ingest/routing persistenti, classificazione validata, estrazione dei campi obbligatori con evidenza letterale, raccolta dei dati mancanti, risposte cliente deterministiche, policy gate e contesto lessicale circoscritto all'azienda.
- Il piano di raccolta dati e la policy evaluator non creano da soli pratiche; la persistenza è un gate separato.
- Aggiunti test unitari per verificare che `confirm` non autorizzi la creazione automatica, policy assente/modalità sconosciuta falliscano chiuse, `forbidden` prevalga su `auto` e dati mancanti/ incerti impediscano l'autorizzazione. La CI run `39998581789` ha superato il test step.
- La conversazione multi-turno persistente non è implementata.

### Bot WhatsApp — PR #2
- PR Draft, aperta, non integrata: https://github.com/VocalFlash/vocalflash-bot/pull/2
- Head verificato: `8cde5a65fdfda62633eadd5e38e2a10cbdd72808`.
- CI Python sul commit verificato: 32 test superati. Sono unit test; non dimostrano Redis/Meta/Render end-to-end.
- Lease heartbeat e check pre-send sono presenti sul ramo; non rendono atomica una chiamata HTTP esterna con la persistenza Redis.
- Firma webhook HMAC-SHA256 implementata nel ramo di sviluppo, ma non verificata nel servizio Render target.
- L'invio è at-most-once nel percorso protetto, non consegna durevole exactly-once.

### Supabase
- Progetto controllato in sola lettura: `VocalFlash Assistant`, stato `ACTIVE_HEALTHY`.
- Il registro live contiene 15 migrazioni; la sequenza completa dei file SQL autorevoli non è ancora stata riconciliata. È stata estesa la ricerca di sola lettura a tutti i 30 branch restituiti dalle API GitHub nei due repository esaminati: non sono stati trovati file di migrazione versionati o directory `supabase/migrations` in quei tree. L'unico file SQL aggiunto qui è il seed idempotente `scripts/staging/seed-field-service-pilot-v1.sql`, che è un seed di dati staging e non una migrazione. La ricerca non prova l'assenza in repository privati o pipeline esterne; la provenienza delle 15 migrazioni live resta un release gate aperto.
- Gli advisor hanno segnalato 15 tabelle con RLS abilitata ma senza policy e 18 foreign key senza indice di copertura; non dedurre automaticamente che le tabelle siano pubblicamente accessibili. La query di privilegi diretti a `anon` e `authenticated` non ha restituito concessioni dirette sulle tabelle pubbliche.
- Non eliminare indici inutilizzati meccanicamente: il database è piccolo e in gran parte di test.
- Preventivo corrente restituito per una Supabase development branch nell'organizzazione del progetto: **$0.01344/ora**. La creazione è in attesa di conferma esplicita; nessuna branch è stata creata. Non creare la risorsa finché il costo non è approvato.

## 4. Configurazione staging effettuata

È stata eseguita la seed idempotente `scripts/staging/seed-field-service-pilot-v1.sql` esclusivamente sul business sintetico identificato esattamente come `VocalFlash — STAGING TEST`. Nessuna migrazione DDL, nessuna modifica a produzione e nessun nuovo servizio a pagamento.

Verifica successiva alla seed:
- Business: settore `plumbing_maintenance`, etichetta `Idraulica e manutenzione (STAGING)`.
- Workflow `generic_request_test`: disattivato, non cancellato.
- Workflow `maintenance_request`: attivo, versione 1.
- Campi obbligatori attivi:
  1. `problem_description` — problema/sintomo dichiarato;
  2. `service_location` — indirizzo o zona dichiarata;
  3. `availability_window` — giorno/fascia oraria dichiarata.
- Policy `create_work_item`: attiva, scope workflow, modalità `confirm`.
- La policy blocca la creazione automatica e richiede conferma. La configurazione esplicativa JSONB documenta le condizioni, ma il runtime attuale applica direttamente la modalità `autonomy_mode`; non trattare ogni campo descrittivo della configurazione come regola già eseguita dal codice.
- Vocabolario: 14 termini canonici attivi nel solo business di staging. I metadati estesi (sinonimi, definizioni, disambiguazioni ed esempi) sono marcati `draft`; il runtime non deve trattarli come revisione di dominio approvata. Non riutilizzare questi seed generici in produzione.
- I dati sono stati verificati con query di sola lettura dopo l'esecuzione della seed. La seed è stata rieseguita una seconda volta: conteggi invariati (1 workflow attivo, 1 policy di creazione attiva, 14 termini, 0 membri), a conferma dell'idempotenza sul fixture corrente.

### Membro aziendale: bloccato per identità assente
La verifica ha trovato **0 righe in `business_members` e 0 utenti in `auth.users`** nel progetto. Non è quindi possibile collegare in modo corretto il titolare a un'identità verificata. Non creare un membro fittizio, non inserire un UUID inventato e non aggirare Supabase Auth. L'onboarding deve usare l'identità verificata reale; l'eventuale configurazione di provider OTP/SMS a pagamento richiede conferma preventiva del costo.

### Limiti che la seed non risolve
- `ATOMIC_CONFIRMATION_NOT_ENABLED` resta attivo: non abilitare le scritture del titolare finché proposta, identità, scadenza, consumo one-time e write non sono verificati atomicamente.
- La raccolta dei campi è implementata per il messaggio corrente; la continuità fra più turni e dopo il riavvio non è ancora persistente.
- Foto e messaggi media-only non hanno un percorso completo.
- La seed non è un test end-to-end e non prova la qualità del modello sul workflow.

## 5. Gate P0 — da completare prima di qualunque pilota reale

1. **Riconciliare la provenienza delle migrazioni.** Trovare i file autorevoli per tutte le 15 versioni live, confrontare versione/nome/corpo e aggiungere un controllo CI. Nessuna riapplicazione delle migrazioni già presenti.
2. **Conferma atomica del titolare.** Binding a business, canale, membro, proposta/versione, evento sorgente e scadenza; consumo one-time nella stessa transazione della write; test replay/concorrenza/failure-before-and-after-commit. Mantenere il fail-closed fino al completamento.
3. **Stato persistente multi-turno.** Scope per business + canale + contatto, dati raccolti con provenienza, incertezza, workflow/proposta, versione e scadenza; serializzazione concorrente e ripresa dopo restart.
4. **Outbox e riconciliazione WhatsApp.** Registrare l'intento prima dell'invio, tentativi, provider message ID, stati accettato/consegnato/fallito/esito sconosciuto e procedura operativa di riconciliazione. Non retryare ciecamente gli esiti ambigui.
5. **Staging end-to-end.** Webhook Meta firmato → ingest deduplicato → routing persistito → Assistant API → risposta WhatsApp reale → callback di stato e replay. Testare separatamente il percorso audio/MultiVocale legacy.
6. **Identità titolare.** Usare Supabase Auth e un'identità realmente verificata; non creare membership finché non esiste un utente autentico associabile. Ogni costo per provider OTP/SMS o development branch richiede approvazione.
7. **Configurazione pilota.** Ottenere revisione umana del workflow e del vocabolario sintetico; il seed attuale è solo una base di test.
8. **Sicurezza database.** Rivedere RLS, grants, SECURITY DEFINER/search_path, indici FK e advisor findings dopo la riconciliazione delle migrazioni.
9. **Segreto Meta.** Verificare `META_APP_SECRET` nel servizio di staging e provare richieste firmate, senza firma e con firma errata. Non mettere mai il segreto in Git, log o chat.

## 6. Gate P1 — dopo la base sicura

- Implementare intake di foto/documenti, riferimenti media protetti e regole di retention/cancellazione; non fabbricare testo per media-only.
- Eseguire una batteria model-backed multi-settore con falsi positivi/negativi separati, casi ambigui, multi-workflow, negazioni, sinonimi, errori ASR e messaggi avversariali.
- Rivedere e approvare le voci del vocabolario con un responsabile di dominio prima di attivarne i metadati estesi.
- Eseguire regressione MultiVocale su batching, concorrenza, arrivi tardivi, restart e no-double-reply.
- Benchmarkare almeno 50 vocali italiani rappresentativi prima di cambiare provider/modello di trascrizione.

## 7. Gate P2 — account, commerciale e lancio

- Account, verifica contatti, piani, pagamento, rinnovo, cancellazione e controllo entitlement lato server.
- Costi unitari realistici per WhatsApp/Meta, OpenAI, hosting/database, supporto e pagamenti.
- Privacy/GDPR, conservazione/cancellazione, esportazione, subprocessori, trasferimenti, consenso, backup, monitoring, incident response e rollback.
- Verificare idoneità commerciale del piano Vercel prima del lancio.
- WhatsApp Gruppi e VocalFlash Green restano sviluppi futuri; non promettere capacità API non verificate.
- Il questionario ha due risposte soltanto: segnale iniziale, non validazione di mercato o prezzo.

## 8. Criteri GO/NO-GO del pilota

GO solo quando:
- un'attività reale ha approvato workflow, campi, policy, membro, vocabolario e messaggi al cliente;
- ogni campo richiesto è fornito con evidenza o esplicitamente mancante/incerto;
- non ci sono scritture non autorizzate, cross-business leakage o pratiche duplicate nei test di replay/concorrenza;
- la conferma è proposal-bound, non scaduta, one-time e atomica;
- stato conversazione e outbox sono persistenti e recuperabili;
- gli invii ambigui hanno un percorso di riconciliazione e non producono falsi claim;
- webhook firmati passano e richieste non valide falliscono closed nel vero staging;
- entrambe le PR superano CI e la prova combinata staging;
- privacy, retention, migrazioni, sicurezza, rollback e supporto sono revisionati.

Un test unitario verde o una Preview `READY` da soli non soddisfano i criteri GO.

## 9. Sequenza operativa autorevole

1. Mantenere entrambe le PR Draft e il percorso titolare fail-closed.
2. Riconciliare le migrazioni e predisporre un ambiente DB di sviluppo solo dopo approvazione del costo.
3. Completare conferma atomica, stato conversazione e outbox con test specifici.
4. Configurare un membro solo dopo identità Auth verificata.
5. Rivedere workflow e vocabolario con il responsabile del pilota; non promuovere seed sintetici a produzione.
6. Completare staging end-to-end, regressioni audio/MultiVocale e test multi-settore.
7. Solo dopo evidenza di tutti i gate, proporre una decisione separata di rilascio.

Questo documento è il riferimento operativo principale. Se una nota più vecchia contraddice lo stato verificato qui, prevalgono il fatto più recente comprovato e i guardrail di sicurezza sopra elencati.
