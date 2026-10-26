# VocalFlash — Libro canonico delle raccomandazioni del titolare v2

**Aggiornato:** 24 ottobre 2026  
**Branch:** `assistant-conversation-photo-v1`  
**Stato:** registro vivo delle raccomandazioni, decisioni di prodotto, vincoli di collaborazione e release guardrail raccolti dalle conversazioni disponibili.  
**Scopo:** preservare le indicazioni del titolare attraverso le chat, impedire regressioni e separare sempre decisioni, progetti e fatti verificati.

> Questo registro non è una prova di implementazione né un'autorizzazione operativa. Se due indicazioni sembrano in conflitto, applicare la decisione esplicita più recente e conservare il contesto della decisione precedente. Non trasformare mai un “procedi” generale in autorizzazione a costi, produzione, contatti esterni o cambiamenti irreversibili.



- Revisione statica storage: l'azione `health` prima restituiva `storage:true` dopo la sola creazione di una signed-upload URL, senza eseguire upload/download reali. La risposta è stata resa più precisa (`storage_control:true`, `signed_upload_url_creation:true`) nel commit `6b9cb7c8c38f51c4b22baf00f8ccaace05509ccb`. CI GitHub Actions run `40234797459` (`Assistant Customer Pipeline Tests`) ha completato con successo tutti e 5 i job della matrice, inclusi i test mirati. Questo prova la suite automatizzata sul commit, non un round-trip Supabase reale: il gate storage E2E resta aperto.

## 1. Regole canoniche di collaborazione

1. **Prima leggere, poi agire.** Prima di ogni intervento rileggere Libro sacro, roadmap master, questo registro, PR/issue, stato del branch e risultati dei test pertinenti.
2. **Distinguere gli stati.** Ogni aggiornamento deve separare: **Già fatto/testato**, **Progettato**, **Da fare/bloccato**, **Prossimo passo**. Quando serve, distinguere anche implementato, testato, non iniziato e non verificabile.
3. **Nessuna affermazione senza evidenza.** Non dire “testato”, “risolto”, “pronto” o “completato” senza prova sul commit e sull'ambiente pertinenti. Una review statica non è un test; CI verde non prova l'E2E; Preview READY non prova la correttezza semantica né la produzione.
4. **Lavorare in autonomia sui task sicuri.** Continuare analisi, verifiche read-only, test senza impatto esterno e documentazione già autorizzati, senza attendere inutilmente il titolare. Se un'attività è bloccata da costo, credenziali, identità reale o rischio esterno, continuare sulle altre attività indipendenti.
5. **Autorizzazione esplicita per le azioni protette.** Fermarsi prima di merge, deploy in produzione, cambi di schema o dati live, modifiche a segreti/env, configurazioni Meta/Render reali, acquisti, risorse a pagamento o ricorrenti, SMS fatturabili, contatti/test con clienti reali e altre azioni esterne irreversibili.
6. **Non esporre il codice completo in chat nella fase corrente.** Dare aggiornamenti e risultati, non blocchi di codice integrali, salvo richiesta esplicita successiva. Non usare file scaricabili come sostituto di una verifica tecnica.
7. **Precisione e critica costruttiva.** Verificare prima e dopo le modifiche, cercare controprove, assunzioni fragili, regressioni, duplicazioni e complessità inutile. Non assecondare un'ipotesi se i dati la contraddicono.
8. **Risposte efficienti.** Preferire spiegazioni concise e comprensibili, ma abbastanza complete da chiarire stato, evidenza, rischio e decisione richiesta. Spiegare perché un passo è necessario e proporre un passo alla volta quando l'utente deve intervenire.
9. **Niente identità o dati inventati.** Non inventare UUID, account, membri aziendali, numeri, autorizzazioni, risultati, migrazioni, record, conferme o dati originali.
10. **Non rivolgersi al titolare per nome.**
11. **Fonti primarie e aggiornate.** Per API, prezzi, policy e provider che cambiano, controllare documentazione ufficiale corrente prima di prendere decisioni.
12. **Registro ciclico e riesame.** Mantenere, dove utile, un registro sintetico numerato di cicli, proposte, evidenze, obiezioni ed esiti. Ogni 10 cicli effettuare una revisione critica complessiva, cercando evidenze contrarie, conclusioni fragili e duplicazioni. Evitare controlli ripetitivi che non aggiungono nuove evidenze.
13. **Monitoraggio senza duplicazioni.** Per gli avvisi/monitoraggi Meta, non creare notifiche o verifiche duplicate se esiste già un controllo equivalente.
14. **CI senza duplicazioni.** Evitare trigger `push` e `pull_request` sovrapposti sullo stesso commit quando eseguono gli stessi test; usare una fonte primaria per la PR, concorrenza per cancellare run obsoleti e un trigger manuale quando utile. Verificare che la riduzione delle notifiche non elimini copertura necessaria.
15. **Preservare il lavoro funzionante.** Partire dalla versione realmente distribuita o dall'ultimo stato noto; non sovrascrivere funzioni funzionanti senza motivo e test. Per la sintesi vocale, validare prima la base V4 e poi ampliare il vocabolario, senza confondere il piano con l'avvenuta esecuzione.

## 2. Registro canonico dinamico delle raccomandazioni

Questo elenco è **dinamico**, non una checklist immutabile:
- rimuovere dal registro operativo i punti effettivamente chiusi, conservando la loro evidenza nello storico/Libro sacro;
- aggiungere nuove raccomandazioni quando emergono;
- marcare esplicitamente come **sospesi** i punti non attivi o in attesa di una decisione;
- non mantenere punti chiusi solo per abitudine e non dichiarare chiuso un punto sulla base di un piano;
- quando una raccomandazione viene modificata, registrare l'override più recente senza cancellare il motivo storico della decisione precedente.

## 3. Gerarchia documentale

- **Libro sacro operativo:** fonte di verità su stato tecnico, decisioni, guardrail, prove e risultati verificati.
- **Roadmap master:** architettura, priorità, dipendenze, rischi, milestone e gate.
- **Questo Libro delle raccomandazioni:** indicazioni del titolare, metodo di lavoro, preferenze, vincoli e override nel tempo.
- **Issue e PR:** lavoro tracciabile, motivazioni, test, blocchi e decisioni puntuali.

Dopo un avanzamento significativo aggiornare Libro sacro e roadmap; aggiornare questo registro quando emerge una nuova raccomandazione o un override. Ogni aggiornamento documentale deve riportare data e riferimenti pertinenti. La documentazione non sostituisce una prova di esecuzione.

## 4. Visione e requisiti del prodotto

1. VocalFlash è un **assistente WhatsApp “dal vocale all'azione”**, non un semplice servizio di trascrizione.
2. Il valore principale è capire la richiesta, sintetizzare i punti salienti, conservare i dettagli utili, individuare ciò che manca o è ambiguo e proporre il passo operativo successivo.
3. Non inviare automaticamente la trascrizione completa se non richiesta: la sintesi utile e i punti operativi sono il risultato primario.
4. Supportare messaggi testuali, vocali e, quando il percorso è progettato e implementato, foto/media. Non inventare dettagli che non siano supportati dalle fonti.
5. L'assistente deve aiutare sia chi scrive (cliente/contatto) sia il titolare dell'attività. Deve raccogliere le informazioni necessarie, porre domande mirate e consentire al titolare di impartire comandi e mantenere il controllo.
6. Individuare esigenze di business reali per settore, non limitarsi a demo tecniche o questionari. Usare ricerca e casi operativi per capire dove l'assistente risparmia tempo, evita perdite di informazioni e rende più affidabile il seguito delle richieste.
7. Mantenere una visione **multi-settore**: manutenzione/idraulica, edilizia/cantiere, immobiliare, mediazione finanziaria, legale, medico e generico sono esempi già discussi. **Escludere il settore farmaceutico dal catalogo iniziale concordato**; non reintrodurlo come esempio iniziale senza una nuova decisione.
8. Riconoscere il settore dal contesto, ma chiedere chiarimenti quando non è possibile classificarlo in modo affidabile.
9. Una richiesta ordinaria di guasto/intervento deve aprire una pratica solo quando workflow, campi obbligatori, policy, autorizzazione e scrittura persistente lo consentono.
10. Non dichiarare una pratica aperta, un intervento assegnato, un messaggio consegnato o un'azione completata finché l'esito non è confermato dallo stato persistente o dal provider autorevole appropriato.
11. Separare consumi, account e percorsi commerciali di VocalFlash WhatsApp da quelli di VocalFlash API.

