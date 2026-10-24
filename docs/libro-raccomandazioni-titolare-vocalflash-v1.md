# VocalFlash — Libro delle raccomandazioni e dei vincoli del titolare v1

**Stato:** registro operativo delle raccomandazioni espresse dal titolare e delle regole di collaborazione conseguenti.  
**Aggiornato:** 24 ottobre 2026  
**Uso:** complemento al Libro sacro operativo. In caso di conflitto tecnico, verificare la decisione più recente e aggiornare entrambi i documenti; non reinterpretare una raccomandazione come autorizzazione a costi, deploy o modifiche live.

## 1. Metodo di collaborazione obbligatorio

1. Prima di proporre modifiche, rileggere lo stato più recente del Libro sacro, della roadmap, delle PR e dei test già eseguiti.
2. Separare esplicitamente: **Già fatto/testato**, **Progettato**, **Da fare**, **Prossimo passo**.
3. Non affermare che un test sia passato se non è stato realmente eseguito sul commit/versione pertinente.
4. Distinguere revisione statica, test locale, CI, Preview, staging integration/E2E e produzione.
5. Lavorare in autonomia sui controlli, analisi, test e documentazione che non richiedono costi o autorizzazioni esterne.
6. Non fermarsi ad attendere un aggiornamento del titolare per attività già autorizzate e a basso rischio. Continuare sulle altre attività autonome mentre un gate è in attesa.
7. Fermarsi e chiedere autorizzazione esplicita prima di: merge; deploy in produzione; modifiche a schema o dati live; rotazione o modifica di segreti/env; acquisti, risorse a pagamento o costi ricorrenti; invio di SMS fatturabili; test su clienti reali o contatti esterni.
8. Non esporre in chat il codice completo durante la fase corrente, salvo nuova richiesta esplicita. Quando il codice viene richiesto in futuro, fornire indicazioni coerenti con la versione e con lo stato effettivo del repository.
9. Essere proattivi, scrupolosi e critici: verificare prima e dopo ogni modifica significativa, evitare indicazioni approssimative o contraddittorie.
10. Non rivolgersi al titolare per nome.

## 2. Documentazione e memoria di progetto

- Il **Libro sacro operativo** è la fonte di verità sullo stato tecnico, le decisioni, i guardrail e i risultati verificati.
- La **roadmap master** mantiene architettura, priorità, dipendenze, rischi e release gate.
- Questo **Libro delle raccomandazioni** conserva le regole di collaborazione e le preferenze espresse dal titolare, non soltanto lo stato corrente del codice.
- Aggiornare Libro sacro e roadmap dopo avanzamenti significativi; aggiornare questo libro quando emergono nuove raccomandazioni o quando una regola cambia.
- Indicare sempre data, branch/commit o PR quando rilevanti. Non presentare una nota documentale come prova di esecuzione tecnica.
- Non inventare migrazioni, tabelle, identità, dati, autorizzazioni o risultati mancanti.

## 3. Principi di prodotto VocalFlash

1. VocalFlash è un **assistente WhatsApp che porta dal vocale all'azione**, non un semplice trascrittore.
2. Il valore principale è capire la richiesta, conservarne i dettagli utili, sintetizzarla, individuare dati mancanti e proporre il passo successivo.
3. Non inviare automaticamente la trascrizione completa se non richiesta: la sintesi e i punti operativi sono il risultato primario.
4. Il sistema deve comprendere testo, vocali e, quando supportato e previsto, foto/media; i dettagli rilevanti devono essere preservati senza inventare informazioni.
5. Deve riconoscere il settore in modo contestuale e mantenere il lessico professionale. Il vocabolario è un supporto lessicale, non un'autorità che determina intenzione o autorizza azioni.
6. Supportare più settori (tra cui manutenzione/idraulica, edilizia/cantiere, immobiliare, mediazione finanziaria, legale, medico e generico). Il settore farmaceutico non va incluso nel catalogo iniziale concordato.
7. Progettare per bisogni operativi reali e casi d'uso di business, non solo per una demo di trascrizione o per questionari.
8. Considerare l'assistente sia lato cliente sia lato titolare: raccogliere i dettagli della richiesta e offrire al titolare comandi e controllo sul flusso.
9. Non dichiarare aperta una pratica, assegnato un intervento o completata un'azione finché il risultato persistente non è confermato.

## 4. Vocabolario terminologico professionale

- Il catalogo iniziale deve coprire termini professionali, sinonimi, varianti colloquiali, persone/aziende/clienti, luoghi/strade e prodotti quando appropriato e autorizzato.
- Ogni voce dovrebbe avere termine canonico, settore, categoria, sinonimi, definizione, disambiguazione, esempi e termini confondibili.
- Le voci devono evitare di trasformare un sintomo in diagnosi, una menzione in autorizzazione o un dato mancante in un'inferenza.
- Evitare duplicati all'interno dello stesso settore; termini uguali in settori diversi possono avere significati distinti e vanno disambiguati per contesto.
- Ogni voce resta `draft` fino a revisione di dominio. L'arricchimento editoriale o il superamento del validator non equivale a revisione da parte di un esperto.
- Il catalogo non deve diventare runtime context approvato finché non sono superati i gate di qualità, revisione e attivazione.

