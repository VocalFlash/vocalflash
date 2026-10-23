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
- **Ultimo preventivo disponibile:** $0.01344/ora, circa $9.68 per 30 giorni di funzionamento continuo. Il totale effettivo può variare; ricalcolare prima della creazione.
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
- **Avanzamento documentale del 23/10/2026:** creato [catalogo professionale draft v1](https://github.com/VocalFlash/vocalflash/blob/assistant-conversation-photo-v1/docs/professional-terminology-catalog-v1-draft.json) con **699 voci candidate** distribuite nei settori iniziali: idraulica/manutenzione, edilizia/cantiere, immobiliare, mediazione finanziaria, legale, medico e generico. Sono voci d'indice in stato `draft`, non un dizionario pronto per la produzione: sinonimi, definizioni, disambiguazioni ed esempi sono intenzionalmente da completare e revisionare. Non importare automaticamente queste voci nel database né abilitarle nel runtime.
- **Stato:** DA COSTRUIRE E VALIDARE; al momento ci sono 14 termini sintetici attivi nel solo fixture staging, con metadati estesi in stato draft.
- **Obiettivo minimo di prodotto:** catalogo iniziale di **almeno 300 voci professionali curate**, suddivise per settore e per azienda, non 300 sinonimi duplicati. La prima tranche deve coprire idraulica/manutenzione, edilizia/cantiere, immobiliare, mediazione finanziaria, legale, medico e linguaggio generico. Il settore farmaceutico resta escluso dal catalogo iniziale.
- **Qualità minima per ogni voce, ove applicabile:** termine canonico, forma normalizzata, sinonimi/varianti regionali, settore e categoria, definizione breve, contesto d'uso, termini confondibili, esempi positivi e controesempi, fonte/nota di revisione e stato draft/reviewed/active.
- **Regola di sicurezza:** le voci non possono creare intenti, compilare campi obbligatori senza evidenza, scegliere workflow, diagnosticare o autorizzare azioni. Le voci non revisionate restano draft e non vengono promosse a produzione.
- **Cosa serve al titolare:** nessun intervento immediato per redigere la bozza; prima dell'attivazione per un pilota, un responsabile reale di dominio deve revisionare i termini del proprio settore. Il lavoro tecnico di redazione e test prosegue senza costi esterni.

### D6 — Approvazione di un'attività pilota reale
- **Stato:** BLOCCATO prima di qualsiasi uso operativo con clienti reali.
- **Cosa serve:** identificare un'attività reale e un responsabile autorizzato che approvino settore, workflow, campi obbligatori, messaggi al cliente, policy e termini professionali. Il fixture “VocalFlash — STAGING TEST” resta sintetico e non equivale a un cliente pilota.
- **Link di lavoro:** [PR Assistant API #3](https://github.com/VocalFlash/vocalflash/pull/3) · [PR Bot WhatsApp #2](https://github.com/VocalFlash/vocalflash-bot/pull/2) · [Libro sacro operativo](https://github.com/VocalFlash/vocalflash/blob/assistant-conversation-photo-v1/docs/libro-sacro-vocalflash-operational-baseline-v1.md).

### Registro sintetico delle decisioni in attesa
1. **Supabase branch:** sì/no, dopo ricalcolo del preventivo.
2. **Bird SMS:** sì/no, solo consumo pubblicato; fermarsi se emergono costi accessori non approvati.
3. **Pagamenti:** carte + wallet oppure anche SEPA Direct Debit; piani/prezzi e cadenza da definire prima dell'implementazione.
4. **Attività pilota:** da individuare e far approvare prima di usare dati o clienti reali.

Non richiedono un'autorizzazione economica e quindi proseguono in autonomia: revisione del codice e dei test, definizione del catalogo terminologico draft da almeno 300 voci, progettazione della persistenza e dell'outbox, test fail-closed, documentazione, revisione delle migrazioni in sola lettura e verifiche CI/Preview. Nessuna di queste attività autorizza modifiche allo schema live, merge o deploy in produzione.



## 11. Ultimo aggiornamento documentale — 23 ottobre 2026

- Registro delle decisioni del titolare aggiunto: Supabase development branch, SMS Bird, metodi di pagamento, identità Auth reale, approvazione del pilota e revisione del dizionario.
- Creato il [catalogo professionale draft v1](https://github.com/VocalFlash/vocalflash/blob/assistant-conversation-photo-v1/docs/professional-terminology-catalog-v1-draft.json): 699 voci candidate, tutte in stato draft, distribuite per settore. Il numero è un inventario iniziale, non certifica che le voci abbiano già sinonimi, definizioni, disambiguazioni ed esempi completi. Nessuna importazione massiva nel database è autorizzata.
- Aggiornata la roadmap master con i gate di qualità del catalogo e il registro delle decisioni.
- Verifica GitHub sul codice applicativo `9bbb304e9ddd15bd80e2fe7cbf803286e7637cf0`: status Vercel **success**. I successivi commit sono documentali; non è stato eseguito un nuovo test end-to-end.
- Non è stata creata una Supabase development branch, non è stato configurato Bird o Stripe, non è stato creato un utente/membro fittizio e non è stata modificata la produzione.


## 12. Catalog quality and validation — 23 October 2026

- The catalog remains an inventory of **699 draft entries** across the seven intended scopes, with no pharmaceutical sector and no duplicate `(sector, normalized_term)` pairs found in the current file.
- A total of **70 entries across the initial sectors** now have preliminary synonyms, definitions, disambiguation notes, examples and confusable terms, including the first 40 plumbing/maintenance entries. They remain `draft` and explicitly require domain-owner review; this is editorial enrichment, not expert approval.
- Added `scripts/validate-professional-terminology-catalog.mjs` and wired it into `.github/workflows/customer-assistant-tests.yml`. The validator checks the minimum count, required sectors, exclusion of pharmacy, uniqueness, draft-only status and completeness of the enriched batch.
- A read of the current catalog file and an equivalent structural check found 699 unique entries, 70 enriched entries, 0 structural issues, and no pharmacy sector. **This is a direct content audit, not yet a reported GitHub Actions pass.** The latest Vercel status for the commit adding the CI step was still `pending` at the last check; do not report a green result until the actual CI/Preview status is confirmed.
- The validator intentionally does not certify professional correctness, legal/medical suitability, synonym quality, or production readiness. Those require expert review and sector-specific semantic tests.

- The validator's enrichment threshold was raised from 30 to 70 after the additional sector batches were added. The current file was re-audited in read-only mode: 699 entries, 699 unique sector-scoped terms, 70 enriched entries with all required draft metadata, no structural issues. GitHub Actions/Preview still needs its own status confirmation.