## 5. Qualità della sintesi e conservazione delle informazioni

- La sintesi deve essere utile, fedele, concisa e orientata alle azioni, senza perdere elementi operativi importanti.
- Preservare i dati originali e la loro provenienza; non sovrascrivere o “normalizzare” silenziosamente il contenuto originario. Distinguere dato esplicito, dato normalizzato, proposta, inferenza e dato mancante.
- Non trasformare sintomi in diagnosi, menzioni in autorizzazioni o supposizioni in fatti.
- Conservare il contesto utile della stessa pratica tra messaggi successivi, senza mescolare conversazioni, clienti o aziende.
- Quando la richiesta non è completa, porre domande mirate sui soli campi mancanti/ambigui e mantenere ciò che è già stato acquisito.
- Non esporre automaticamente tutta la trascrizione; mantenere disponibile la possibilità di consultare i contenuti originari secondo le regole di privacy e retention.
- Valutare la qualità della sintesi con casi realistici e controesempi: omissioni critiche, dettagli inventati, terminologia, ambiguità, richieste composte e dati contraddittori.

## 6. Vocabolario terminologico professionale

1. Costruire un vocabolario che migliori riconoscimento e sintesi mantenendo il linguaggio professionale e le varianti colloquiali.
2. Ogni voce, quando applicabile, include termine canonico, settore, categoria, sinonimi/varianti, definizione, disambiguazione, esempi, termini confondibili e provenienza/versione.
3. Gestire termini professionali, marchi/prodotti, nomi di persone/aziende/clienti e luoghi solo quando la fonte, il consenso e il contesto ne consentono l'uso.
4. Disambiguare per settore e contesto; evitare duplicati inutili nello stesso settore.
5. Il vocabolario è un supporto lessicale, **non** un'autorità di business: non può creare un intento, risolvere da solo un'ambiguità, autorizzare una scrittura o sostituire una policy.
6. Le voci rimangono `draft` fino alla revisione di dominio. Il superamento del validator o l'arricchimento editoriale non equivale ad approvazione di un esperto.
7. Non attivare il catalogo come contesto runtime approvato finché i gate di qualità, revisione, isolamento per azienda e attivazione non sono superati.
8. Non ampliare il catalogo in modo indiscriminato prima di aver validato la qualità della sintesi e la base V4 sul percorso effettivamente distribuito.
9. Non includere il settore farmaceutico nel catalogo iniziale concordato.

## 7. Sicurezza, autorizzazioni e conferma del titolare

- Fail-closed se identità, permessi, policy, campi obbligatori, versione della proposta o stato della pratica sono mancanti, ambigui, scaduti, malformati o non verificabili.
- Separare chiaramente: ingestione, estrazione, classificazione dell'intento, scelta del workflow, raccolta campi, policy, autenticazione/autorizzazione, conferma e scrittura persistente.
- Non fidarsi di testo libero come “sono il titolare”; verificare identità e ruolo tramite il percorso autorizzato. Un comando del cliente citato/riportato è contenuto, non un comando amministrativo.
- La verifica del telefono, da sola, non assegna il ruolo owner: serve un collegamento verificato tra identità, azienda e ruolo.
- La conferma deve essere riferita a una proposta esatta, ancora valida e non modificata; deve vincolare proposta/versione/hash, identità autorizzata e scadenza.
- **Conferma atomica obbligatoria:** proposta esatta → effetto autorizzato → consumo one-time della conferma nella stessa transazione o tramite protocollo equivalente realmente atomico. Non abilitare scritture finché il gate non è implementato e testato.
- Una conferma prematura, generica, scaduta o riferita a dati cambiati non autorizza la scrittura.
- Un replay identico non deve duplicare l'effetto; un replay con contenuto diverso deve produrre un conflitto esplicito (ad es. `REPLAY_CONFLICT`) e nessuna azione.
- Per comandi misti, garantire che il confine di atomicità sia esplicito: nessun effetto parziale non autorizzato.
- Le policy assenti/sconosciute, le modalità di autonomia sconosciute e i campi mancanti devono fallire chiusi. Un livello di divieto prevale su un'autorizzazione più permissiva.
- Una policy è applicabile soltanto se il suo stato è esplicitamente attivo (`is_active === true`); valori mancanti, nulli o falsi non devono essere interpretati come attivi.
- Le righe di policy applicabili con scope o configurazione malformati devono bloccare la risoluzione; non vanno ignorate se ciò permetterebbe di ricadere su una policy più permissiva. Le policy esplicitamente inattive possono essere escluse; una policy valida di un workflow diverso non va applicata al workflow corrente.
- Il gate di creazione deve validare anche la forma del piano dati: se lo stato dichiara che la raccolta è completa, `required_fields` deve essere un array valido e non deve contenere campi mancanti, incerti o malformati.
- Se una scrittura ha esito incerto, non dichiarare successo; riconciliare prima di ripetere l'operazione.
- Produzione, branch principale, questionari, token, dati reali e identità reali sono protetti da modifiche non autorizzate.

## 8. Persistenza, conversazioni multi-turn e concorrenza

- La memoria di conversazione deve essere durevole, non limitata a strutture in memoria di processo.
- Isolare per azienda, account/provider, contatto/conversazione, workflow e versione della pratica.
- Conservare provenienza dei campi, riferimenti ai messaggi/media sorgente e distinzione tra esplicito, normalizzato, proposto e mancante.
- Proteggere aggiornamenti concorrenti con versioning/compare-and-set e, dove necessario, lease/fencing token; un lock locale non protegge da side effect esterni.
- Gestire restart, deployment, timeout, messaggi duplicati e fuori ordine, scadenze e recovery senza perdere o mischiare contesto.
- MultiVocale deve accumulare i vocali consecutivi nel batch previsto e produrre **un'unica sintesi finale che includa il contenuto di tutti i vocali**. Due sintesi separate non soddisfano il requisito.
- Il timer di raggruppamento di 5 secondi era inteso a evitare risposte separate; non sostituirlo con l'obbligo per l'utente di distanziare i messaggi di 1–2 secondi.
- Quando si usa “Riepiloga più vocali”, conservare il primo vocale e aggiungere quelli successivi, senza sovrascriverlo.
- Gestire eventi quasi simultanei e concorrenza senza perdere contenuti, duplicare risposte o inviare un riepilogo incompleto.
- Preservare il percorso audio funzionante e introdurre cambiamenti minimi con regressioni mirate.

## 9. Outbox WhatsApp, delivery e recovery

- Gli invii esterni devono usare una outbox durevole con attempt e stato persistente; non basarsi soltanto sul successo della richiesta HTTP o su memoria volatile.
- Correlare callback Meta autenticati con l'ID del messaggio del provider e gestire duplicati/fuori ordine in modo idempotente.
- Distinguere gli stati **accepted**, **delivered**, **read**, **failed definitive** e **outcome unknown**; non considerarli sinonimi.
- Se il processo si interrompe dopo l'invio ma prima della persistenza della risposta, l'esito può essere sconosciuto. Non effettuare retry ciechi in `outcome_unknown` senza idempotenza provider documentata o riconciliazione autorevole.
- Non promettere exactly-once se non è dimostrabile ai confini tra database e provider. Dichiarare con precisione la garanzia effettiva (ad es. at-most-once o consegna best-effort).
- Testare crash, timeout, risposta persa, retry, webhook duplicati/fuori ordine, due worker concorrenti, lease scaduta e status callback tardivi.
- La firma webhook implementata nel branch non equivale a verifica end-to-end sul servizio Render reale.

## 10. Costi, account, onboarding e privacy