## 5. Sicurezza delle pratiche e conferma del titolare

- Fail-closed su dati obbligatori mancanti, ambigui, malformati o non supportati.
- Separare estrazione dei dati, classificazione dell'intento, scelta del workflow, policy, autorizzazione e scrittura persistente.
- Richiedere conferma esplicita del titolare prima di una scrittura che la policy definisce soggetta a conferma.
- La conferma deve essere atomica, riferita a una specifica pratica/versione e protetta da replay, concorrenza e doppio clic. Non autorizzare una scrittura con una conferma obsoleta o relativa a dati cambiati.
- Nessuna voce di vocabolario, output LLM o classificazione può aggirare le policy.
- Se non è possibile verificare il risultato di una scrittura, comunicare in modo prudente e non dichiarare che la pratica è stata creata.

## 6. Persistenza conversazionale e MultiVocale

- Il contesto multi-turno deve essere persistente e isolato per azienda, contatto/conversazione e workflow; non affidarsi a sole strutture in memoria di processo.
- Preservare il contesto utile dopo riavvii e deployment, senza confondere richieste distinte o mescolare dati di aziende diverse.
- Proteggere gli aggiornamenti concorrenti con versionamento/compare-and-set, lease e fencing token quando appropriato; un lock locale non protegge da side effect esterni.
- MultiVocale deve accumulare correttamente i vocali di un batch, mantenere il primo vocale quando vengono aggiunti successivi, gestire eventi quasi simultanei e offrire un esito comprensibile.
- Per gli invii WhatsApp usare un outbox durevole e una traccia degli attempt; correlare gli status callback autenticati con l'ID messaggio del provider.
- Distinguere accettato dal provider, consegnato e letto. Non usare questi stati come sinonimi.
- Se l'esito dell'invio è ambiguo, registrare `outcome_unknown` e non reinviare automaticamente senza idempotenza provider documentata o riconciliazione autorevole.
- Non promettere exactly-once quando il provider e il confine HTTP/database non consentono una garanzia atomica.

## 7. Costi, account e privacy

- Tenere distinti i consumi e i percorsi commerciali di VocalFlash WhatsApp e VocalFlash API.
- Prima di avviare risorse a pagamento, mostrare stima, unità di costo, orizzonte temporale e voci escluse; ottenere approvazione esplicita.
- Per Supabase, Bird, Stripe e altri fornitori, verificare documentazione e prezzi correnti prima di una decisione.
- Non condividere password, OTP, chiavi API o token in chat, issue, log o documentazione versionata.
- Non creare identità o membri aziendali fittizi per superare un blocco di onboarding.
- Prima del lancio verificare privacy notice, titolarità, basi giuridiche, retention/cancellazione, responsabili/sub-responsabili, trasferimenti e obblighi contrattuali con revisione qualificata.
- La verifica del telefono non basta da sola ad assegnare un ruolo owner: l'associazione all'azienda deve avvenire tramite un percorso autorizzato e verificato.

## 8. Test, release e pilot

- Eseguire test mirati dopo modifiche e regressioni prima di dichiarare il lavoro completo.
- Controllare CI e Preview sull'head esatto; un deploy Preview non dimostra l'esito di un test E2E né la correttezza della produzione.
- Testare failure boundary: timeout, crash, retry, webhook duplicati/fuori ordine, due worker concorrenti, stato scaduto e provider response persa.
- Preferire un pilot controllato con 3–5 potenziali clienti prima di estendere la gestione multi-azienda in modo prematuro.
- Non testare su clienti reali o inviare loro messaggi senza approvazione esplicita.
- Conservare evidenza verificabile dei test: commit SHA, workflow run, job, ambiente e limiti del test.

## 9. Lista di controllo prima di ogni modifica significativa

- [ ] Ho riletto Libro sacro, roadmap e decisioni/PR correlate?
- [ ] Ho identificato cosa è già stato fatto e testato senza confonderlo con il progettato?
- [ ] La modifica rispetta fail-closed, privacy e isolamento per azienda/conversazione?
- [ ] Ho controllato concorrenza, crash/restart, timeout, retry e duplicati?
- [ ] Ho evitato costi, segreti, dati live e produzione senza autorizzazione?
- [ ] Ho eseguito i test che dichiaro, sull'esatto commit?
- [ ] Ho aggiornato Libro sacro e roadmap dopo l'avanzamento?
- [ ] Se è emersa una raccomandazione nuova, ho aggiornato anche questo libro?

## 10. Stato del documento

Questo documento raccoglie le raccomandazioni note al 24 ottobre 2026. È una baseline operativa viva: va aggiornata quando il titolare aggiunge o modifica indicazioni. Non sostituisce le policy tecniche, i controlli di sicurezza o l'approvazione esplicita richiesta per le azioni con impatto esterno.
