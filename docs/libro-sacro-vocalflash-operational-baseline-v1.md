# VocalFlash — Libro sacro operativo v1

**Data di riferimento:** 2026-10-24  
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
- Ultimo head del codice applicativo verificato: `9bbb304e9ddd15bd80e2fe7cbf803286e7637cf0`. CI run `39999067164`: **success**; Vercel Preview associata a questo head: **READY**. È una Preview, non produzione, e non costituisce prova end-to-end.
- Successivamente sono stati aggiunti commit documentali sulla stessa branch per il registro delle decisioni e il catalogo terminologico draft. Tali commit non modificano il codice applicativo; non considerarli una nuova prova di test runtime. La Preview verde verificata riguarda l'head applicativo indicato sopra.
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
La verifica ha trovato **0 righe in `business_members` e 0 utenti in `auth.users`** nel progetto. Non è quindi possibile collegare in modo corretto il titolare a un'identità verificata. Non creare un membro fittizio, non inserire un UUID inventato e non aggirare Supabase Auth. L'onboarding deve usare l'identità verificata reale; l'eventuale configurazione di provider OTP/SMS a pagamento richiede conferma preventiva del costo. La pagina ufficiale Bird per SMS verso l'Italia mostra **$0.065 per segmento** per i tipi mittente elencati, con possibili costi separati di carrier/registrazione e necessità di verificare mittente e condizioni dell'account: [tariffe SMS Bird Italia](https://bird.com/sms-api/pricing/it). È un prezzo unitario pubblicato, non un costo mensile totale né un preventivo completo. Nessun account o servizio è stato configurato.

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

## 10. Decisioni e interventi richiesti al titolare

Questa sezione separa le decisioni che richiedono autorizzazione o dati del titolare dalle attività tecniche che possono proseguire senza costi o impatti esterni. Aggiornare questo elenco dopo ogni decisione e ogni verifica; non considerare un elemento approvato in assenza di una risposta esplicita.

### D1 — Supabase development branch (approvazione di costo)
- **Stato:** BLOCCATO in attesa di approvazione.
- **Preventivo ricalcolato in sola lettura il 23/10/2026:** $0.01344/ora; circa $9.68 per 720 ore (30 giorni) oppure $9.81 per 730 ore, prima di altri possibili consumi. Ricontrollare subito prima della creazione.
- **Cosa serve:** autorizzare la creazione della branch di sviluppo. Non verrà creata prima della conferma.
- **Link:** [Supabase Dashboard — progetto VocalFlash Assistant](https://supabase.com/dashboard/project/tkfyfqgtumoeywlqzmdt).
- **Risposta attesa:** “Supabase branch: sì” oppure “Supabase branch: no”.

### D2 — SMS per verifica del titolare (approvazione di costo + accesso account)
- **Stato:** BLOCCATO; nessun account, mittente, metodo di pagamento o hook SMS è stato configurato.
- **Implementazione prevista:** Supabase Auth con Bird **Send SMS Hook**, non Bird Verify, come già deciso nel progetto. Prima si verifica il percorso di integrazione e il costo totale dell'account; poi si collega un vero utente Auth e soltanto allora si crea la membership.
- **Tariffa pubblicata consultata il 23/10/2026:** Bird indica $0.065 per segmento SMS verso l'Italia per i tipi di mittente elencati. Segmenti aggiuntivi, carrier, registrazione/mittente, tasse o altre condizioni possono aumentare il totale; non è una stima mensile completa.
- **Link:** [Prezzi SMS Bird Italia](https://bird.com/en-es/products/sms/pricing/it) · [Prezzi Bird Italia](https://bird.com/it-it/prezzi) · [Documentazione Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks).
- **Cosa serve:** approvare l'uso del provider a consumo dopo aver verificato mittente, eventuali costi accessori e limiti. Non basta approvare il prezzo per messaggio per autorizzare spese fisse o servizi diversi.
- **Risposta attesa:** “SMS Bird: sì, entro il solo consumo SMS pubblicato” oppure “SMS Bird: no”. Se il provider richiede un costo fisso o un impegno ulteriore, fermarsi e chiedere una nuova approvazione.

### D3 — Metodi di pagamento e abbonamenti
- **Stato:** DECISIONE DI PRODOTTO APERTA; nessun account Stripe, piano, prezzo o pagamento è stato configurato.
- **Proposta tecnica da valutare:** Stripe Checkout + Stripe Billing; carte di credito/debito e wallet supportati (Apple Pay/Google Pay quando eleggibili). Valutare SEPA Direct Debit per gli abbonamenti solo se il titolare lo desidera; non attivare metodi aggiuntivi automaticamente.
- **Costi pubblicati consultati il 23/10/2026:** Stripe indica per carte standard EEA 1,5% + €0,25 per transazione; Stripe Billing indica 0,7% del volume Billing, con condizioni e possibili eccezioni da verificare. I metodi locali hanno tariffe diverse.
- **Link:** [Prezzi Stripe Italia](https://stripe.com/en-it/pricing) · [Metodi di pagamento in Italia](https://support.stripe.com/questions/stripe-in-italy?locale=it-IT) · [Stripe Billing](https://stripe.com/billing).
- **Decisioni richieste prima dell'implementazione:** (a) carte + wallet soltanto oppure anche SEPA Direct Debit; (b) piani e prezzi; (c) prova gratuita sì/no e durata; (d) rinnovo mensile/annuale; (e) regole per mancato pagamento, sospensione, cancellazione e rimborso. Prima di eseguire operazioni live serviranno inoltre titolarità/account Stripe, dati fiscali e approvazione esplicita dei costi.
- **Risposta attesa per ora:** confermare i metodi desiderati; non è ancora un'autorizzazione a creare/configurare l'account o attivare pagamenti live.

### D4 — Membro aziendale reale
- **Stato:** BLOCCATO da identità assente: ultimo controllo ha rilevato 0 utenti Auth e 0 membership.
- **Cosa serve al titolare:** completare la verifica del proprio account attraverso il flusso Auth approvato; non inviare password, codici OTP o segreti in chat. Una volta presente l'identità verificata, la membership potrà essere associata al business corretto.
- **Link:** [Supabase Auth — utenti e autenticazione](https://supabase.com/docs/guides/auth).
- **Nota:** non creare identità placeholder né assegnare UUID manuali.

### D5 — Revisione del dizionario professionale
- **Avanzamento documentale del 23/10/2026:** creato [catalogo professionale draft v1](https://github.com/VocalFlash/vocalflash/blob/assistant-conversation-photo-v1/docs/professional-terminology-catalog-v1-draft.json) con **699 voci candidate** distribuite nei settori iniziali: idraulica/manutenzione, edilizia/cantiere, immobiliare, mediazione finanziaria, legale, medico e generico. Sono voci in stato `draft`, non un dizionario pronto per la produzione: 100 voci hanno ora un primo arricchimento redazionale (sinonimi, definizioni, disambiguazioni ed esempi), ma tutte le voci arricchite restano da revisionare con esperti di dominio. Le restanti voci sono ancora indici da arricchire. Non importare automaticamente queste voci nel database né abilitarle nel runtime.
- **Stato:** DA COSTRUIRE E VALIDARE; al momento ci sono 14 termini sintetici attivi nel solo fixture staging, con metadati estesi in stato draft.
- **Obiettivo minimo di prodotto:** catalogo iniziale di **almeno 300 voci professionali curate**, suddivise per settore e per azienda, non 300 sinonimi duplicati. La prima tranche deve coprire idraulica/manutenzione, edilizia/cantiere, immobiliare, mediazione finanziaria, legale, medico e linguaggio generico. Il settore farmaceutico resta escluso dal catalogo iniziale.
- **Qualità minima per ogni voce, ove applicabile:** termine canonico, forma normalizzata, sinonimi/varianti regionali, settore e categoria, definizione breve, contesto d'uso, termini confondibili, esempi positivi e controesempi, fonte/nota di revisione e stato draft/reviewed/active.
- **Regola di sicurezza:** le voci non possono creare intenti, compilare campi obbligatori senza evidenza, scegliere workflow, diagnosticare o autorizzare azioni. Le voci non revisionate restano draft e non vengono promosse a produzione.
- **Cosa serve al titolare:** nessun intervento immediato per redigere la bozza; prima dell'attivazione per un pilota, un responsabile reale di dominio deve revisionare i termini del proprio settore. Il lavoro tecnico di redazione e test prosegue senza costi esterni.

### D6 — Approvazione del pilota reale
- **Stato:** BLOCCATO prima di qualsiasi uso operativo con clienti reali.
- **Direzione già prevista:** primo esperimento con 3–5 potenziali clienti, senza implementare subito una gestione multi-azienda completa; mantenere distinti e misurabili i consumi dei canali VocalFlash WhatsApp e VocalFlash API.
- **Cosa serve:** individuare i 3–5 potenziali clienti e un'attività/responsabile autorizzato che approvino settore, workflow, campi obbligatori, messaggi al cliente, policy e termini professionali. Il fixture “VocalFlash — STAGING TEST” resta sintetico e non equivale a un cliente pilota.
- **Link di lavoro:** [PR Assistant API #3](https://github.com/VocalFlash/vocalflash/pull/3) · [PR Bot WhatsApp #2](https://github.com/VocalFlash/vocalflash-bot/pull/2) · [Libro sacro operativo](https://github.com/VocalFlash/vocalflash/blob/assistant-conversation-photo-v1/docs/libro-sacro-vocalflash-operational-baseline-v1.md).



### D7 — Dati legali e privacy prima del lancio commerciale
- **Stato:** BLOCCO PRE-LANCIO; non richiede un'azione immediata mentre proseguono test e sviluppo.
- **Cosa dovrai fornire/decidere:** identità reale del titolare del trattamento e dati di contatto privacy; approvare i criteri di conservazione/cancellazione per audio, messaggi, dati operativi, log e backup; confermare i dati contrattuali necessari per gli account fornitori e per la fatturazione. Non inviare segreti in chat.
- **Revisione necessaria:** inventario dei flussi dati effettivi, informativa, DPA ex art. 28 GDPR, termini B2B e trasferimenti internazionali dovranno corrispondere ai servizi davvero attivati ed essere revisionati da un professionista qualificato. Non inventare periodi di conservazione o identità legali.
- **Link:** [Issue privacy pre-lancio #8](https://github.com/VocalFlash/vocalflash/issues/8) · [Libro sacro operativo](https://github.com/VocalFlash/vocalflash/blob/assistant-conversation-photo-v1/docs/libro-sacro-vocalflash-operational-baseline-v1.md).

### Registro sintetico delle decisioni in attesa
1. **Supabase branch:** sì/no. Preventivo ricalcolato il 23/10/2026: $0.01344/ora (~$9.68 per 720 ore o ~$9.81 per 730 ore); ricontrollare prima della creazione.
2. **Bird SMS:** sì/no, solo consumo pubblicato; fermarsi se emergono costi accessori non approvati.
3. **Pagamenti:** carte + wallet oppure anche SEPA Direct Debit; piani/prezzi e cadenza da definire prima dell'implementazione.
4. **Pilota:** individuare 3–5 potenziali clienti e un responsabile di dominio; approvare workflow e dizionario prima dell'uso reale.
5. **Privacy/lancio:** fornire identità del titolare e contatto privacy, concordare retention/cancellazione e far revisionare informativa/DPA/termini prima del lancio.

Non richiedono un'autorizzazione economica e quindi proseguono in autonomia: revisione del codice e dei test, definizione del catalogo terminologico draft da almeno 300 voci, progettazione della persistenza e dell'outbox, test fail-closed, documentazione, revisione delle migrazioni in sola lettura e verifiche CI/Preview. Nessuna di queste attività autorizza modifiche allo schema live, merge o deploy in produzione.



## 11. Ultimo aggiornamento documentale — 23 ottobre 2026

- Registro delle decisioni del titolare aggiunto: Supabase development branch, SMS Bird, metodi di pagamento, identità Auth reale, approvazione del pilota e revisione del dizionario.
- Creato il [catalogo professionale draft v1](https://github.com/VocalFlash/vocalflash/blob/assistant-conversation-photo-v1/docs/professional-terminology-catalog-v1-draft.json): 699 voci candidate, tutte in stato draft, distribuite per settore. Il numero è un inventario iniziale, non certifica che le voci abbiano già sinonimi, definizioni, disambiguazioni ed esempi completi. Nessuna importazione massiva nel database è autorizzata.
- Aggiornata la roadmap master con i gate di qualità del catalogo e il registro delle decisioni.
- Verifica GitHub sul codice applicativo `9bbb304e9ddd15bd80e2fe7cbf803286e7637cf0`: status Vercel **success**. I successivi commit sono documentali; non è stato eseguito un nuovo test end-to-end.
- Non è stata creata una Supabase development branch, non è stato configurato Bird o Stripe, non è stato creato un utente/membro fittizio e non è stata modificata la produzione.


## 12. Catalog quality and validation — 23 October 2026

- The catalog remains an inventory of **699 draft entries** across the seven intended scopes, with no pharmaceutical sector and no duplicate `(sector, normalized_term)` pairs found in the current file.
- A total of **100 entries across the initial sectors** now have preliminary synonyms, definitions, disambiguation notes, examples and confusable terms, including 39 plumbing/maintenance entries and draft enrichment in all six other scopes. They remain `draft` and explicitly require domain-owner review; this is editorial enrichment, not expert approval.
- Added `scripts/validate-professional-terminology-catalog.mjs` and wired it into `.github/workflows/customer-assistant-tests.yml`. The validator checks the minimum count, required sectors, exclusion of pharmacy, uniqueness, draft-only status and completeness of the enriched batch.
- A read of the current catalog file and an equivalent structural check found 699 unique entries, 100 enriched entries, 0 structural issues, and no pharmacy sector. **This is a direct content audit, not yet a reported GitHub Actions pass.** The latest Vercel status for the commit adding the CI step was still `pending` at the last check; do not report a green result until the actual CI/Preview status is confirmed.
- The validator intentionally does not certify professional correctness, legal/medical suitability, synonym quality, or production readiness. Those require expert review and sector-specific semantic tests.

- The validator's enrichment threshold was raised from 30 to 70 and then to 100 after the additional sector batches were added. The current file was re-audited in read-only mode: 699 entries, 699 unique sector-scoped terms, 100 enriched entries with all required draft metadata, no structural issues. GitHub Actions/Preview still needs its own status confirmation.

## 13. Supabase cost refresh — 23 October 2026

A read-only cost quote was retrieved again using the organization associated with the existing VocalFlash Assistant project. The returned branch quote remains **$0.01344/hour**.
Correct conversions: 720 hours (30 days) = $9.6768 (~$9.68); 730 hours = $9.8112 (~$9.81). This is a quote for hourly branch compute, not a guarantee of the total bill.
No branch was created and this check incurred no branch charge. Explicit owner approval is still required; recalculate immediately before creation.
- Updated the validator minimum to 100 enriched entries after the second cross-sector enrichment batch. A new read-only content audit found 699 unique entries, 100 enriched entries with complete draft metadata, no duplicates, no non-draft statuses, and no pharmaceutical sector. CI status remains unconfirmed until the workflow result is available.


## 14. Autenticazione titolare e SMS OTP — 24 ottobre 2026

- Riconfermato in sola lettura il progetto Supabase `VocalFlash Assistant` (`tkfyfqgtumoeywlqzmdt`), stato `ACTIVE_HEALTHY`, database PostgreSQL 17.6.1.
- Riconfermato: 15 migrazioni registrate; nessuna Edge Function presente al momento del controllo.
- Riconfermato con query di sola lettura: `auth.users = 0`, `business_members = 0`. Non creare membri fittizi, UUID inventati o verifiche manuali.
- Implementato su branch isolato `auth-bird-sms-hook-v1` il prototipo `supabase/functions/send-sms/index.ts`: verifica firma Standard Webhooks, valida telefono/OTP, inoltra a Bird EU come SMS di autenticazione, limita il payload e il timeout, non registra OTP/telefono/segreti e fallisce chiuso se la configurazione manca.
- Aggiunta la guida `docs/auth-phone-verification-bird-v1.md` con i gate di attivazione controllata. PR Draft #9: https://github.com/VocalFlash/vocalflash/pull/9.
- **Solo revisione statica contro la documentazione corrente:** non sono ancora stati aggiunti/eseguiti test automatizzati; nessun deploy, configurazione Auth Hook, segreto, account Bird, SMS reale o test OTP effettuato. Il codice non è pronto per attivazione.
- Nessuna modifica a schema/dati live, nessuna chiave generata, nessun credito acquistato, nessuna risorsa a pagamento e nessun deploy in produzione.
- Gate prima di procedere: aggiungere test automatici; verificare sender/allowlist Italia e costi Bird; ottenere approvazione esplicita per ogni costo e SMS fatturabile; distribuire solo in un ambiente non produttivo con JWT verification disabilitata per la funzione ma firma Standard Webhooks obbligatoria; completare il flusso OTP direttamente nell'interfaccia sicura e collegare il titolare solo dopo verifica Auth.


## 15. Avanzamento autonomo: vocabolario, persistenza e raccomandazioni — 24 ottobre 2026

### Vocabolario
- Catalogo letto e verificato: 699 voci candidate in 7 settori iniziali, nessun settore farmaceutico.
- Arricchite altre 20 voci idrauliche/manutentive con sinonimi, definizione, disambiguazione, esempi e termini confondibili. Totale arricchito: 120/699.
- Tutte le voci restano `draft`; il lavoro editoriale non equivale a revisione da esperto e non abilita il catalogo al runtime.
- Aggiornato `docs/professional-terminology-catalog-v1-draft.json` sul branch `assistant-conversation-photo-v1`, commit `c681f442a08165613b58c7c01d342cd94811542f`.
- La validazione del catalogo via GitHub Actions sul commit più recente è ancora da confermare. Il workflow visto verde prima delle modifiche è un run precedente, quindi non viene considerato prova del nuovo contenuto.

### Persistenza conversazionale e conferma atomica
- Creato `docs/persistent-conversation-and-owner-confirmation-design-v1.md`: confini per tenant/conversazione/workflow, provenienza dei campi, versionamento, invalidazione della conferma quando cambiano i dati, replay protection, compare-and-set, lease/fencing, ripresa dopo crash e test minimi.
- Il documento è progettuale: non introduce schema né implementa la transazione atomica. Le scritture restano disabilitate finché il gate non è implementato e testato.
- Il design bot già esistente conferma il rischio di crash tra accettazione Meta e persistenza dello stato Redis; callback status Meta e riconciliazione restano da implementare. Nessuna garanzia exactly-once.

### Secondo libro delle raccomandazioni
- Creato `docs/libro-raccomandazioni-titolare-vocalflash-v1.md`, registro vivo delle regole di collaborazione, principi di prodotto, vocabolario, fail-closed, conferma del titolare, persistenza, invii, costi/privacy e test/release.
- Il secondo libro complementa il Libro sacro: il primo registra stato e prove; il secondo conserva le raccomandazioni e i vincoli espressi dal titolare.

### CI / release e limiti
- Per il commit della PR #9 è stato rilevato un run Vercel Preview concluso con successo; riguarda la Preview web e non prova l'esecuzione dell'Edge Function SMS.
- Per il commit più recente del ramo di sviluppo, un controllo workflow disponibile ha restituito un run precedente concluso con successo. Dopo gli aggiornamenti a catalogo e documentazione, serve un run riferito all'head esatto prima di dichiarare la CI verde.
- Nessun test SMS, nessuna configurazione di credenziali, nessun deploy Supabase, nessuna modifica live o acquisto è stato eseguito.

- **Verifica successiva:** GitHub Actions run #324 (`40076814169`) sul commit `d4cea0a6829d97555d581d0e6aad0c5185b33e46` è terminato `success`; gli step “Validate draft professional terminology catalog” e “Run focused assistant tests” risultano completati con esito positivo. È una prova valida per quel commit. Dopo l'aggiornamento del Libro sacro e della roadmap, va controllato il run generato dal nuovo head.
- Vercel Preview sul commit `d4cea0a6829d97555d581d0e6aad0c5185b33e46` era ancora `pending` al controllo; non dichiarare Preview pronta finché non si osserva uno stato terminale.

- **Re-check finale:** GitHub Actions run #328 (`40076877316`) è terminato `success` sul commit `6dba0c0a0345c6b975c424fed7ee30c3cd164ad2`; validator del catalogo e test focalizzati Assistant risultano verdi. Vercel Preview sul medesimo commit era ancora `pending` al controllo; questa parte resta da verificare separatamente.


## Registro aggiornato — 24 ottobre 2026

Il registro canonico delle raccomandazioni è stato consolidato in `docs/libro-raccomandazioni-titolare-vocalflash-v1.md` (v2 del contenuto, stesso percorso). Comprende override storici e attuali, metodo di collaborazione, qualità della sintesi, vocabolario, sicurezza/owner confirmation, MultiVocale, persistenza, outbox, costi, privacy, test e pilot.

Regola esplicita del titolare: il registro operativo è dinamico; rimuovere dal registro attivo i punti chiusi mantenendone evidenza nello storico, aggiungere le nuove raccomandazioni e marcare come sospesi i punti in attesa. Non dichiarare chiuso un punto sulla base di un piano.

Verifica CI: run #330 `40076914648` risulta `completed/success` sul commit `e00dd7f7dd585817011ab3ab28b33ea0173ee840`. Il presente aggiornamento documentale genera un nuovo head: il risultato della run #330 non va esteso al nuovo head. Ricontrollare CI e Preview sulla revisione corrente prima di attribuire loro uno stato.

## Follow-up engineering correction — 24 October 2026

A fail-closed gap was identified in the read-only NEW work-creation policy evaluator: a policy row with missing or null `is_active` could previously be treated as applicable because only the explicit value `false` was excluded. The evaluator now considers a policy applicable only when `is_active === true`. Added a focused regression test covering missing, null and false activity states with an otherwise permissive `auto` mode. This remains a policy-evaluation gate only; it performs no writes and does not enable owner confirmation or work-item creation.

Commit with implementation: `4839fed710cfcb463428fb9c2009a2c00addfca9`. Regression-test commit: `2ff13321f04e37b0ac7b573dba8771affb9bcb80`. CI run #341 (`40079074071`) was still in progress at the time of this note; its final result must be checked before calling the regression test passed.

## Policy-resolution hardening — 24 October 2026

Follow-up review found a second fail-open risk: a malformed applicable policy row (missing/null active flag or unknown scope) could be filtered out, allowing a less restrictive business-level `auto` policy to become effective. Policy resolution now fails closed on malformed applicable rows instead of silently falling back; explicitly inactive rows remain excluded, and valid workflow policies for other workflows do not affect the current workflow. Regression cases cover missing/null/false activity, a malformed workflow policy beside a business-level auto policy, and an unknown scope beside business auto.

Implementation commit: `4c173a5122c343faf98601a227a81ee9a3d25ab9`. Regression tests: `9f0ebd3935349d7d481911309ce1923698c59000`. GitHub Actions run #351 (`40079234377`) completed successfully on the exact test commit: catalog validation and focused assistant tests passed. This remains a read-only policy gate and does not enable writes. Vercel Preview status was still pending when checked; subsequent documentation commits must be rechecked.

## CI notification duplication audit — 24 October 2026

Review of recent runs confirmed that each commit on the Assistant PR branch was triggering the same test workflow twice: once for `push` to `assistant-conversation-photo-v1` and once for `pull_request` targeting `assistant-auth-v1`. For example, commit `963ccba44cf7089a475d93ae7fd0c3dc47a59c0c` had both push run `40079317111` and pull-request run `40079320217`, both successful. This is a confirmed source of duplicate CI activity/notifications, not evidence by itself that every failure email was caused by duplication.

The Assistant workflow now uses `push` to its dedicated PR branch plus manual `workflow_dispatch`, with a concurrency group that cancels stale runs. The bot workflow uses the same single-source pattern on its dedicated PR branch. This keeps checks running on each branch update without also triggering a second copy for the same PR event. No deployment or runtime behavior changed. Assistant workflow run #364 (`40079464505`) passed on commit `028e08ee456eac451c4177ed2e42f8b66bd33ceb`; the bot workflow run for its trigger change was still running at the latest check. Old duplicate runs remain in GitHub history.

## Data-plan trust-boundary validation — 24 October 2026

A further fail-closed check was added to the read-only NEW work-creation policy gate. A plan marked `CREATION_POLICY_REQUIRED` must now carry a `required_fields` array, and every listed field must be explicitly `PROVIDED`; absent arrays, missing/uncertain fields and malformed entries return `DATA_PLAN_NOT_READY` with no authorization or write. An empty array remains valid for workflows whose configured plan has no outstanding required fields. Regression tests cover each malformed case.

Implementation commit: `5f3f6a9003927ab490c3d906c5f1c4da800f84d5`; test commit: `0f6208e2c304fb8b3cf8962eab3147218819ef67`. CI run #368 (`40079606945`) passed: terminology catalog validation and focused assistant tests succeeded on the exact test commit. The subsequent recommendation-register update has a newer head and its CI/Preview status must be checked separately.

## Audit consegna MultiVocale — 24 ottobre 2026

La revisione statica del percorso `PersistentMultivocaleRuntime._process_batch()` ha individuato un rischio concreto da chiudere prima del rilascio: la sintesi viene salvata in `ready_answer`, ma se `safe_send()` fallisce o va in timeout il batch viene marcato `failed` e viene proposto `Riprova`. Se Meta avesse accettato il primo invio senza che il client ricevesse la risposta, il retry potrebbe spedire la stessa sintesi una seconda volta. È un rischio di percorso individuato tramite lettura del codice, non un incidente riprodotto in staging o produzione.

Aperto bot issue #4: [Release blocker: reconcile ambiguous WhatsApp sends in MultiVocale](https://github.com/VocalFlash/vocalflash-bot/issues/4). È stato poi implementato sul ramo Draft un primo guard conservativo: marca durevolmente il confine del tentativo d'invio, registra gli stati `sending`/`sent`/`outcome_unknown`, blocca il recupero automatico dopo il confine d'invio e non propone `Riprova` quando l'esito è ambiguo. CI bot run [40081928311](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40081928311) è passato sul commit `1a717d314ab07ea670c4e20a0bb0dd8b676c469b`; la documentazione del design è stata aggiornata successivamente. Questo riduce il rischio ma non implementa ancora outbox durevole, correlazione del message ID Meta o riconciliazione dei callback. Non è stato fatto alcun deploy. PR #2 e PR #3 restano Draft; la consegna durevole rimane un release gate.


## Verifica read-only RPC titolare — 24 ottobre 2026

Verifica diretta in sola lettura eseguita sul progetto Supabase live `tkfyfqgtumoeywlqzmdt`. Nessuna funzione, schema, dato, grant o configurazione è stata modificata.

### Firme effettivamente installate
- `vf_resolve_owner_member_by_sender_v1(text, uuid)`: 2 parametri; il secondo, `p_business_id`, è opzionale.
- `vf_record_owner_command_confirmation_v1(uuid, uuid, uuid, text, uuid, text, timestamptz, jsonb)`: 8 parametri, ultimo con default.
- `vf_commit_owner_note_v1(uuid, uuid, uuid, uuid, text, boolean, uuid)`: 7 parametri, gli ultimi due con default.
- `vf_commit_owner_schedule_action_v1(uuid, uuid, uuid, uuid, text, timestamptz, boolean, uuid)`: 8 parametri, gli ultimi due con default.

Le firme live sono state lette da `pg_proc` e confrontate con le definizioni installate via `pg_get_functiondef`. Questo conferma le firme del database attuale, ma **non dimostra da solo** che ogni chiamante applicativo usi gli argomenti corretti: per chiudere quel punto occorre verificare il percorso chiamante sul commit corrente e i test pertinenti.

### Conferma del titolare: gap ancora aperto
La funzione di registrazione controlla membro attivo, canale attivo e proposta collegata, quindi registra un evento `owner_command_confirmation`. Le due funzioni di commit controllano `p_confirmed = true`, la proposta e la coerenza dei dati della nota/azione; nelle definizioni live ispezionate non verificano però la presenza di uno specifico evento di conferma valido, la sua scadenza o il suo consumo one-time nella stessa transazione della scrittura. I lock e l'idempotenza presenti non sostituiscono questo vincolo.

### Privilegi e sicurezza
La verifica dei privilegi effettivi ha restituito, per tutte e quattro le RPC:
- `anon`: nessuna esecuzione;
- `authenticated`: nessuna esecuzione;
- `service_role`: esecuzione consentita.

Tutte risultano `SECURITY DEFINER`, proprietario `postgres`, con `search_path` esplicitato. I privilegi riducono l'esposizione diretta agli utenti anonimi/autenticati, ma non eliminano la necessità di correggere il contratto tra chiamante server-side e database. Il chiamante privilegiato deve restare fail-closed.

### Esito operativo
- **VERIFICATO:** firme installate, definizioni live, privilegi sulle quattro RPC.
- **CONFERMATO BLOCCANTE:** la conferma non è ancora vincolata e consumata atomicamente insieme all'effetto; mantenere `ATOMIC_CONFIRMATION_NOT_ENABLED`.
- **NON VERIFICATO IN QUESTO ciclo:** corrispondenza di ogni chiamata applicativa alle firme, test di replay/concorrenza e percorso end-to-end.
- **NON ESEGUITO:** modifiche SQL, migrazioni, scritture dati, creazione di branch Supabase, deploy o cambi in produzione.

Prossimo passo tecnico sicuro: tracciare le chiamate RPC dal codice applicativo sul branch corrente e confrontare nome/ordine/numero degli argomenti con le firme sopra, senza eseguire scritture. La correzione della conferma atomica richiede prima un ambiente di sviluppo sicuro; la creazione della branch Supabase resta subordinata all'approvazione esplicita del costo.


## Ciclo di lavoro — verifica raccomandazioni e SMS hook (24 ottobre 2026)

### Libro delle raccomandazioni — verificato e corretto
- Letto il documento canonico `docs/libro-raccomandazioni-titolare-vocalflash-v1.md` sul branch `assistant-conversation-photo-v1`.
- Il registro contiene le regole di collaborazione, visione prodotto, sintesi e provenienza dei dati, vocabolario, fail-closed, conferma atomica, persistenza, outbox, costi/onboarding/privacy, test/rilascio, ricerca dei bisogni e checklist.
- Rilevata una raccomandazione esplicita non presente: riepilogo ricorrente del venerdì con avanzamenti, blocchi, decisioni aperte, aree Meta/MultiVocale/Account & Billing/privacy-sicurezza e tre priorità successive. Aggiunta come sezione 16. Commit documentale: `ceaf35d9624136cc5541938e59dd1d7227092e8d`.
- Il libro resta un registro di raccomandazioni: non costituisce prova di implementazione né autorizzazione a operazioni protette.

### Intervento sicuro sulla PR SMS via Bird
- PR #9 `auth-bird-sms-hook-v1` resta **Draft** e non è stata unita.
- Refactoring isolato del Send SMS Hook per permettere test deterministici tramite dipendenze iniettate; nessuna configurazione live modificata.
- Aggiunti test Deno per configurazione fail-closed, firma Standard Webhooks valida/mancante/manomessa, evento non valido, rifiuto provider, timeout senza retry cieco e accettazione provider.
- Aggiunto workflow GitHub Actions dedicato: `.github/workflows/bird-sms-hook-tests.yml`.
- Documentazione della PR aggiornata per distinguere test aggiunti da test effettivamente eseguiti.
- **Test CI sul commit corrente: NON VERIFICATI.** Gli strumenti disponibili non hanno restituito un esito autorevole del workflow push-triggered; non dichiarare i test superati finché il run non è consultabile. Nessun SMS reale è stato inviato.

### Verifiche Supabase e blocchi che restano
- La verifica read-only precedente ha confermato le firme live delle quattro RPC titolare e i privilegi: nessun EXECUTE per `anon`/`authenticated`, EXECUTE per `service_role`.
- La conferma atomica resta incompleta nelle RPC di commit. `ATOMIC_CONFIRMATION_NOT_ENABLED` deve rimanere attivo.
- La corrispondenza di tutte le chiamate RPC nel codice applicativo non è ancora stata verificata end-to-end.
- La provenienza delle 15 migrazioni live non è riconciliata con una sequenza SQL autorevole.
- Persistenza multi-turn, outbox durevole e riconciliazione degli invii restano da implementare e testare.
- La branch Supabase di sviluppo non è stata creata: il preventivo precedente era `$0.01344/ora`; serve approvazione esplicita del costo prima di creare una risorsa.
- Nessun utente Auth o membro aziendale fittizio; nessun segreto o hook Bird configurato; nessun SMS fatturabile, deploy o modifica live.

### Stato verificato alla chiusura di questo ciclo
**Completato:** audit del Libro delle raccomandazioni; aggiunta della sezione mancante sul riepilogo periodico; refactoring isolato del handler SMS per testabilità; aggiunta dei test e del workflow; aggiornamento della descrizione PR e della documentazione dedicata.

**Non dichiarato completato:** esecuzione verde dei nuovi test; verifica reale del Send SMS Hook; conferma atomica; migrazioni; persistenza/outbox; onboarding con identità reale; staging E2E; rilascio.

**Prossimo passo autonomo e sicuro:** ottenere il risultato del workflow Deno sul branch `auth-bird-sms-hook-v1`, correggere eventuali errori e aggiornare le evidenze. Nessun merge, deploy, costo, SMS reale o modifica di schema senza le autorizzazioni previste.


## Ciclo di recheck generale e hardening idempotenza Bird (24 ottobre 2026)

### Recheck documentale e dei repository
- Riletto il Libro delle raccomandazioni del titolare: sezione 16 “Riepilogo periodico VocalFlash” presente; restano vincolanti la distinzione fra implementato/testato/progettato/bloccato, il divieto di dichiarare test non eseguiti e i gate per costi/produzione.
- Verificato il presente Libro sacro e lo stato delle PR principali: Assistant API PR #3 e bot WhatsApp PR #2 sono ancora aperte in Draft e non integrate. La Preview Vercel verde sulla PR #3 non prova l'E2E combinato; per il head della PR #2 il connector non ha restituito status checks.
- PR #9 SMS/Bird è ancora aperta in Draft, non integrata. Il nuovo head contiene una modifica ulteriore descritta sotto; nessun deploy, configurazione Auth/Bird, SMS reale o modifica di produzione è stata eseguita.

### Supabase — controllo live in sola lettura
- Progetto `tkfyfqgtumoeywlqzmdt`: `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.171.
- Registro live: 15 migrazioni; riconciliazione con la sequenza SQL autorevole ancora aperta. Nessuna development branch Supabase presente.
- Security advisor aggiornato il 24/10: 15 tabelle con RLS abilitata e senza policy. Questo normalmente nega l'accesso diretto ai ruoli non bypass-RLS, ma va verificato rispetto ai percorsi di accesso effettivi e ai privilegi; non aggiungere policy permissive per silenziare l'advisor.
- Performance advisor: 18 foreign key senza indice di copertura e 26 indici segnalati come inutilizzati. Non eliminare gli indici inutilizzati automaticamente; valutare gli indici FK dopo la riconciliazione delle migrazioni e con workload misurabile.
- Le RPC di commit continuano a non dimostrare un vincolo atomico fra conferma valida/non scaduta/consumata una sola volta e scrittura. Mantenere `ATOMIC_CONFIRMATION_NOT_ENABLED`; nessuna migrazione live applicata.

### PR #9 — miglioramento anti-duplicazione SMS
- Dopo aver verificato la documentazione ufficiale Bird, aggiunto alla richiesta SMS l'header `Idempotency-Key` derivato dal `webhook-id` Standard Webhooks firmato; aggiunto test unitario che verifica la propagazione della chiave e aggiornata la documentazione del flusso.
- Razionale: Bird documenta la riproduzione della risposta originale per chiavi identiche entro una retention di 3 ore; l'ID del webhook resta stabile per i retry della stessa consegna. Questo riduce la possibilità di accettazioni SMS duplicate se lo stesso evento viene ritentato.
- Limiti: non equivale a consegna exactly-once, non prova la consegna al telefono e non sostituisce outbox/reconciliation. Il handler continua a non effettuare retry ciechi dopo timeout.
- Commit del codice: `623a961a158d6f1561217b549dee005b4bacb539`; commit test: `eee5443035427db12b74b6d65db5aa707db9424b`; commit documentazione SMS: `f95effedb8a5d000e70706d9b6fec87aafdce1ff`.
- La review statica e la verifica documentale sono state eseguite; **i test Deno non sono stati eseguiti/verificati**. Il connector continua a restituire `workflow_runs: []`; sul head SMS `f95effedb8a5d000e70706d9b6fec87aafdce1ff` lo status disponibile è Vercel `success` (Preview), che non prova l'esecuzione o il successo dei test Deno. Non dichiarare il workflow passato.

### Stato e prossimi passi
1. Ottenere un risultato autorevole della workflow Deno sul head corrente e correggere eventuali fallimenti prima di qualunque deploy.
2. Mantenere PR #9 Draft; verificare in staging non-prod soltanto dopo review, autorizzazione di costo e configurazione protetta.
3. Proseguire in parallelo con riconciliazione migrazioni, conferma atomica, persistenza conversazioni e outbox/reconciliation; nessun GO-LIVE finché i gate della roadmap non sono soddisfatti.
4. Nessuna development branch Supabase, costo aggiuntivo, segreto, utente Auth, business member o SMS reale è stato creato/inviato in questo ciclo.


### Nota di stato dopo l'aggiornamento della roadmap — 24 ottobre 2026
- La roadmap è stata aggiornata sul branch `assistant-conversation-photo-v1`; lo status Vercel osservato sul commit documentale `9fe0064aef4711ba410fb22cf099eeb2a70351cc` era `pending` al momento del controllo. Questo status riguarda il branch documentale e non costituisce prova dei test Deno della PR #9 o di un test E2E.


## Ciclo di verifica ripetuto cinque volte — esito verificato (24 ottobre 2026)

### Risultati CI effettivi
- **Assistant API / sito:** run GitHub Actions [#40114128653](https://github.com/VocalFlash/vocalflash/actions/runs/40114128653), commit candidato `77fbddfa19d04a7a163e3af1ba6c9ed379abee97`: 5/5 job completati con successo; ogni pass ha eseguito 89 test, 89 passati, 0 falliti (445 esecuzioni di test). Il controllo Vercel Preview dello stesso commit è `success`; è Preview, non produzione.
- **Bot WhatsApp Python / MultiVocale:** run [#40113909039](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40113909039), commit `7ad05b42122c939a5669c2fdceeae604185aec09`: 5/5 job completati con successo; ogni pass ha eseguito 35 test, senza errori (175 esecuzioni).
- **SMS Hook / Bird:** run [#40113926527](https://github.com/VocalFlash/vocalflash/actions/runs/40113926527), head `ca1d3f46cef0f8fa38a8c534eb70985500481dcc): 5/5 job completati con successo; ogni pass ha eseguito 11 test, 11 passati, 0 falliti (55 esecuzioni). Un secondo evento CI sullo stesso head, run [#40113921972](https://github.com/VocalFlash/vocalflash/actions/runs/40113921972), ha completato anch'esso 5/5 job con successo.
- **Totale minimo della matrice richiesta:** 675 esecuzioni di test riuscite nei tre sottosistemi (445 API + 175 bot + 55 SMS), zero fallimenti nei job finali selezionati. Il secondo run SMS aggiunge ulteriori 55 esecuzioni riuscite.
- Un precedente run API parallelo `40113906429` è rimasto `in_progress` nell'ultima lettura, ma è superato dal run successivo seriale `40114128653`, completato `success`. Non usare il run precedente come evidenza di completamento.

### Implementazioni CI/SMS incluse nella verifica
- Il workflow API ripete la suite cinque volte in sequenza, con timeout per job di 10 minuti.
- I workflow bot e SMS eseguono cinque pass indipendenti per run.
- SMS Hook: aggiunta lettura del body con limite effettivo di 20 KiB anche quando manca `Content-Length`; idempotency key Bird derivata da `webhook-id`; 11 test Deno coprono firma, payload manomesso, configurazione fail-closed, input malformato, limiti del body, provider rejection, timeout senza retry cieco e propagazione della chiave.
- PR #3, PR #2 e PR #9 restano Draft e non integrate. Nessun deploy, nessun SMS reale, nessun segreto o risorsa a pagamento creati.

### Blocchi ancora aperti — NO-GO al rilascio
- **Conferma titolare atomica:** le RPC live di commit non legano ancora in modo atomico la conferma valida/non scaduta/monouso alla scrittura. Mantenere `ATOMIC_CONFIRMATION_NOT_ENABLED`.
- **Migrazioni:** 15 versioni presenti nel registro Supabase, ma la sequenza SQL autorevole completa non è stata trovata e riconciliata nel repository.
- **Persistenza conversazioni e outbox:** il flusso multi-turno completo, la outbox durevole e la riconciliazione degli esiti WhatsApp ambigui non sono ancora provati end-to-end.
- **Staging E2E:** non eseguito. Test unitari verdi e Preview verde non equivalgono a prova Meta→API→Supabase→bot→risposta.
- **Supabase live:** nessuna Edge Function distribuita; advisor aggiornati rilevano 15 tabelle RLS senza policy, 18 FK senza indice di copertura e 26 indici segnalati come inutilizzati. Sono rilievi da valutare, non autorizzazione a modifiche automatiche. Nessuna development branch creata.
- Nessun cambiamento al database/schema live, nessun utente Auth/membro business fittizio, nessun SMS reale e nessuna modifica di produzione.

### Prossime azioni sicure
1. Conservare l'evidenza dei tre run a cinque passaggi e non promuovere le PR.
2. Recuperare e riconciliare le 15 migrazioni autorevoli prima di progettare modifiche DB.
3. Implementare e testare la transazione di conferma atomica in ambiente isolato prima di abilitare le scritture.
4. Implementare persistenza/outbox/reconciliation e poi eseguire il runbook E2E in staging isolato, con credenziali e costi approvati.

## Recheck di chiusura e riconciliazione dei risultati — 24 ottobre 2026

### Ripetizione finale delle suite automatiche (evidenza riletta dai log)
- **Assistant API, sul commit documentale finale `56ef6a85a96325f5a82ffc975de23104c871d9f4`:** run [#40114332345](https://github.com/VocalFlash/vocalflash/actions/runs/40114332345). Ho recuperato i log di tutti e cinque i job: ciascun log riporta `# tests 89`, `# pass 89`, `# fail 0`. Esito verificato: **5/5 pass, 445 esecuzioni riuscite**. Il riepilogo dei job mostrava temporaneamente uno stato step incoerente per il pass 5, ma il log di quel job contiene il riepilogo finale 89/89 e il job ha conclusione `success`; la conclusione è basata sul log, non sull'etichetta dello step.
- **Bot WhatsApp Python / MultiVocale:** run [#40113909039](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40113909039), head `7ad05b42122c939a5669c2fdceeae604185aec09`. I cinque job risultano `success`; il log controllato riporta `Ran 35 tests` e `OK`. Totale verificato della matrice: **175 esecuzioni riuscite**.
- **SMS Hook / Bird:** run [#40113926527](https://github.com/VocalFlash/vocalflash/actions/runs/40113926527), head `ca1d3f46cef0f8fa38a8c534eb70985500481dcc`. Log dei cinque job verificati: ciascuno riporta 11 test, 11 passati, 0 falliti. Totale: **55 esecuzioni riuscite**.
- Le matrici principali sommano **675 esecuzioni riuscite** (445 API + 175 bot + 55 SMS). Considerando anche il secondo run API sul commit documentale finale (445) e il secondo run SMS sul medesimo head di codice (55), i run citati in questo registro totalizzano **1.175 esecuzioni riuscite**. Questo totale riguarda suite automatiche ripetute, non test E2E completi.
- Il run API precedente sul codice applicativo `77fbddfa19d04a7a163e3af1ba6c9ed379abee97` ([#40114128653](https://github.com/VocalFlash/vocalflash/actions/runs/40114128653)) resta una seconda evidenza positiva: 5/5 job, 89/89 test per job.

### Nuovo controllo Supabase in sola lettura
- Progetto `tkfyfqgtumoeywlqzmdt`: il registro live restituisce ancora **15 migrazioni** e l'introspezione conferma **15 tabelle nello schema public**; l'elenco Edge Functions è vuoto.
- Security advisor aggiornato il 24/10: **15 tabelle RLS-enabled senza policy**. Non creare policy permissive per azzerare l'avviso: valutare i percorsi di accesso e i privilegi dopo aver ripristinato la fonte delle migrazioni.
- Performance advisor: **18 foreign key senza indice di copertura** e **26 indici segnalati come inutilizzati**. Non rimuovere indici automaticamente; verificare il carico reale e riconciliare prima le migrazioni.
- L'ispezione delle definizioni delle RPC di conferma/commit non fornisce prova che conferma valida, scadenza, consumo monouso e scrittura siano vincolati nella stessa transazione. Rimane obbligatorio `ATOMIC_CONFIRMATION_NOT_ENABLED`.
- Non è stata trovata una sequenza SQL autorevole completa nel branch di sviluppo; la lettura di un percorso di migrazione ipotizzato ha restituito 404. Questo non autorizza a ricostruire migrazioni per supposizione o ad applicare SQL sul database live.

### Distinzione essenziale: suite ripetute vs flusso end-to-end
- **Completato e verificato:** cinque esecuzioni indipendenti per ognuna delle suite API, bot e SMS, con i risultati sopra elencati; controllo dei log dei job; nuova lettura del registro migrazioni, tabelle, funzioni Edge e advisor Supabase; ricontrollo delle PR.
- **Non completato e non dichiarabile PASS:** il flusso reale integrato Meta → bot → Assistant API → Supabase → risposta WhatsApp non è stato eseguito cinque volte né è stato certificato in staging. I prerequisiti sicuri (ambiente DB isolato con migrazioni riconciliate, credenziali di staging verificate, secret Meta corretto, membro autorizzato, conferma atomica e outbox/reconciliation) non risultano tutti disponibili/provati. Non sostituire questo gate con le suite unitarie.
- PR #3 (Assistant API), PR #2 (bot) e PR #9 (SMS/Bird) restano Draft e non integrate. Nessun merge, deploy in produzione, cambiamento schema/dati live, configurazione SMS/Auth, segreto aggiunto o SMS reale è stato eseguito.

### Esito operativo
**NO-GO al rilascio invariato.** Il ciclo automatico di cinque passaggi è chiuso con risultati positivi e documentati; non è corretto dichiarare chiuso “tutto” finché restano i gate di sicurezza e integrazione sopra elencati.

### Prossime azioni sicure e ordinate
1. Recuperare la fonte autorevole delle 15 migrazioni e riconciliarla con il registro live senza modificare il database.
2. Preparare un ambiente di sviluppo/staging isolato con schema riproducibile, solo dopo aver chiarito costi e autorizzazioni.
3. Implementare e testare atomicamente il vincolo di conferma del titolare, mantenendo il blocco fail-closed finché la prova non è completa.
4. Completare persistenza multi-turno, outbox durevole e riconciliazione degli esiti ambigui; poi eseguire il runbook E2E in staging con dati sintetici e ripeterlo cinque volte.
5. Tenere tutte le PR in Draft fino alla revisione dei gate; nessuna modifica live, merge o deploy implicito.

## Chiusura del ciclo autonomo di hardening documentale — 24 ottobre 2026

### Nuove verifiche eseguite dopo il ciclo cinque-pass
- Riletti dal repository gli audit di conferma atomica, provenienza migrazioni e stato conversazione multi-turno.
- Interrogato nuovamente il registro live Supabase: le stesse 15 migrazioni risultano presenti; l'inventario schema resta coerente con le 15 tabelle public documentate; nessuna Edge Function risulta distribuita.
- Rieseguiti gli advisor: 15 tabelle RLS-enabled senza policy, 18 FK senza indice di copertura e 26 indici segnalati come inutilizzati. Non sono state create policy, aggiunti/rimossi indici o applicate migrazioni.
- Ricercati ulteriormente i nomi distintivi delle migrazioni e delle RPC nella repository/organizzazione accessibile. Non è stata recuperata una fonte SQL autorevole completa; ciò non dimostra che non esista in un backup o in un altro repository, ma impedisce di ricostruirla con sicurezza dai soli nomi.
- Confermato che le RPC di commit non verificano e consumano atomicamente l'evento di conferma valido/non scaduto/monouso. Il runtime mantiene il blocco fail-closed.
- Aggiornati gli audit `docs/owner-confirmation-atomicity-audit-v1.md` e `docs/supabase-migration-provenance-audit-v1.md`, la matrice `docs/cross-repository-assistant-release-verification-matrix-v1.md` e il runbook `docs/staging-end-to-end-release-runbook-v1.md` con gate e prove aggiornati.
- Commit degli audit: `f24cb3c5ba9938eecb10cf2f7f8e03390fc1a1f0` e `34e9af7ff5bc64574ea0104beeb1c625a23efa80`. Commit della matrice: `d8563220ed0d4cf800a6f06aae31619346b8d004`. Commit del runbook: `d139e6710fc9cbcb7c265b3a8481afcccb8232a6`.
- La Preview Vercel del commit di documentazione controllato era `pending` al momento dell'ultima lettura; non si assume un esito positivo da uno stato pendente. I workflow API/Bot/SMS già verificati restano evidenza delle rispettive suite sui commit indicati nelle sezioni precedenti, non dei commit documentali successivi.
- Nessun merge, deploy, modifica DB/schema/dati live, branch Supabase a pagamento, credenziale, identità fittizia o invio SMS reale è stato eseguito.

### Stato conclusivo del lavoro possibile senza autorizzazioni o prerequisiti ulteriori
**Completato:** ciclo automatico a cinque passaggi per API, bot e SMS con log verificati; controlli live read-only; aggiornamento coordinato del Libro sacro, roadmap, matrice, runbook e audit specialistici; mantenimento dei guardrail fail-closed.

**Bloccato per ragioni reali, non per mancanza di test unitari:** recupero della sequenza SQL autorevole delle 15 migrazioni; creazione di un ambiente isolato riproducibile (eventuali costi richiedono approvazione); implementazione e prova della conferma atomica; persistenza conversazionale e outbox/reconciliation; cinque esecuzioni E2E integrate con credenziali e identità di staging autorizzate.

**Esito:** le attività autonome sicure disponibili in questo contesto sono state completate. Il prodotto rimane **NO-GO per il rilascio**. Non rimuovere i blocchi e non dichiarare completato l'E2E finché non esistono le evidenze richieste.

## 8. Registro consolidato delle raccomandazioni dell’utente — revisione 24 ottobre 2026

Questa sezione consolida le raccomandazioni permanenti ricostruite dal registro di continuità e dalle decisioni operative disponibili. In caso di conflitto prevalgono le istruzioni esplicite più recenti dell’utente e i vincoli di sicurezza del progetto. Il registro storico resta una fonte di tracciabilità; questo Libro sacro è il riferimento operativo corrente.

### 8.1 Metodo di lavoro obbligatorio
- Prima di ogni azione rileggere Libro sacro, roadmap, registro raccomandazioni/continuità, stato corrente di branch/PR, ultimi commit, test e incidenti pertinenti. Non ripartire da zero e non ignorare decisioni precedenti.
- Separare sempre: **implementato**, **testato con evidenza**, **progettato/deciso**, **bloccato**, **non iniziato**. Indicare SHA, ambiente e risultato quando disponibili. Non trasformare un piano, una review statica o un test unitario in prova E2E.
- Essere proattivi, prudenti, precisi, critici e lungimiranti. Cercare controesempi, alternative, regressioni, ambiguità e rischi; non limitarsi a confermare la soluzione preferita.
- Procedere autonomamente con attività documentali, analisi e verifiche di sola lettura e con modifiche isolate e reversibili. Fermarsi prima di costi, servizi a pagamento, dati/schema live, segreti/configurazioni reali, messaggi a persone, azioni irreversibili, merge o deploy non autorizzati.
- Fare la modifica minima necessaria; dopo ogni modifica rileggere il risultato, verificare diff/stato, eseguire i test pertinenti, controllare effetti collaterali e aggiornare Libro sacro, roadmap e registro di evidenza.
- Non ripetere batterie per inerzia: rieseguirle quando cambia codice/contratto, ambiente, dipendenza o rischio. Se l’utente richiede una ripetizione esplicita (es. cinque cicli), eseguirla e documentare ogni esecuzione; distinguere cicli identici da copertura E2E.
- Non dire “sto eseguendo”, “completato”, “testato” o “risolto” senza un’azione e un risultato osservabili. Se uno strumento fallisce, riportare il limite e non simulare il completamento.
- Non riversare codice completo in chat nella fase corrente. Quando serve una modifica, lavorare sui file e riportare sintesi, file, commit, prove e blocchi; mostrare codice solo se richiesto espressamente.
- Mai chiedere, esporre, registrare o committare segreti, token, numeri personali o contenuti cliente non necessari. Sanificare log e prove.

### 8.2 Principi di prodotto e comportamento
- VocalFlash è un assistente WhatsApp **“dal vocale all’azione”**, non un trascrittore generico. La sintesi privilegia significato, richieste, decisioni, nomi, luoghi, date, importi, scadenze e prossimi passi; non restituisce automaticamente l’intera trascrizione né un’intestazione ridondante come “Punti salienti”.
- Preservare e proteggere il flusso audio/MultiVocale legacy mentre si sviluppa il percorso Assistant. Unire vocali in batch senza perdere il primo elemento, gestire finestre temporali, concorrenza, retry e restart senza duplicazioni o perdita di contenuto.
- Il flusso dell’assistente deve essere esplicito e verificabile: messaggio/evento → intent → classificazione/Resolver → workflow e policy → estrazione di dati supportati → identificazione dei dati mancanti/incerti → domanda mirata → proposta/azione autorizzata → persistenza e risposta. Non creare pratiche sulla sola base di una classificazione o di un output del modello.
- Riconoscere automaticamente il settore senza irrigidire l’assistente in un singolo settore. Conservare terminologia professionale e contesto aziendale; non inventare fatti o completare campi mancanti per supposizione. I settori devono essere coperti da test rappresentativi; non reinserire l’esempio farmaceutico come settore prioritario senza decisione esplicita.
- Il vocabolario terminologico aziendale è solo contesto lessicale non attendibile: non può autorizzare azioni, sovrascrivere policy, creare intenti o risolvere da solo ambiguità. Sinonimi, definizioni, disambiguazioni ed esempi devono essere versionati, revisionabili e testati.
- I comandi del titolare devono essere separati dai messaggi dei clienti. Identità e ruolo derivano da Auth e associazioni verificate, non dal testo del messaggio, da una voce del vocabolario o da output del modello.
- L’assistente deve fare domande concise e utili, raccogliere solo dati necessari, mantenere il contesto della stessa pratica tra messaggi e allegati e lasciare decidere al professionista dove richiesto dalla policy. Negazioni, correzioni, cambi di idea, ambiguità, omonimi, messaggi inoltrati, errori ASR, eventi duplicati e fuori ordine sono casi di test obbligatori.
- Non dichiarare una pratica aperta, un appuntamento fissato, una notifica consegnata o un’azione effettuata senza stato persistito e riscontro del sistema responsabile.

### 8.3 Sicurezza, affidabilità e dati
- Fail closed su policy assente/sconosciuta, identità non verificata, dati obbligatori mancanti, ambiguità, dipendenze non pronte o conferme non verificabili.
- Le conferme del titolare devono essere legate a business, membro, canale, proposta/versione e evento sorgente; devono essere esplicite, non scadute, monouso e consumate nella stessa transazione dell’azione. Fino alla prova del vincolo atomico mantenere ATOMIC_CONFIRMATION_NOT_ENABLED.
- Distinguere idempotenza inbound da consegna outbound. Non promettere exactly-once per provider esterni senza outbox durevole, chiavi d’idempotenza dove supportate e riconciliazione degli esiti ambigui dopo timeout.
- Firma webhook prima del parsing; limiti del body; autenticazione dei servizi; timeout e retry controllati; log minimizzati; nessun errore grezzo o segreto nella risposta cliente. Le prove di firma automatica non attestano che i segreti corretti siano configurati sul servizio reale.
- Verificare isolamento multi-tenant, privilegi, RLS e policy con identità e percorsi d’accesso concreti. RLS abilitata senza policy è un finding da risolvere con policy progettate e testate, non autorizza policy permissive. Non eliminare indici solo perché segnalati inutilizzati; valutare query, carico e vincoli.
- Riconciliare sempre schema e cronologia migrazioni live con fonti SQL versionate autorevoli. Non ricostruire migrazioni da nomi o supposizioni e non riapplicare DDL al live per sbloccare i test.
- Definire privacy, minimizzazione, retention/cancellazione, gestione media, accessi e tracciabilità prima del lancio. Non usare dati reali per test quando sono sufficienti fixture sintetiche.

### 8.4 Architettura, esperienza, business e sostenibilità
- Considerare insieme qualità tecnica, esperienza del professionista/cliente, scalabilità, resilienza, dipendenze, costi completi, privacy, sicurezza, reversibilità e manutenzione futura; introdurre complessità solo quando porta utilità dimostrabile.
- Mantenere chiaro il contratto tra Assistant API e bot WhatsApp; trattarli come unità di rilascio coordinata. Una Preview, una CI verde o un servizio legacy funzionante non prova che le nuove feature siano integrate e distribuite.
- Completare onboarding dell’attività e collegamento Meta/WhatsApp con percorsi espliciti, verifica delle condizioni reali e nessuna promessa di compatibilità non provata. Valutare Meta Cloud API/Coexistence e gestione dei gruppi sulla base di requisiti e limiti ufficiali aggiornati.
- Account & Billing: definire identità/account, verifica WhatsApp/email, piani, attivazione dopo pagamento, rinnovo, cancellazione e portale cliente; non attivare pagamenti o piani a pagamento senza approvazione. Il vincolo Vercel Hobby/non-commerciale deve essere risolto prima del lancio commerciale.
- MultiVocale, gestione pratiche, calendario/appuntamenti, dashboard, policy per settore, vocabolario dinamico, gruppi WhatsApp, privacy/retention e costi Meta + AI + hosting/Redis/storage devono avere stato esplicito nella roadmap, non essere trattati come completati se solo progettati.
- Validare il valore commerciale con evidenze di mercato e test con conversazioni rappresentative. La ricerca dei bisogni deve essere orientata ai reali flussi di lavoro per settore, non limitarsi a chiedere ai tecnici cosa desiderano. Il questionario iniziale (2 risposte) è un segnale esplorativo, non una validazione statistica.

### 8.5 Protocollo di test e chiusura
- Ogni test registra repository, SHA esatto, ambiente, data/ora, scenario, risultato, evidenza e sanitizzazione. PASS solo con esecuzione osservata; BLOCKED e NOT RUN restano tali finché non esiste prova.
- Le suite component-level devono coprire casi positivi e negativi, retry, concorrenza, idempotenza, timeout, payload malformati, autenticazione, permessi e assenza di dipendenze. I test AI devono misurare falsi MATCH, ambiguità, NEW/MATCH, estrazione dei campi e robustezza multisettore senza confondere errori infrastrutturali con errori del modello.
- La chiusura integrata richiede cinque run tracciabili sul medesimo candidato API+bot in staging isolato, dopo il superamento dei prerequisiti di sicurezza e persistenza. Ogni run deve verificare ingresso Meta, autenticazione, API, DB, risposta WhatsApp, deduplica, retry e stato finale; cinque run non sostituiscono la copertura dei casi avversi.
- Dopo ogni ciclo, controllare dati residui e cleanup usando esclusivamente gli ID di test dedicati; non cancellare dati preesistenti. Un rollback di prova o la sintassi valida non dimostrano che il cleanup post-esecuzione funzioni.
- Il rilascio commerciale è NO-GO finché restano bloccanti migrazioni non riconciliate, conferma atomica, persistenza/outbox, policy/RLS e test integrati non eseguiti.

### 8.6 Mappa delle aree che il controllo 360° deve coprire
1. Visione prodotto, casi d’uso, requisiti e decisioni storiche.
2. WhatsApp/Meta: webhook, firme, token, versioni Graph API, numeri/app, invio/ricezione, gruppi e limiti di piattaforma.
3. Bot Python/Render: audio, trascrizione, sintesi, MultiVocale, batching, concorrenza, retry, readiness, log, timeout e stato in memoria.
4. Assistant API/Vercel: autenticazione, readiness, contratti API, classificazione, Resolver, estrazione, policy, risposte e compatibilità tra commit.
5. Supabase/Postgres: migrazioni, schema, RPC, transazioni, privilegi, RLS, indici, dati staging e multi-tenant.
6. Persistenza conversazionale, idempotenza inbound, outbox, invii esterni e riconciliazione degli esiti ambigui.
7. Sicurezza, privacy, retention, segreti, minimizzazione dati e audit.
8. Modelli AI: scelta modelli, prompt, vocabolario, costi, latenza, robustezza e valutazione.
9. Account, onboarding, Meta Embedded Signup/Coexistence, billing e cancellazione.
10. Dashboard, work items, contatti, appuntamenti, comandi titolare, workflow multi-settore e gruppi.
11. Deploy/CI/CD, ambienti, dipendenze, monitoraggio, rollback, costi e limiti dei piani.
12. QA: unit/integration/E2E, casi avversi, test multisettore, cleanup, prove e tracciabilità.
13. Mercato, differenziazione, onboarding utente, costi unitari e sostenibilità commerciale.
14. Documentazione, registro raccomandazioni, roadmap, runbook, matrice release e continuità tra chat.

### 8.7 Stato del consolidamento e limiti
Il registro di continuità storico è un documento lungo (5.076 righe) con decisioni, prove e snapshot temporali. Questa sezione consolida le raccomandazioni permanenti recuperate e le aree di controllo, ma non sostituisce la verifica puntuale di ogni singola affermazione storica. Per evitare di promuovere snapshot obsoleti a stato corrente, ogni dato tecnico va riconfermato contro repository, CI, deployment e Supabase prima di agire. La revisione integrale 360° resta aperta finché ogni area sopra non ha un esito PASS/BLOCKED/NOT RUN con evidenza.



## 9. Verifica di controllo del Libro sacro e stato 360° — 24 ottobre 2026

### Verifiche di questo aggiornamento
- Il presente Libro sacro è stato aggiornato e riletto dopo il consolidamento della sezione 8. Commit di consolidamento: b2e14a32ddc9d838498dddd1bc44a58a0940a325.
- La roadmap master è stata aggiornata con la matrice 360° e la data corretta al 24 ottobre 2026. Commit più recente della roadmap: 1e9a294f4790562d444d2eec55761aca8cd07ba8.
- La lettura read-only del progetto Supabase ha confermato stato ACTIVE_HEALTHY, 15 migrazioni registrate, 15 tabelle pubbliche, zero Edge Functions distribuite, 15 finding RLS-enabled/no-policy e 18 foreign key senza indice di copertura. Non è stato modificato il database.
- La lettura del bot Python ha confermato che sessions, auto_batches, queued_batches e last_audio sono strutture in memoria; Redis coordina deduplica/lock ma non rende durevole il contenuto audio durante restart. Il vincolo single-worker resta finché tale architettura non viene sostituita.
- Le PR #3 (Assistant API), #2 (bot) e #9 (SMS Hook/Bird) restano Draft. La PR #9 non prova una configurazione o un invio SMS reale.
- Le interrogazioni workflow associate ai due commit documentali più recenti non hanno restituito run: pertanto non si attribuisce loro un nuovo PASS CI. I risultati positivi precedenti restano legati ai rispettivi SHA, non vengono trasferiti automaticamente a questi commit documentali.

### Esito
**Libro raccomandazioni: consolidamento aggiornato; audit tecnico 360°: IN CORSO, non chiuso.** La copertura e le raccomandazioni sono state registrate, ma varie aree restano BLOCKED/NOT RUN e richiedono prove concrete. In particolare: riconciliazione delle migrazioni; disegno e test delle policy RLS; conferma atomica; stato conversazionale durevole; outbox e riconciliazione degli invii; verifica di configurazione staging; E2E integrato ripetuto cinque volte; privacy/retention; onboarding, billing, gruppi e costi. Non considerare il progetto pronto al lancio.


## 10. Aggiornamento del controllo tecnico 360° — 24 ottobre 2026

Questa sezione registra le verifiche read-only successive al consolidamento delle raccomandazioni. Non rappresenta un'approvazione al rilascio.

### Evidenze tecniche aggiuntive
- Catalogo terminologico draft, blob `5aa93e3391c10db5b303249f0d4ba54d3aa8d34f`: JSON parsabile, 699 voci; conteggi dichiarati per settore coerenti con le voci effettive; nessuna duplicazione `sector + normalized_term` rilevata; nessuna voce priva delle chiavi strutturali controllate. Solo 120/699 voci hanno definizione, disambiguazione ed esempi non vuoti secondo il controllo automatico di base; tutte le 699 sono ancora `draft`. È controllo strutturale, non approvazione semantica o di esperti.
- Il runtime titolare corrente mantiene il fail-closed ATOMIC_CONFIRMATION_NOT_ENABLED prima di elaborare conferme esplicite. Non abilitare il percorso finché il vincolo atomico non è implementato e provato.
- Il bot corrente usa Meta Graph API v26.0, limita file e batch, ma mantiene in memoria locale sessioni e code audio; il sorgente impone un solo worker Gunicorn fino a quando lo stato audio non diventa durevole. Non dichiarare resistenza ai riavvii.
- Il codice SMS Hook è ancora su branch/PR Draft. Il controllo automatico del sorgente e i test non provano che la funzione sia distribuita, che Bird sia configurato o che un OTP reale sia stato inviato. Supabase continua a riportare zero Edge Functions distribuite.
- Le API GitHub di review non hanno restituito review approvate o thread per PR #2, #3 e #9. Questo non equivale ad approvazione del codice.
- I risultati CI positivi sono riferiti agli SHA/runs documentati; non è stata osservata una nuova esecuzione CI associata agli ultimi commit documentali. Nessun nuovo PASS viene attribuito a tali commit senza un run osservabile.

### Ordine operativo raccomandato
1. Recuperare e riconciliare le migrazioni SQL autorevoli.
2. Mantenere disabilitate le scritture titolare fino alla conferma atomica verificata.
3. Rendere durevoli stato conversazionale/audio e outbox, con riconciliazione esiti ambigui.
4. Progettare e testare policy RLS per ruolo e tenant; non aggiungere policy permissive per eliminare i finding.
5. Preparare staging isolato con app/numero Meta di test, segreti gestiti fuori dal repository e candidato API+bot accoppiato; solo dopo eseguire la matrice E2E e cinque run integrati tracciabili.
6. Portare il catalogo terminologico da bozza a revisione settoriale: 579 voci non hanno contemporaneamente definizione, disambiguazione ed esempi non vuoti secondo il controllo di base. Tutte le voci restano non approvate.
7. Chiudere privacy/retention, onboarding, billing, limiti commerciali hosting, compatibilità Meta, monitoraggio e costi unitari prima del pilot commerciale.

### Stato aggiornato
**Controllo tecnico 360°: IN CORSO. Rilascio: NO-GO.** Questa tornata ha eseguito verifiche read-only e aggiornato la documentazione; non ha modificato codice applicativo, schema/dati live, segreti, provider, deployment, stato delle PR o risorse a pagamento.


### Verifica read-only aggiuntiva dei privilegi Supabase — 24 ottobre 2026
- Query catalogo: tutte le 15 tabelle base public hanno RLS abilitata e zero policy. Aggregato dei grant tabellari: 93 righe di privilegi su 15 tabelle per `service_role`; nessun grant tabellare risultante per `anon` o `authenticated`.
- Per le cinque RPC esaminate (risoluzione titolare, registrazione conferma, commit nota, commit azione calendario, ingest evento WhatsApp), `EXECUTE` risulta negato a `anon` e `authenticated` e concesso a `service_role` e `postgres`.
- Questo riduce il rischio di esposizione diretta tramite i grant controllati, ma non chiude l'audit completo: restano da esaminare grant di schema, viste, sequenze, default privileges, tutte le altre funzioni, esposizione PostgREST, gestione della service key e autorizzazione applicativa. Le tabelle senza policy rimangono un blocco per qualsiasi accesso client previsto.
- Tutte le query eseguite sono state SELECT-only; nessuna scrittura SQL o modifica del database.


### Inventario PR aggiornato — 24 ottobre 2026
La ricerca delle PR aperte ha trovato anche `VocalFlash/vocalflash` PR #1, oltre alle PR #3 e #9, e `VocalFlash/vocalflash-bot` PR #2. PR #1 riguarda il solo `package.json`/modalità ES module e documenta un test Preview isolato; descrive anche una credenziale Supabase che restituisce HTTP 401 in un ambiente Preview usato per il questionario. Non assumere che quella credenziale sia la chiave dell'Assistant API: occorre tracciare esattamente deployment e progetto prima di intervenire. Prima di qualsiasi merge, verificare SHA base/head, checks, conflitti e se la modifica di PR #1 è già inclusa nella branch di PR #3. Le API di review non hanno restituito review inviate per queste PR; nessuna approvazione viene presunta.


### Configurazione staging Supabase — snapshot aggiornato 24 ottobre 2026
Query SELECT-only hanno aggiornato lo snapshot della configurazione, che non coincide più con quello storico del 22 ottobre: 1 attività con settore staging idraulica/manutenzione; 1 canale WhatsApp attivo con external account ID presente (valore non letto) ma address non popolato; **0 business_members**; 2 workflow (uno test generico inattivo, uno intervento/manutenzione attivo con un campo richiesto); 1 policy attiva per creazione pratica in modalità `confirm`; 14 termini aziendali attivi; 1 work item, 4 work events e 2 routing decisions. Nessun contenuto personale o identificativo esterno è stato estratto e nessun dato è stato modificato. Il membro titolare verificato manca: non creare identità fittizie. La policy `confirm` non autorizza a bypassare `ATOMIC_CONFIRMATION_NOT_ENABLED`.

## Verifica operativa aggiuntiva — 24 ottobre 2026 (aggiornamento successivo)

### Catalogo terminologico — stato esatto
- Verificato il JSON della branch: 699 voci in 7 settori; 147 voci complete secondo il criterio strutturale corrente (sinonimi, definizione, disambiguazione, esempi, termini confondibili, fonte, nota revisione, stato arricchimento e review_status draft); 552 incomplete; zero duplicati di chiave settore + termine canonico normalizzato.
- La CI run `40118513216`, sul commit `ba58fa9bc75bb89ce6ec0d4da6764525812a86d5`, è stata ricontrollata: tutti e 5 i job sono `completed/success`; nei job è riuscito anche il passo di validazione del catalogo draft e il gruppo di test focalizzati. Questo esito si riferisce a quel commit, non ai commit successivi.
- È stato poi arricchito un batch di 15 termini del settore `construction_site` (cartongesso, laterizio, blocchi di cemento, acciaio per armatura, rete elettrosaldata, trave, pilastro, solaio, isolante termico, isolante acustico, rasante, primer, stucco, piastrella, gres porcellanato). Commit: `ab448b7306cd33a5f925b2ec71533477199ee53c`.
- Le voci restano tutte `review_status: draft` e `enrichment_status: content_enriched_needs_domain_review`; nessuna è approvata per uso runtime. La nuova CI di questo commit non è stata ancora verificata come completata; non trasferire il PASS della run precedente al nuovo commit.

### Contratto bot → Assistant API — revisione sorgente, non E2E
- Riletti i file effettivi della branch `assistant-conversation-photo-v1`: bot `customer_text_bridge.py` e `app.py`; API `api/v1/assistant.js`.
- Il bridge invia POST all'URL configurato in `VOCALFLASH_ASSISTANT_API_URL`, header `X-VocalFlash-Assistant-Key`, payload `external_account_id`, `sender_wa_id`, `external_message_id`, `normalized_text`, `occurred_at`, `content_type`; timeout Requests `(10, 120)`. L'API valida la stessa famiglia di header tramite `VOCALFLASH_ASSISTANT_API_KEYS`, richiede i quattro campi principali, e restituisce `ok:true` con `assistant_message` separato quando il mittente è un cliente.
- Il bridge richiede `data.ok is True` e restituisce il JSON al chiamante; il solo file bridge non invia una risposta WhatsApp. Non è ancora attestato da questa lettura che ogni percorso del webhook consumi `assistant_message` e lo invii una sola volta.
- Rischio/controllo ancora aperto: il timeout di 120 secondi può lasciare un esito remoto ambiguo; il payload contiene un ID messaggio esterno utile alla deduplicazione, ma questa lettura non prova l'idempotenza end-to-end dell'intera catena né la riconciliazione di una risposta WhatsApp fallita. Nessun messaggio reale inviato; nessun test Meta→bot→API→Supabase→WhatsApp eseguito.
- Le due PR restano Draft. Nessun merge, deploy in produzione o modifica del database live.

### Release gate invariati
- Restano bloccanti: provenienza autorevole delle 15 migrazioni SQL live; RLS senza policy sulle 15 tabelle; 18 FK senza indice di copertura; membro titolare verificato assente; conferma atomica disabilitata (`ATOMIC_CONFIRMATION_NOT_ENABLED`); stato conversazione/outbox durevoli e riconciliazione invii non completati; E2E staging integrato non eseguito.



## 2026-10-24 — Riesame coordinato e criterio primario di valore

### CI verificata sull'head corrente
- Assistant API/catalogo: run [40118965684](https://github.com/VocalFlash/vocalflash/actions/runs/40118965684), commit `ab448b7306cd33a5f925b2ec71533477199ee53c`: 5/5 job success; in ogni job sono passati validator del catalogo e test focalizzati.
- Libro sacro/Assistant API: run [40119000634](https://github.com/VocalFlash/vocalflash/actions/runs/40119000634), commit `d9768031ac6e4990bd08b0630c867786cdec6b2d`: 5/5 job success, inclusi validator e test focalizzati.
- Bot: run [40113909039](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40113909039), commit `7ad05b42122c939a5669c2fdceeae604185aec09`: 5/5 job success, inclusi compilazione dei moduli e test unitari del bot.
- Questi sono risultati CI specifici per i commit indicati; non sono test E2E né prove che i rami siano distribuiti. PR #2 e #3 restano Draft, aperte e non integrate.

### Tabella principale per decidere cosa sviluppare
La tabella seguente diventa il criterio primario di priorità e accettazione del prodotto. La roadmap, il catalogo terminologico e le attività tecniche sono subordinati a essa: una funzione non merita priorità solo perché è tecnicamente interessante o aumenta il numero di voci del vocabolario. Deve migliorare un esito concreto per cliente o titolare ed essere verificabile.

| Capacità | Esigenza reale dell'utente | Valore da dimostrare | Prova minima richiesta | Stato corrente / gate |
|---|---|---|---|---|
| Sintesi di vocali e messaggi | Capire rapidamente cosa conta senza rileggere/ascoltare tutto | Sintesi fedele, breve, orientata a fatti e azioni; niente trascrizione completa automatica | Corpus realistico italiano con omissioni critiche, numeri, nomi, negazioni e terminologia; confronto con input originale | Flusso audio storico funzionante; qualità sul percorso corrente da ricontrollare |
| Classificazione della richiesta | Capire quale problema o richiesta viene posta | Instradamento corretto e pochi falsi positivi; ambiguità esplicitata | Batteria multi-settore realistica, inclusi casi ambigui e non azionabili | Guardrail e test focalizzati presenti; valutazione model-backed ampia da eseguire |
| Estrazione dei dati | Non perdere luogo, problema, disponibilità e altri dati essenziali | Campi supportati da evidenze, provenienza preservata, nessun dettaglio inventato | Casi positivi/negativi con dati mancanti, contraddittori e inferiti | Componenti implementati e testati in CI; E2E non provato |
| Domande mirate | Evitare scambi inutili per completare una richiesta | Chiedere soltanto i campi mancanti/ambigui e mantenere quanto già raccolto | Scenari multi-turno con riavvio, messaggi duplicati e contesti distinti | Stato multi-turno durevole non implementato |
| Vocabolario professionale | Capire termini tecnici, sinonimi, varianti colloquiali e riconoscimento vocale imperfetto | Ridurre errori di interpretazione senza creare intenti o autorizzazioni | Valutazione prima/dopo su casi reali anonimizzati e controesempi; revisione di dominio | 699 voci; 147 strutturalmente complete, 552 incomplete; tutte non approvate restano draft |
| Contesto persistente della richiesta | Riprendere la stessa pratica senza mescolare clienti o richieste | Continuità affidabile dopo restart e isolamento tenant | Test multi-turno, concorrenza, scadenza, restart e messaggi fuori ordine | Disegnato/parziale; gate di persistenza e percorso SQL sicuro aperti |
| Policy e conferme | Evitare azioni non autorizzate o basate su dati incompleti | Nessuna scrittura se mancano identità, dati, policy o conferma atomica valida | Replay, scadenza, doppia conferma concorrente, policy malformata e atomicità | Fail-closed; conferma atomica disabilitata |
| Risposta WhatsApp al cliente | Ricevere una risposta coerente e sapere il passo successivo | Una risposta utile, non duplicata, con esito dell'invio gestito correttamente | Test contratto API-bot e staging E2E con duplicati, timeout e riconciliazione | Contratto unitario parzialmente coperto; nessun E2E Meta→bot→API→Supabase→WhatsApp |

**Regola di priorità:** ogni nuova attività deve dichiarare (1) la riga della tabella che migliora, (2) l'utente e il problema concreto, (3) la metrica/prova di accettazione, (4) i rischi e i blocchi, (5) il costo/effetto operativo. Se non è possibile indicare un beneficio verificabile, l'attività resta esplorativa e non supera il lavoro necessario a dimostrarlo. Il catalogo non è il prodotto e la completezza strutturale non è prova di valore semantico.

### Revisione statica del contratto bot ↔ Assistant API
- Sull'head bot PR #2, `app_customer.py` inoltra all'Assistant API i messaggi testuali ordinari; i comandi MultiVocale e i messaggi audio seguono il percorso MultiVocale/legacy. Quindi il nuovo workflow operativo cliente non è ancora dimostrato per i vocali: questa è una lacuna funzionale rispetto alla visione “dal vocale all'azione”, non un test fallito.
- Il bridge inoltra `external_account_id`, `sender_wa_id`, `external_message_id`, testo normalizzato, timestamp e tipo contenuto; autentica con `X-VocalFlash-Assistant-Key`, timeout `(10,120)`, e richiede `ok === true`.
- L'API ritorna `assistant_message` per il percorso customer e il bot invia soltanto quel campo, con guard Redis at-most-once. Se il campo è vuoto/mancante, il bot attualmente non invia una risposta e non solleva un errore esplicito: aggiungere un test e una gestione fail-closed/diagnosticabile prima del pilot, senza retry ciechi in caso di esito Meta ambiguo.
- Il timeout di 120 secondi può lasciare incerto l'esito lato bot; la deduplica dell'invio evita doppie risposte ma non sostituisce outbox durevole e riconciliazione.
- Revisione effettuata sui file del ramo corretto e in sola lettura; nessun invio WhatsApp reale, nessuna modifica al database live, nessun merge o deploy eseguito.

### Ricerca SQL e blocchi
La ricerca nei repository accessibili non ha trovato una fonte SQL autorevole completa per le 15 migrazioni registrate nel database live. Non ricostruire migrazioni a intuito. Restano aperti i gate già elencati: provenienza SQL, RLS/policy, indici FK, identità titolare verificata, conferma atomica, persistenza/outbox/reconciliation e staging E2E.