1. Prima di risorse a pagamento presentare costo unitario, frequenza, stima sul periodo, voci escluse e possibili costi aggiuntivi; attendere conferma esplicita.
2. Ricalcolare prezzi correnti prima di acquistare o creare risorse. Un preventivo precedente non è automaticamente attuale.
3. Nessun database branch, risorsa compute, SMS, provider o servizio a pagamento senza approvazione.
4. Non incollare né chiedere in chat password, OTP, token o chiavi API; non scriverli in issue, log o documenti versionati.
5. Non creare identità, utenti Auth o membri aziendali fittizi per superare un blocco.
6. L'onboarding deve collegare un'identità verificata al business tramite un percorso autorizzato; OTP/telefono non basta per attribuire il ruolo owner.
7. Per Supabase, Bird, Stripe, Meta, Vercel, Render e altri provider, controllare documentazione ufficiale e costi attuali prima di scegliere o configurare.
8. Privacy/GDPR prima del lancio: informativa, ruoli, basi giuridiche, minimizzazione, retention/cancellazione, accesso, log, responsabili/sub-responsabili, trasferimenti, sicurezza e obblighi contrattuali; ottenere revisione qualificata quando necessaria.
9. Non esporre al cliente segreti, dati personali non necessari, stack trace, eccezioni grezze o URL sensibili.
10. Vercel Hobby non-commercial limitation, billing e condizioni di lancio devono essere risolti prima del GO-LIVE.
11. Tenere distinti pricing e consumi dell'assistente WhatsApp e della VocalFlash API.
12. Decisioni di pricing/pagamento (piani, prezzi, mensile/annuale, trial, metodi di pagamento, fallimenti, cancellazioni/rimborsi) restano decisioni del titolare finché non esplicitamente deliberate.

## 11. Test, rilascio e pilot

- Ogni modifica deve avere test mirati proporzionati al rischio e verifica degli effetti collaterali.
- Prima di intervenire verificare il commit effettivo, l'ambiente, la configurazione e le funzioni esistenti.
- Controllare CI e Preview sull'head esatto. Un run verde su un commit precedente non dimostra che l'head corrente sia verde.
- Un test unitario non prova un'integrazione; CI non prova Meta/Render/Supabase E2E; Preview READY non prova produzione.
- Verificare casi positivi, negativi, ambigui e avversariali: policy assente, campi mancanti, conferma prematura, scadenza, replay identico/diverso, due conferme concorrenti, duplicati, timeout, restart, provider irraggiungibile e risposta persa.
- Non usare clienti reali o inviare loro messaggi senza approvazione esplicita.
- Pilot iniziale controllato con **3–5 potenziali clienti** prima di ampliare prematuramente l'architettura multi-azienda.
- Conservare evidenza verificabile: commit SHA, run/job, ambiente, casi coperti, risultati e limiti.
- Non ripetere controlli identici se non vi sono nuove evidenze; usare il tempo per chiudere il prossimo blocco autonomo.
- Quando si dichiara “completato”, includere le verifiche effettivamente eseguite e le attività ancora non eseguibili per mancanza di autorizzazioni o ambiente.

## 12. Direzione di prodotto e apprendimento dal mercato

- Usare i risultati già raccolti senza gonfiare il campione: il questionario VocalFlash disponibile aveva 2 risposte. Entrambe usavano WhatsApp ogni giorno, indicavano 0–5 vocali al giorno, riferivano di voler una sintesi e di capire/riassumere la richiesta; il campione è troppo piccolo per conclusioni di mercato robuste.
- Valutare i bisogni reali per settore con casi d'uso, flussi e costi/benefici concreti; non inviare questionari o messaggi a persone senza approvazione.
- L'esempio idraulico/manutenzione deve mostrare concretamente come l'assistente raccoglie zona/indirizzo, descrizione del problema, foto quando utili e disponibilità, riprende la stessa pratica e lascia al titolare la decisione quando richiesta dalla policy.
- L'assistente non deve limitarsi a riassumere: deve evidenziare cosa manca, proporre domande e un'azione successiva, mantenendo il controllo umano dove necessario.
- Non usare il caso idraulico come unico modello di prodotto: l'architettura deve permettere più settori e vocabolari separati senza confondere terminologia o policy.

## 13. Checklist prima di una modifica significativa

- [ ] Ho consultato lo stato corrente, questo libro, Libro sacro, roadmap, PR/issue e test pertinenti?
- [ ] Ho verificato quale commit/ambiente è realmente attivo?
- [ ] Ho separato già fatto/testato, progettato e da fare?
- [ ] Ho identificato la modifica minima e protetto le funzioni esistenti?
- [ ] Ho preservato dati originali e provenienza, senza inferenze non supportate?
- [ ] Ho verificato tenant isolation, identità, policy, fail-closed e conferma atomica?
- [ ] Ho considerato concorrenza, restart, timeout, retry, replay e duplicati?
- [ ] Ho controllato privacy e possibili effetti esterni?
- [ ] Ho evitato costi, segreti, dati live e produzione senza autorizzazione?
- [ ] Ho eseguito davvero i test dichiarati sul commit pertinente?
- [ ] Ho aggiornato Libro sacro e roadmap dopo il progresso significativo?
- [ ] Ho aggiornato questo registro se è emersa una nuova raccomandazione o un override?
- [ ] Ho rimosso dal registro operativo i punti chiusi, mantenendo evidenza nello storico, e marcato esplicitamente i sospesi?

## 14. Stato e limiti della raccolta

Questo documento consolida le raccomandazioni esplicite e le decisioni disponibili nelle conversazioni e nei registri di progetto recuperati. Non afferma che ogni conversazione storica sia stata recuperata integralmente se non accessibile nei risultati disponibili. È un registro vivo: quando emerge una nuova indicazione, va aggiunta; se un'indicazione precedente è superata, va marcata come override e non applicata in conflitto con la decisione più recente.

## 15. Consegna WhatsApp: esiti ambigui e retry

- Non confondere il completamento dell'elaborazione con la consegna della risposta: sono due stati distinti.
- Un timeout del client non prova che Meta abbia rifiutato il messaggio. Se l'accettazione è ambigua, non offrire un reinvio cieco che possa duplicare la risposta.
- Persistire l'intento outbound con chiave idempotente, identificativo provider quando disponibile, stato `outcome_unknown` e procedura di riconciliazione; distinguere errori definitivi da errori transitori e timeout ambigui.
- Ogni azione “Riprova” deve sapere se ripete la generazione della sintesi o soltanto la consegna; non ricalcolare o reinviare implicitamente senza verificare lo stato.
- Verificare retry, webhook duplicati, due worker concorrenti, restart e callback duplicate. Un test unitario non dimostra la consegna reale al destinatario.
- Evidenza del rilievo statico 24/10/2026: [bot issue #4 — consegna MultiVocale ambigua](https://github.com/VocalFlash/vocalflash-bot/issues/4). È stato aggiunto un guard conservativo nel ramo Draft, con test CI superati sul commit `1a717d314ab07ea670c4e20a0bb0dd8b676c469b`: dopo il confine di invio non si offre retry cieco e il recovery è bloccato finché l'esito è da riconciliare. Il test non riproduce un invio reale Meta; il guard non equivale a outbox durevole o garanzia exactly-once. Nessun deploy, migrazione o modifica live.


## 16. Riepilogo periodico VocalFlash

- Preparare il riepilogo ricorrente del venerdì con avanzamenti verificati, blocchi, decisioni aperte e prossimi passi.
- Coprire esplicitamente le aree: integrazioni Meta, MultiVocale, Account & Billing, privacy e sicurezza.
- Indicare sempre le **tre priorità successive** e separare le decisioni che richiedono il titolare dalle attività che possono proseguire autonomamente.
- Non presentare un riepilogo programmato come completato se il relativo controllo o aggiornamento non è stato effettivamente eseguito.
- Usare lo stato dei repository, dei test, dei provider e dei documenti aggiornati; evitare di ripetere verifiche senza nuove evidenze.


## 2026-10-24 — Override operativo: tabella del valore come criterio principale

La tabella “capacità → esigenza reale → valore da dimostrare → prova minima → stato/gate” nel Libro sacro operativo è il criterio primario per ordinare e accettare il lavoro VocalFlash. Questa regola si applica a roadmap, classificatore, vocabolario, persistenza, integrazioni WhatsApp e funzioni future.

Prima di promuovere una funzione, dichiarare quale esigenza reale risolve, quale riga della tabella migliora, come si misurerà il risultato e quali rischi/blocchi restano. Non privilegiare il completamento del catalogo terminologico rispetto alla dimostrazione del valore operativo end-to-end. La completezza strutturale del vocabolario non equivale a revisione di dominio né a miglioramento misurato della sintesi/classificazione.

La revisione statica del 24 ottobre ha inoltre rilevato due gap da tenere espliciti fino alla chiusura con test: il bot inoltra il testo ordinario all'Assistant API ma lascia i vocali sul percorso MultiVocale/legacy; inoltre, se `assistant_message` è vuoto o assente, non invia risposta e non segnala esplicitamente il contratto incompleto. Non considerare risolti questi gap senza modifica circoscritta, test sul commit e verifica del contratto.


### Evidenza successiva — contratto di risposta cliente
Il caso in cui l'Assistant API dichiara successo ma non fornisce `assistant_message` non deve essere ignorato. Sul ramo bot è stata aggiunta una gestione fail-closed con errore diagnostico `ASSISTANT_REPLY_MISSING` e relativo test unitario; CI sul commit `5c0cf3b830389471f5ff1a9770b5593d95e6721b` superata 5/5. Questo non equivale a E2E: il routing operativo del bot copre ancora il testo ordinario, mentre i vocali seguono il percorso MultiVocale/legacy. Mantenere questa lacuna tra le priorità legate alla tabella principale di valore.


### Verifiche aggiuntive del 24 ottobre
La CI dell'ultimo aggiornamento documentale precedente (`bb800588d079f4920c19b96cc87e8ffe9e64d0dd`) è stata verificata: 5/5 job success. Sul bot è stato rafforzato il test del caso risposta mancante, verificando anche il rilascio effettivo della deduplicazione inbound; commit `28f381aec6635197b67d010bc7308902c7fa2b7a`, CI 5/5 success.

Non è stata trovata la fonte SQL autorevole delle 15 migrazioni live. Non ricostruire schema o policy a intuito. I vocali restano sul percorso MultiVocale/legacy: non modificare il routing finché non esiste una matrice di accettazione che protegga sintesi unica, deduplica, contesto, timeout e assenza di doppie risposte.

## 2026-10-24 — Audio Assistant: normalizzazione pura verificata, routing ancora bloccato

### Raccomandazione operativa consolidata
Non collegare i vocali all'Assistant API con una semplice sostituzione di `content_type`. Il contratto deve preservare trascrizione come evidenza, provenienza per ogni messaggio, ordine dei segmenti, stato ASR e idempotenza. Nessun dato mancante va inventato; un batch parziale non deve essere presentato come completo.

### Già fatto e verificato
- Aggiunti `docs/audio-assistant-api-contract-proposal-v1.md` e `docs/audio-assistant-integration-test-matrix-v1.md`.
- Aggiunto `lib/audio-assistant-event-normalizer-v1.js` con test dedicati.
- Il normalizzatore verifica gli identificativi, i tipi evento ammessi, il successo della trascrizione, timestamp ISO con offset, duplicati/ordine dei segmenti, e rifiuta batch incompleti.
- Il testo aggregato del batch è generato deterministicamente dai segmenti ordinati; i campi payload non autorizzati sono esclusi.
- CI del branch per il normalizzatore e i test: workflow run `40125843761` concluso con successo. La CI è prova dei test automatici nel repository, non di un E2E WhatsApp.

### Progettato, non ancora integrato
- Contratto canonico per `text`, `audio_transcription` e `audio_transcription_batch`.
- Trasferimento dei segmenti e della provenienza fino al workflow Assistant.
- Matrice di 20 scenari di accettazione.

### Da fare / bloccato
- Il normalizzatore non è ancora collegato al webhook bot né a `api/v1/assistant.js`.
- Non sono stati verificati end-to-end Meta → ASR → MultiVocale → Assistant API → risposta.
- Restano aperte la politica sui batch parziali, la retention, l'idempotenza persistente e il comportamento in caso di timeout/restart.
- Prima di persistere nuovi campi occorre riconciliare le migrazioni SQL autorevoli.
- Nessun merge, deploy, modifica al database live o invio WhatsApp reale autorizzato.

### Criterio di accettazione
La funzione può avanzare solo quando la sintesi rimane fedele e concisa, ogni affermazione è riconducibile al messaggio sorgente, non si creano doppie risposte o azioni non confermate, e la matrice di regressione viene eseguita con evidenze registrate.

## 2026-10-24 — Aggiornamento successivo: CI completata e gate audio precisati

### Già fatto e verificato
- Il workflow `40126316962` sul commit `c45e01416cf8e0dfc959a6465d3bd26fac235bee` è terminato con **success**. Oltre a date impossibili, i test coprono orari fuori limite, offset non valido e un offset valido.
- Il workflow che risultava in coda non era rimasto bloccato: GitHub Actions lo ha eseguito e concluso dopo circa un minuto. La precedente segnalazione era corretta per lo stato del momento, ma non più attuale.
- Il contratto e la matrice sono stati aggiornati con regole conservative per batch parziali, idempotenza, concorrenza, timeout, restart e privacy. Commit documentale del contratto `91ba50641d546553d6e71ee267e0348a5162ad86`; matrice `cc6db9def4f4d6c012600b96cd1e5ebb6ec57833`.

### Decisioni tecniche proposte, non autorizzazione al rilascio
- Batch parziale ASR: fail closed, senza finalizzazione silenziosa.
- Nessun retry cieco dopo timeout API o invio WhatsApp ambiguo; l'esito resta sconosciuto finché non riconciliato.
- Dedup e finalizzazione devono essere atomiche e condivise tra istanze; lock locale e Redis dedup non dimostrano durabilità/outbox.
- Nessuna migrazione live prima di riconciliare la fonte SQL autorevole.

### Da fare
- Attendere e verificare la CI dei due aggiornamenti documentali più recenti.
- Preparare test isolati di replay/idempotenza, collisione multi-tenant, batch parziale, timeout e restart.
- Non collegare ancora il routing audio: l'API non trasporta tuttora il payload canonico e la matrice A01–A20 non è stata eseguita end-to-end.
- Nessun merge, deploy, invio reale o modifica al database live.


## 2026-10-25 — Audit bot: isolamento Redis da verificare prima del multi-account

### Già fatto/verificato
- Ricontrollati i run recenti del repository JS: i run 40126717048, 40126746115, 40126769370 e 40126792227 risultano tutti completati con success.
- Riletto il codice del bot sulla branch assistant-conversation-photo-v1 e i test esistenti: sono presenti test per deduplicazione risposta, esito ambiguo dell'invio, lease di processamento, recupero di lease scadute e creazione concorrente di batch in coda.
- Aggiunto il report di audit docs/verification-idempotency-multivocale-2026-10-25.md nel repository bot, commit 547d34ad0464f67416be2ff614a2d297b668b6da.

### Rischio emerso dalla lettura statica
Le chiavi Redis per batch attivo, ultimo audio e batch in coda sono costruite usando il mittente senza includere esplicitamente l'account/canale. Non è confermato che il deployment sia multi-account, quindi non si dichiara una collisione avvenuta; è però necessario chiarire il modello di deployment e aggiungere un test di isolamento prima di considerare risolto il multi-tenant. Non cambiare le chiavi senza piano di migrazione: potrebbero esserci batch pendenti.

### Da fare
1. Verificare se bot/Redis sono single-account o condivisi tra più numeri WhatsApp.
2. Se multi-account, introdurre namespace account/canale stabile con test di collisione e transizione sicura delle chiavi esistenti.
3. Eseguire la suite Python sulla branch effettiva: il workflow presente è configurato per push su multivocale-runtime-v2, non sulla branch assistant-conversation-photo-v1; non presumere che il nuovo commit documentale abbia eseguito test automatici.
4. Eseguire test isolati di restart e recupero, poi aggiornare la matrice con run reali.

Gate invariati: nessun routing audio, modifica del timing, merge, deploy, DDL live o invio WhatsApp reale senza autorizzazione.

## 2026-10-25 — Aggiornamento raccomandazioni: isolamento Redis (snapshot storico, poi aggiornato)

- L'utente ha confermato il workspace Render My Workspace e ha chiesto di proseguire dopo la rilettura dei libri canonici.
- È stato implementato un candidato di namespace Redis nel branch Draft assistant-conversation-photo-v1, separando chiavi per servizio Render e account WhatsApp configurato. Sono stati aggiunti test di isolamento e il workflow è stato aggiornato per includere il branch.
- Stato in quel momento: non testato sul nuovo head. Questo snapshot è stato superato dalle run #40208741560 e #40208821196, che hanno eseguito 47 test con esito OK; vedere la sezione finale sulle CI senza duplicazioni.
- Il Redis è condiviso tra staging e produzione e non ha persistenza su disco. Il namespace non risolve la durabilità; non cambiare configurazioni Render, non distribuire e non toccare produzione senza autorizzazione separata.
- Prima di un deploy staging va predisposto un drain/migrazione verificato del vecchio namespace per evitare di rendere inaccessibili batch e cleanup pendenti.
- Restano vincolanti le raccomandazioni canoniche: modifiche minime, test pertinenti prima di dichiarare conclusioni, nessuna affermazione oltre l'evidenza, produzione protetta e documentazione aggiornata dopo ogni avanzamento.


## 2026-10-25 — Raccomandazione aggiornata: chiudere il gate CI prima di proseguire (snapshot storico, poi aggiornato)

- Stato storico al momento di quella verifica: non era disponibile un run sul commit candidato `3e80f7034205ad6271b411e9394ebabea258f740`. Questo è stato superato dai run successivi #40208741560 e #40208821196, entrambi con 47 test e risultato OK.
- Il tentativo locale non riuscì a causa della risoluzione DNS; successivamente la suite è stata eseguita da GitHub Actions sul branch candidato. Il risultato resta limitato ai test deterministici, non all'E2E.
- La revisione statica ha confermato la correzione della chiave globale residua nel sottotipo timing. È emerso inoltre un caso da testare: se il rinnovo della lease fallisce, il thread di rinnovo termina e il processing continua; verificare che un worker con lease persa non possa inviare o finalizzare il batch.
- Prima di qualsiasi deploy staging: suite verde sul commit esatto, test lease/fencing e restart, inventario/drain o migrazione dei batch e cleanup pendenti nel vecchio namespace, verifica del percorso audio effettivo. Il Redis senza persistenza su disco è un rischio separato.
- Nessun merge/deploy, cambiamento di configurazione Render, invio WhatsApp reale o modifica live è stato effettuato. Non trasformare questa raccomandazione in autorizzazione al rilascio.


## 2026-10-25 — aggiornamento dopo CI verificata

- Punto CI sistemato con GitHub: aggiunto il trigger `pull_request` verso `multivocale-runtime-v2` al workflow MultiVocale.
- Verifica effettiva: [run #40208605377](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40208605377), job `test` concluso `success`; log letto: **46 test, OK**.
- Non ampliare la conclusione: i test passati sono deterministici/unitari. Restano da dimostrare Redis reale/concorrenza, perdita del rinnovo lease, restart/recovery, drain/migrazione e integrazione staging.
- Tutti i gate da verificare sono ora registrati nell'[issue GitHub #5](https://github.com/VocalFlash/vocalflash-bot/issues/5). Non fare merge/deploy o modifiche live finché i gate non sono chiusi e verificati.


## 2026-10-25 — riesame raccomandazione CI senza duplicazioni

- Riesaminata la regola canonica §1.14: evitare trigger `push` e `pull_request` sovrapposti sullo stesso commit quando eseguono gli stessi test.
- Corretto il workflow bot: il trigger push resta sul branch base `multivocale-runtime-v2`; il branch candidato è coperto da pull request verso il branch base e dispatch manuale.
- Aggiunto test del fallimento della lease al controllo finale pre-consegna: la sintesi e il prompt MultiVocale non devono essere inviati. Run [#40208741560](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40208741560): 47 test, OK.
- Verifica finale dopo la correzione dei trigger: [#40208821196](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40208821196), 47 test, OK.
- Distinzione obbligatoria: il test aggiunto non copre ancora la perdita del rinnovo in background durante un'elaborazione lunga con recupero da un secondo worker. Restano inoltre Redis reale, restart/recovery, drain/migrazione, Vercel Preview e E2E controllato.
- Tutti i gate aperti sono tracciati nell'[issue #5](https://github.com/VocalFlash/vocalflash-bot/issues/5). Nessun merge/deploy o cambiamento live senza i gate e l'autorizzazione pertinente.


## 2026-10-25 — verifica Preview senza sovrastimare l'evidenza

- Verificata in sola lettura la Preview Vercel del branch candidato: deployment `dpl_8yxnr8L7cXmpi22EzPF57LhkMGDq`, commit documentale `082f1e7ac99cea0bbca80b8aa1beb1aa92ff7167`, stato `READY`; log di build concluso.
- Applicando la regola canonica, `READY` significa soltanto che quella Preview è stata costruita. Non certifica il contratto bot/API né un E2E Meta/WhatsApp.
- PR #2 e PR #3 restano Draft. Non unirle separatamente né rilasciare finché il contratto congiunto e i gate dell'[issue #5](https://github.com/VocalFlash/vocalflash-bot/issues/5) non sono verificati.


## Registro ciclo tecnico — 25 ottobre 2026: lease persa durante elaborazione lunga
- **Problema individuato:** se il rinnovo della lease falliva durante una sintesi lunga e un secondo worker recuperava il batch, il primo worker, al ritorno tardivo, poteva entrare nel ramo di errore e inviare un messaggio cliente “Premi Riprova” pur non essendo più proprietario del batch.
- **Correzione implementata sul branch isolato:** prima di inviare messaggi di errore/riprova, il runtime verifica lo stato persistito e il fencing token; un worker obsoleto non invia e non tenta di finalizzare il batch recuperato.
- **Prova:** test deterministico `test_lost_lease_during_long_processing_second_worker_recovers_stale_worker_cannot_send_or_finalize`; GitHub Actions [#40209993482](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40209993482), commit `d31878080a94975a605b39b74c90790bf2fc9180`, **48 test superati**.
- **Limite esplicito:** fake Redis e orchestrazione controllata non provano concorrenza atomica su Redis reale, recovery dopo restart o consegna Meta. Nessun merge/deploy/modifica live autorizzato.
- **Prossimo gate:** riprodurre il comportamento su Redis reale in un ambiente isolato e poi testare restart/recovery; prima di staging resta necessario l'inventario/drain del vecchio namespace.


## Ciclo tecnico — 25 ottobre 2026: Redis reale e recovery
- Verificato contro Redis reale in CI: servizio effimero Redis 7; due claim simultanei sullo stesso batch producono un solo proprietario; dopo recovery il fencing token precedente non può salvare la risposta né finalizzare.
- Verificata la ricostruzione del client/store: dopo aver chiuso il client e creato un nuovo client/store sulla stessa istanza Redis, lo stato processing e la risposta preparata risultano persistiti e la lease scaduta può essere recuperata.
- Evidenza: run #40210411337 (https://github.com/VocalFlash/vocalflash-bot/actions/runs/40210411337), commit 15fb25eb73c45b8d08a766f9bde8696a10eb974c, 59 test superati.
- Limiti: non è stato riavviato il server Redis né il servizio Render; lo storage audio reale, la durabilità in caso di perdita Redis e l'E2E Meta restano non verificati.
- CI: la suite primaria PR include ora i test firma webhook, lease e Redis reale; il workflow diagnostico duplicato è manual-only. Nessun merge/deploy o modifica live.
- Prossimo gate: test isolato che coinvolga storage audio effettivo e restart del processo, poi piano read-only di drain/migrazione del vecchio namespace prima di qualsiasi deploy staging.


### Addendum — CI object reference after client/store recovery (2026-10-25)

- Exact candidate commit `74806b1bac489279b247bebb1600f99194f5a6cf`: GitHub Actions [run #40215225458](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40215225458), job `test` = `success`; log read: **59 tests, OK**.
- The real-Redis CI test now asserts that after closing and recreating the Redis client/store, the persisted batch still contains exactly one file reference with `status=ready` and `object_key=test-object/audio.ogg`; the lease is then recovered and finalized with the new fencing token.
- Scope: this verifies Redis serialization/recovery of the object reference against an ephemeral Redis 7 service. The object key is a test fixture, so this is **not** proof of a real storage object, signed download URL after restart, Redis server restart, or Render process restart.
- Still open: actual audio-storage + process-restart E2E; read-only inventory and verified drain/migration of the old namespace; Redis durability/recovery; staging Meta signature and Assistant API integration; joint bot/API contract review.
- No merge, deployment, live configuration/database mutation, or real WhatsApp send.


## Review statica del percorso audio e del contratto storage — 25 ottobre 2026

### Confermato dalla lettura del branch candidato
- Il percorso V2 per i messaggi `audio` e i comandi MultiVocale è selezionato da `app_customer.py`; il runtime V2 scarica il media da Meta, lo carica nello storage privato tramite URL firmato, registra in Redis `object_key`/metadati e ricrea un URL firmato per il download quando elabora il batch.
- `multivocale_state_v2.py` conserva metadati e riferimenti storage, non i byte audio; `multivocale_storage_v1.py` usa la Assistant API interna per autorizzare upload/download/delete e invia i byte direttamente agli URL firmati. Il segreto Supabase non viene passato al processo Render secondo il contratto implementato.
- Le strutture legacy `sessions`, `auto_batches`, `queued_batches` e `last_audio` sono ancora dichiarate in `app.py`; l'handler candidato instrada i tipi audio e i comandi MultiVocale al runtime V2. Questo controllo statico non dimostra che ogni percorso storico sia irraggiungibile in ogni condizione: resta necessaria la verifica di regressione/E2E prima di staging.
- La API storage Vercel valida la forma del percorso oggetto (`tmp/<UUID>/<SHA-256>.<ext>`) e limita le operazioni a upload/download/delete con chiave Assistant interna. Non è stata eseguita una prova integrata contro il provider storage reale; il test del client usa risposte simulate.
- Punto di hardening da mantenere nella review congiunta: l'endpoint storage non riceve un'identità di servizio/account separata e non vincola esplicitamente ogni `object_key` all'account che l'ha creato. L'accesso è protetto dalla chiave interna condivisa; la separazione per account/servizio e l'autorizzazione sull'oggetto devono essere valutate prima del GO-LIVE, senza assumere che la sola forma dell'object key sia una policy di ownership.

### Esito
- Percorso audio e confine API/storage: **review statica parziale completata**.
- Test reale del provider storage, download firmato dopo restart effettivo, isolamento ownership dell'oggetto e verifica di tutti i percorsi legacy: **NON ESEGUITI / gate aperti**.
- Nessuna lettura o scrittura di chiavi Redis live; l'inventario del vecchio namespace non è eseguibile con gli strumenti read-only disponibili, che espongono metadati Render ma non il keyspace Redis. Non usare FLUSHDB né inventare che il namespace sia vuoto.
- Nessuna modifica di codice, segreti, configurazione, schema, deploy o invio WhatsApp in questo ciclo di review.


## Verifica esatta head API/Preview — 25 ottobre 2026

- Head del branch al momento del controllo: `15959d5ea30e2d35acf5b8e9210e5ec5146f2ffd` (solo documentazione rispetto al codice esaminato).
- GitHub Actions run [#40215662915](https://github.com/VocalFlash/vocalflash/actions/runs/40215662915): conclusa `success`; tutti e 5 i job sono riusciti. Log del quinto pass letto: **98 test superati, 0 falliti**; gli altri quattro job hanno anch'essi `success`.
- Vercel Preview per lo stesso SHA: deployment `dpl_A6q4UqnpkccNDMMuvfn8X93pECzr`, stato `READY`. Preview/build soltanto; non prova il comportamento semantico o un E2E con bot, Supabase, storage e Meta.
- PR API #3 e bot #2 sono ancora Draft, aperte e non unite. Nessun merge o deploy di produzione.
- Il risultato CI riguarda il branch API prima di questo aggiornamento documentale; eventuali commit successivi dei libri devono essere trattati come head nuovi e verificati separatamente.


## Aggiornamento CI e Preview sull'head corrente — 25 ottobre 2026

- Bot: head `d8f8c6c9c1a3de53af44e182c88580a740745832` è un commit documentale; run [#40215503185](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40215503185) = `success`, **59 test, OK**. La prova copre Redis reale temporaneo in CI e il recupero del riferimento fittizio; non prova storage reale né restart Render.
- API: head documentale `99ad18b738c1cd50225176138319d601ff89aa78`; run [#40215818314](https://github.com/VocalFlash/vocalflash/actions/runs/40215818314) = `success`, tutti e 5 i job riusciti. Log letto: **98 test, 0 fallimenti**.
- Vercel Preview sullo SHA API `99ad18b...`: deployment `dpl_Bc9B9HaHhTqTaobQWAFN2xYpcjpL`, stato `READY`. Questo certifica solo build/deployment Preview, non E2E integrato.
- La review statica ha confermato che il namespace Redis del runtime V2 incorpora un digest derivato da `RENDER_SERVICE_ID` e `WA_PHONE_ID`; questo isola le nuove chiavi V2 tra servizi/account se entrambi i valori sono correttamente impostati. Non prova che i vecchi namespace siano vuoti o migrati.
- Rimangono aperti: storage reale + download firmato dopo restart; ownership/isolamento oggetti; audit di tutti i percorsi legacy; inventario read-only del vecchio namespace; durabilità Redis; staging Meta/Assistant E2E; review congiunta del contratto.
- Nessun merge, deploy produzione, mutazione live o invio WhatsApp reale. Release NO-GO.


## Esito follow-up CI — 25 ottobre 2026 (ultimo controllo)

- API commit documentale `74f60fe3114aaf026a3d5c10666403072340334d`: [run #40217077754](https://github.com/VocalFlash/vocalflash/actions/runs/40217077754) = `success`; tutti i 5 job completati, ciascun log mostra **98 pass, 0 fail**. Vercel Preview associata allo SHA `74f60fe...` = `READY`.
- Bot commit documentale `5d80b3802b1184cad4b9fd2b03894b39c6d9fa42`: [run #40217101979](https://github.com/VocalFlash/vocalflash-bot/actions/runs/40217101979) = `success`; log letto: **59 test, OK**.
- Questi commit sono documentali, non modificano il runtime; CI/Preview positivi non sostituiscono i gate E2E.
- PR #2 e #3 ancora Draft/non unite. Release ancora NO-GO: storage reale + restart; ownership object; audit legacy; inventario e drain namespace; durabilità Redis; verifica staging Meta/Assistant.


## Raccomandazione operativa aggiunta — audit read-only del 25 ottobre 2026

- Usare My Workspace per verifiche read-only di Render, GitHub, Vercel e Supabase, senza trattare l'accesso come autorizzazione a modifiche live.
- Quando log o metriche sono vuoti, riportare **copertura non conclusiva** e non interpretare l'assenza di dati come assenza di errori o traffico.
- Tenere distinti stato CI del job, conteggio test letto nel log, stato Preview e prova E2E. I due PR restano Draft e non uniti.
- Prima di qualsiasi deploy MultiVocale, richiedere un piano verificabile per il namespace Redis precedente: il tool Render non consente l'inventario del keyspace; non presumere che sia vuoto e non usare FLUSHDB.
- Considerare la Redis condivisa tra staging e produzione, Free/Oregon e senza persistenza su disco come gate architetturale da risolvere; non creare risorse o costi ricorrenti senza consenso esplicito.
- Per Supabase, 0 utenti Auth e 0 membri business significano che non va inventata un'identità owner. Le 15 tabelle con RLS attivo ma senza policy vanno valutate rispetto al modello di accesso previsto, senza aggiungere policy permissive alla cieca.
- Le segnalazioni performance su foreign key/indici sono INFO: esaminare query e workload prima di intervenire.
- Se un provider nega l'accesso (Vercel runtime errors: 403), registrare il limite e non dichiarare il controllo completato.


## Addendum — verifica estesa piattaforme e cronologia disponibile (2026-10-25, UTC)

### Stato della verifica
- Sono stati riletti i due libri canonici e la roadmap, consultati i registri/riassunti delle conversazioni VocalFlash disponibili in ChatGPT Library e recuperato lo stato live delle piattaforme con accessi read-only. Questo consolida le evidenze recuperabili; non va descritto come lettura manuale esaustiva di ogni singola chat dell'account, perché l'interfaccia non espone un inventario completo delle conversazioni.
- Nessun merge, deploy, restart, modifica di variabili/secret, scrittura o DDL su database live, invio WhatsApp reale o acquisto è stato eseguito.

### GitHub / Vercel
- Commit documentale API corrente: `730bfdd642307b5b3c06c54ce26eec64aea3ed55`; deployment Vercel `dpl_4XGZiWPAMnXjEurq8e2mENDbHwaP` ora risulta **READY**. È una Preview (target non production), non prova E2E né stato di produzione.
- Il progetto Vercel `vocalflash` ha Node.js `24.x`; SSO protection è abilitata per tutti gli ambienti eccetto i domini custom; password protection è disabilitata. Domini custom `api.vocalflash.it`, `vocalflash.it` e `www.vocalflash.it` risultano verificati; apex reindirizza a www con 308. Questa verifica non prova che ogni endpoint applicativo sia sano.
- Inventario env Vercel read-only (valori non letti): `VF_ASSISTANT_SUPABASE_URL`, `VF_ASSISTANT_SUPABASE_SECRET_KEY`, `VF_MULTIVOCALE_STORAGE_BUCKET` e `VOCALFLASH_ASSISTANT_API_KEYS` risultano solo per Preview con branch `assistant-auth-v1) (la secret Supabase ha anche un target development). Non risultano assegnati al branch Preview `assistant-conversation-photo-v1` nell'inventario consultato. Le variabili legacy `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `VOCALFLASH_API_KEYS`, `OPENAI_API_KEY` hanno target più ampi. **Da fare:** confrontare i nomi richiesti dal codice del branch candidato con target/branch reali e correggere il binding solo dopo aver validato la necessità; non copiare né mostrare valori segreti. La presenza di una variabile non prova che il valore sia valido.
- GitHub PR bot #2 e API #3 restano Draft/non unite secondo l'ultimo stato verificato. I risultati CI positivi su commit precedenti non si trasferiscono automaticamente ai successivi commit documentali; verificare il commit esatto prima di ogni gate.

### Render
- Servizio staging `vocalflash-bot-staging`: branch `multivocale-runtime-v2`, avvio `gunicorn app_customer:app`, auto-deploy OFF, piano Free, 1 istanza, Oregon, pubblico `0.0.0.0/0), nessun health check configurato.
- Produzione `vocalflash-bot`: branch `main`, avvio `gunicorn app:app`, auto-deploy ON ad ogni commit, piano Free, 1 istanza, Oregon, pubblico `0.0.0.0/0), nessun health check configurato.
- Ultimi deploy live rimangono staging commit `34c63efb6e0e720e8dc07c10c3c457a5d59ae5b5` del 4 ottobre e produzione commit `788eecf280e0bb6eb22424669b89ed7ad0abc432` del 3 ottobre.
- Entrambi i servizi condividono `vocalflash-redis`: Free, Oregon, Redis 8.1.10, `maxmemoryPolicy=noeviction), `persistenceMode=off). Rischio P0: separare staging/produzione e definire durabilità/recupero prima del pilota. Non eseguire flush né migrazione distruttiva.
- Gli strumenti Render usati non espongono in modo affidabile l'inventario dei valori/nomi di tutte le env var né un keyspace Redis enumerabile in sicurezza. Questi punti restano **non verificati**, non “a posto”. Eventi recenti interrogati non restituiscono righe; questo non dimostra assenza di incidenti.
- **Da fare:** aggiungere health check appropriato e testare dipendenze, dopo aver identificato endpoint sicuro e semantica; non modificare il servizio live in questa fase.

### Supabase
- Progetto attivo `VocalFlash Assistant`, ID `tkfyfqgtumoeywlqzmdt`, stato `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.171, regione eu-west-1.
- Esiste anche `VocalFlash's Project`, ID `miavlccjtknaemnmjoqb`, stato INACTIVE: va chiarito se resta il backend del questionario storico o se è dismesso; non cancellare né riattivare senza verificare dipendenze e dati.
- Il progetto Assistant mostra 15 migrazioni live fino a `20261004213059 customer_whatsapp_replay_conflict_v1); la fonte SQL versionata completa resta non riconciliata. Nessuna development branch e nessuna Edge Function nel progetto Assistant al controllo corrente.
- Advisor security: 15 tabelle public con RLS abilitata e nessuna policy (livello INFO). È necessario confermare grants, percorsi server-side e modello di accesso; non creare policy permissive automaticamente.
- Advisor performance: 18 foreign key senza indice di copertura; analizzare query e workload prima di aggiungere indici. Gli indici inutilizzati restano solo segnalazioni, non candidati a cancellazione automatica.
- Non creare la development branch: costo già stimato in precedenza, ma non approvato. Non applicare migrazioni live per colmare il drift.

### P0 confermati e ordine di intervento
1. Riconciliare la provenienza delle 15 migrazioni e rendere riproducibile lo schema in un ambiente isolato autorizzato.
2. Separare Redis di staging e produzione; inventario e drain del namespace legacy con procedura non distruttiva; definire durabilità e recovery.
3. Verificare binding delle env Vercel al branch Preview corretto senza esporre segreti; inventariare in modo sicuro le env Render, dato che il connettore non le ha rese verificabili.
4. Eseguire test storage audio reale + signed URL dopo restart effettivo, ownership degli oggetti e audit dei percorsi legacy in RAM.
5. Verificare META_APP_SECRET e firma webhook nel vero staging, quindi test congiunto bot/API, delivery ambiguity/outbox e callback.
6. Correggere/validare health check e accessibilità dei servizi; valutare piano Vercel commerciale/DPA, privacy, retention e subprocessori prima del lancio.
7. Rivedere il progetto Supabase inattivo del questionario e la coerenza dei target di ambiente; nessuna cancellazione senza prova di non dipendenza.

### Stato release
**NO-GO** invariato. La Preview corrente READY chiude solo il build per quel commit. Nessuna delle verifiche read-only autorizza merge, deploy, modifiche live o messaggi reali.


## Correzione di stato dopo gli aggiornamenti documentali — 25 ottobre 2026
- L'ultimo commit della branch API è ora `22c3cb8a5a80816ff4f6c04d2176d4d892e2bc05`; la Preview Vercel `dpl_AocXz9YMy3GrP4TSgm2ZD8BRwc1y` associata a questo commit risulta **READY**. È build Preview, non target production e non E2E.
- I tre commit successivi all'audit sono documentali; prima di attribuire loro una nuova prova di runtime, controllare il diff effettivo. Il connettore GitHub per workflow-run sul commit corrente non ha restituito run PR-triggered; ciò non prova che nessun altro workflow sia partito. L'ultimo run bot visibile sul commit `5d80b3802b1184cad4b9fd2b03894b39c6d9fa42` è success e registra 59 test; per l'API la precedente run sul commit `74f60fe3114aaf026a3d5c10666403072340334d` era success con 98 pass / 0 fail e 5/5 job, ma non è un run del nuovo commit documentale.
- **Nuovo finding Vercel da verificare:** l'inventario env senza valori mostra le variabili Assistant/Storage specifiche come Preview variables associate al branch `assistant-auth-v1`; non risultano associate al branch `assistant-conversation-photo-v1`. Il codice candidato legge `VF_ASSISTANT_SUPABASE_URL`, `VF_ASSISTANT_SUPABASE_SECRET_KEY` e `VOCALFLASH_ASSISTANT_API_KEYS`. Prima di un test E2E occorre confermare il binding branch/environment e la validità della configurazione senza esporre o copiare segreti. Il build READY da solo non verifica queste variabili.
- La review statica indica che la health probe ora usa `checkAssistantReadiness` con probe read-only e timeout; inoltre i moduli ingest/coordinator/dispatch usano il helper `supabaseRestHeaders` che distingue `sb_secret_` dalle credenziali JWT legacy. Gli issue #6 e #7 sono stati aggiornati con queste evidenze, ma restano aperti finché i test di accettazione e l'integrazione isolata non sono verificati.
- Nessun runtime code, ambiente live o segreto è stato modificato in questo ciclo.


## Addendum raccomandazioni — Redis e chiavi ambiente (2026-10-25)

1. **Non cambiare ora il Redis URL né cancellare chiavi manualmente.** Il candidato genera il namespace Redis usando `RENDER_SERVICE_ID` e `WA_PHONE_ID`; non richiede una chiave Redis aggiuntiva inserita a mano. La separazione entrerà in uso solo quando il codice candidato verrà rilasciato.
2. **Prima del rilascio**, fare inventario read-only di raccolte, riferimenti audio e cleanup pendenti nel vecchio namespace e definire un drain/migrazione con rollback. Non assumere che lo stato sia vuoto; vietato usare `FLUSHDB`.
3. La review della API storage ha confermato un gap di isolamento: l'endpoint autentica con una chiave Assistant condivisa e convalida la forma di `object_key`, ma non dimostra che quell'oggetto appartenga al bot/ambiente che effettua la richiesta. Prima di E2E/release progettare un'associazione server-side tra credenziale e scope; potrebbe richiedere credenziali distinte per staging e produzione o una mappatura equivalente. **Non ruotare, creare o sostituire segreti live senza un piano approvato e senza coordinare Vercel e Render.**
4. La CI del bot sul commit `cb1d7a7483f41e51f5cbf82c73ccee486b373e8e` è verde: 60 test. Questo conferma solo test automatizzati, non restart effettivo Render/Redis, storage reale o flusso WhatsApp.
5. Mantenere il rilascio **NO-GO** finché non siano verificati durabilità/recovery, storage e signed URL reali, isolamento della credenziale storage, variabili Preview corrette, firma webhook Meta e test integrato controllato.


## Addendum — audit sicurezza storage API, binding Preview e percorsi legacy (2026-10-25)

### Evidenze verificate in sola lettura
- La funzione `api/v1/multivocale-storage.js` autentica con `VOCALFLASH_ASSISTANT_API_KEYS` come lista di chiavi condivise; non ricava da tale autenticazione uno scope server-side distinto per ambiente/servizio/account.
- La validazione di `object_key` controlla il formato `tmp/<UUID>/<sha256>.<estensione>`, ma non prova che l'oggetto appartenga al chiamante autenticato. Le azioni `prepare_download` e `delete` non effettuano una verifica di ownership persistente prima di firmare il download o rimuovere l'oggetto. È un gap di isolamento da chiudere prima del pilota.
- L'inventario Vercel con valori non decifrati restituisce **zero variabili** associate al branch Preview `assistant-conversation-photo-v1`. Le variabili Assistant/storage risultano invece legate a Preview `assistant-auth-v1`. Non sono stati letti né copiati valori segreti. Quindi la Preview verde non dimostra che il branch corrente abbia le variabili necessarie a runtime.
- Nel bot, `app_customer.py` importa il modulo legacy `app.py` e mantiene l'handler originale come fallback/compatibilità; il runtime V2 viene istanziato e alcune rotte vengono intercettate. `app.py` dichiara ancora `sessions`, `auto_batches`, `queued_batches` e `last_audio` in memoria. L'ispezione statica non dimostra che ogni percorso legacy sia irraggiungibile né che il comportamento sia sicuro dopo un riavvio.
- L'API storage offre un'azione `health` che crea un URL di upload firmato per una chiave casuale; non è stata eseguita una prova reale di upload/download né un test dopo un riavvio effettivo del processo Render.

### Decisione tecnica / gate
- Non ruotare o sostituire ancora alcuna chiave live e non copiare una chiave tra ambienti. Prima definire un contratto autenticato che leghi credenziale a scope (almeno ambiente/servizio), includa lo scope nella chiave oggetto e verifichi ownership per upload/download/delete; aggiungere test positivi e negativi per accesso incrociato.
- Coordinare in seguito il nome/target delle variabili Vercel Preview e Render; verificare soltanto la presenza/target senza leggere i valori. Il cambio sarà richiesto solo dopo aver definito il contratto e preparato un piano di transizione/rollback.
- Auditare e testare i rami di fallback legacy per testo, vocali, comandi MultiVocale, errori storage e riavvio. Non dichiarare chiusa la persistenza finché non è stata provata su un servizio staging isolato.
- Nessun segreto o variabile è stato modificato; nessun deploy, restart, scrittura DB, invio WhatsApp reale o merge è stato eseguito. Release **NO-GO** invariato.


## Addendum — storage scope enforcement implementation (2026-10-25, CI pending)

### Implementato nel branch candidato
- `api/v1/multivocale-storage.js` ora richiede una mappatura server-side `VOCALFLASH_ASSISTANT_API_KEY_SCOPES` in JSON. La chiave della mappatura è il digest SHA-256 della chiave API effettiva; il valore è uno scope stabile, ad esempio `staging-bot` o `production-bot`. I valori delle API key non vanno inseriti nella mappatura né nella documentazione.
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
- Il contratto richiede credenziali distinte per staging e produzione e scope distinti; il mapping usa SHA-256 della chiave come chiave JSON. La nuova variabile `VOCALFLASH_ASSISTANT_API_KEY_SCOPES` va configurata solo quando saranno autorizzate e pianificate le modifiche env. Nessuna chiave è stata generata, ruotata o cambiata.


## Aggiornamento operativo — 25 ottobre 2026

La revisione incrociata API e bot ha trovato un'etichetta di readiness troppo ampia: il controllo storage generava una signed-upload URL, ma non caricava né scaricava un oggetto. È stata corretta nel branch bot con commit `0ab11b0fab036f27a2ecebbfd8ab7ba580a71274`, rinominando il segnale di log in `storage_control`. La CI per questo nuovo commit è ancora da verificare; non va considerato testato. L'API PR #3 è ancora Draft/non integrata; il commit `c348cc0d6d1ba5b8334328570aaeb904cb9aa581` ha CI verde (run `40234931191`, cinque job) e Preview Vercel READY. Ciò non chiude il gate storage E2E. Nessun merge, deploy, env change o test WhatsApp reale è stato eseguito.

- Esito successivo: CI bot run `40235440651` verde sul commit `0ab11b0fab036f27a2ecebbfd8ab7ba580a71274`. Conferma il test automatizzato del branch, non l'integrazione live. La CI API sul commit documentale `2fb250205556ae967195b08197c618464184b624` risultava ancora in corso al controllo; l'head applicativo API precedente ha CI verde e la Preview documentale precedente è READY.


## Correzione di stato — 25 ottobre 2026

Questa nota prevale sulle righe precedenti che dicevano che la CI bot/API fosse ancora da verificare: bot commit `0ab11b0fab036f27a2ecebbfd8ab7ba580a71274`, run `40235440651`, `success`; API commit documentale `2fb250205556ae967195b08197c618464184b624`, run `40235503317`, `success` con tutti e cinque i job riusciti. La Preview del commit API documentale è `READY`. Rimangono non dimostrati storage E2E, restart Render e integrazione Meta reale.

## Controllo di regressione routing — 25 ottobre 2026

È stato corretto sul branch bot il fallback da MultiVocale V2 al gestore legacy quando V2 non riconosce un messaggio audio o un comando testuale MultiVocale. Sono stati aggiunti test mirati per entrambi i casi. Commit codice `d5e75a618d48a17a1f120153213167134bebe52f`; commit test `ee9127f480746f83cb301822be153ddbfb993244`. La CI del nuovo head deve ancora essere verificata: non considerare chiusa la correzione finché il workflow non è verde. Questa modifica non prova né sostituisce storage reale, restart/recovery, configurazione Meta o test end-to-end.

### Esito verifica routing — 25 ottobre 2026

Confermata verde la CI bot run `40237092071` sul commit `ee9127f480746f83cb301822be153ddbfb993244`; job `test` completato senza fallimenti. La correzione fail-closed per audio/comandi MultiVocale non gestiti è validata a livello automatizzato. Non è una prova di comportamento su Render, Meta o storage live.

## Aggiornamento verifica — 26 ottobre 2026
- CI Assistant API head PR #3 `77ecff859726656a39d2e7b946cd22f96ed7e3fc`: run `40237237326`, tutti e 5 i job della matrice completati con successo.
- CI bot WhatsApp commit `ee9127f480746f83cb301822be153ddbfb993244`: run `40237092071` completata con successo; il run precedente `40237070328` è stato cancellato e non è l'esito finale.
- Le CI verdi non equivalgono a test live. Restano NON ESEGUITI: round-trip reale Supabase Storage e test cross-scope live, prova di recupero dopo riavvio Render, test webhook Meta con firme reali e flusso combinato WhatsApp end-to-end.
- Storage scoped: pianificare compatibilità/migrazione delle chiavi legacy prima del deploy; il nuovo formato rifiuta le chiavi non scoped. Verificare anche che le variabili Preview siano associate al branch candidato corretto.
- PR #3 (Assistant API) e PR #2 (bot) restano Draft/non unite; nessun merge o deploy di produzione autorizzato. Release NO-GO fino al superamento dei gate live. Nessuna nuova risorsa a pagamento, modifica di secret o operazione distruttiva eseguita.
