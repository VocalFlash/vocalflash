# VocalFlash — matrice di accettazione audio → Assistant workflow v1

**Stato:** matrice di accettazione; il sottoinsieme di normalizzazione pura è implementato e coperto da test CI, ma la matrice completa non è stata eseguita end-to-end.  
**Branch di lavoro:** `assistant-conversation-photo-v1`.  
**Scope:** progettare l'ingresso dei vocali nel workflow customer dell'Assistant API senza alterare il comportamento MultiVocale esistente.  
**Vincoli:** nessun merge, deploy, invio WhatsApp reale, modifica al database live o spesa. Le PR API e bot restano Draft.

## 1. Valore prodotto da dimostrare

Riga primaria del Libro sacro: **Sintesi di vocali e messaggi**, con dipendenza diretta da **Classificazione**, **Estrazione dati**, **Domande mirate**, **Contesto persistente** e **Risposta WhatsApp**.

Problema reale: un professionista riceve una richiesta vocale mentre lavora e deve capire rapidamente problema, luogo, disponibilità e prossimo passo senza riascoltare o leggere una trascrizione integrale.

Criteri di valore:
- sintesi fedele e breve, orientata ai fatti/azioni, senza trascrizione integrale automatica;
- nessun dettaglio inventato; campi estratti collegati a evidenza della trascrizione;
- richiesta operativa ambigua o incompleta → domanda mirata, non creazione di pratica;
- nessuna risposta doppia e nessuna affermazione di invio/pratica completata senza stato verificato;
- il flusso MultiVocale esistente resta compatibile e continua a produrre una sola sintesi finale per batch.

## 2. Decisione di routing da mantenere esplicita

Il tipo WhatsApp `audio` non basta da solo a determinare l'intento. Prima di cambiare il routing, il design deve distinguere:
1. **Vocale singolo**: una registrazione; trascrivere, sintetizzare e valutare se contiene una richiesta operativa.
2. **Batch MultiVocale**: più vocali ravvicinati o sessione esplicitamente aperta con comando MultiVocale; aggregare e produrre una sola sintesi finale secondo le regole già esistenti.
3. **Comando MultiVocale**: comandi testuali espliciti, inclusi annulla/riprova/termina, restano nel runtime MultiVocale.
4. **Audio non elaborabile**: download/trascrizione falliti; rispondere in modo controllato se il contratto lo consente, senza inventare contenuto e senza creare una pratica.
5. **Richiesta non chiara/non azionabile**: sintesi utile o domanda di chiarimento; non forzare un workflow.
6. **Richiesta operativa riconosciuta**: passare all'Assistant API soltanto dopo aver definito come conservare trascrizione, sintesi, evidenze, identificativi e idempotenza.

**Non deciso in questa specifica:** se un singolo vocale venga inviato immediatamente all'Assistant API o soltanto dopo una finestra di quiete; come una sessione MultiVocale venga segnalata esplicitamente all'API; il contratto canonico per contenuto audio e trascrizione. Queste decisioni devono precedere qualsiasi modifica al webhook.

## 3. Matrice di accettazione obbligatoria

| ID | Scenario | Risultato atteso | Prova richiesta | Stato |
|---|---|---|---|---|
| A01 | Vocale singolo con richiesta chiara e tutti i dati | Sintesi concisa; estrazione solo di dati espliciti; eventuale workflow candidato validato | Test unitario bot/API + fixture di trascrizione con evidenze | DA ESEGUIRE |
| A02 | Vocale singolo con indirizzo/zona mancante | Domanda mirata sul dato mancante; nessuna pratica creata | Test API e controllo assenza write | DA ESEGUIRE |
| A03 | Vocale singolo non operativo (promemoria, saluto, rumore) | Non forzare classificazione o apertura pratica | Test di routing negativo | DA ESEGUIRE |
| A04 | Due o più vocali ravvicinati | Batch coerente e una sola sintesi finale, senza perdita del primo vocale | Test timing/concorrenza con clock controllato | DA ESEGUIRE |
| A05 | Comando `riepiloga più vocali` durante una sessione | Comportamento MultiVocale attuale preservato | Regressione sui test comandi e batch | DA ESEGUIRE |
| A06 | Comando annulla/riprova/termina | Comando non inviato come richiesta customer ordinaria | Test routing per ogni comando supportato | DA ESEGUIRE |
| A07 | Webhook duplicato per lo stesso audio | Nessuna doppia trascrizione finalizzata/risposta duplicata; dedup correttamente scoped | Test replay con stesso message ID | DA ESEGUIRE |
| A08 | Due audio arrivano simultaneamente o fuori ordine | Nessun batch incrociato tra contatti/account; nessuna perdita o doppia finalizzazione | Test concorrenza con due sender e due account | DA ESEGUIRE |
| A09 | Download media fallisce / URL media scaduto | Errore diagnostico sicuro; nessuna sintesi inventata; stato recuperabile | Test HTTP error e retry controllato | DA ESEGUIRE |
| A10 | Trascrizione fallisce o è vuota | Nessuna classificazione basata su testo inesistente; risposta di errore controllata | Test trascrizione vuota/eccezione | DA ESEGUIRE |
| A11 | Trascrizione contiene negazioni, date, numeri, nomi o termini tecnici | Sintesi preserva elementi critici; incertezza esplicitata | Corpus italiano annotato e revisione umana | DA ESEGUIRE |
| A12 | Messaggio vocale seguito da testo integrativo | Dati conservati nello stesso contesto solo se il contratto di conversazione lo supporta; nessuna contaminazione cross-contact | Test multi-turno con identità e scadenza | BLOCCATO dalla persistenza multi-turno |
| A13 | Assistant API timeout (fino a 120 s) | Esito incerto tracciato; nessun retry cieco che duplichi azioni/risposte | Test timeout e replay; verifica stato lato API | DA ESEGUIRE |
| A14 | API risponde ok ma manca `assistant_message` | Fail-closed, nessun invio vuoto, dedup inbound rilasciata per percorso diagnostico | Test bot già presente per il caso testuale; estendere al percorso audio quando integrato | PARZIALMENTE COPERTO |
| A15 | Invio WhatsApp fallisce con timeout ambiguo | Marcatore at-most-once preservato; non dichiarare consegna; riconciliazione operativa necessaria | Test bot presente per comportamento at-most-once; outbox/reconciliation ancora assenti | PARZIALMENTE COPERTO |
| A16 | Riavvio processo durante batch audio | Batch e media recuperabili senza dipendere da memoria locale | Test restart con Redis/DB/storage durevole | BLOCCATO: stato audio non durevole dimostrato |
| A17 | Stessa trascrizione inviata due volte all'Assistant API | Idempotenza basata su account + sender + ID sorgente; nessuna doppia pratica/evento non previsto | Test di integrazione su ambiente isolato | DA ESEGUIRE |
| A18 | Audio con dati sufficienti ma policy `confirm` | Richiesta di conferma esplicita; nessuna write prima di conferma valida | Test API e database isolato | BLOCCATO: conferma atomica disabilitata |
| A19 | Audio contenente più richieste/workflow | Ambiguità dichiarata e revisione; nessuna suddivisione/creazione automatica | Test multi-workflow | DA ESEGUIRE |
| A20 | Audio di un contatto e batch di un altro contatto concorrenti | Isolamento stretto per account/canale/sender; nessun leak di trascrizioni o contesto | Test adversarial multi-tenant | DA ESEGUIRE |

## 4. Invarianti tecnici

- Non passare il token Meta o altri segreti all'Assistant API.
- Il bot rimane il mittente WhatsApp; l'API restituisce un messaggio esplicito, non invia direttamente al cliente.
- Ogni evento mantiene l'ID WhatsApp sorgente e l'identità account/canale/sender; non usare il solo testo come chiave di deduplica.
- Non considerare Redis dedup/lock equivalente a persistenza durevole della sessione audio o a outbox.
- Una chiamata HTTP con timeout non prova che l'operazione remota non sia avvenuta.
- Le voci terminologiche aiutano a interpretare termini ma non decidono da sole intenti, policy o autorizzazioni.
- Nessuna creazione di pratica finché policy, dati richiesti, identità e conferma valida non sono verificati.
- I messaggi vocali non devono ricevere automaticamente la trascrizione integrale come risposta: il valore primario è la sintesi saliente.
- Test del bot e dell'API separati non equivalgono a un test E2E Meta → bot → API → Supabase → WhatsApp.

## 5. Dipendenze e blocchi prima dell'implementazione

1. Definire il contratto API audio: trascrizione, sintesi, lingua, errori ASR, source message IDs, batch ID, occurred_at e provenienza delle evidenze.
2. Decidere la semantica di fine batch e la priorità tra singolo vocale e MultiVocale esplicito/automatico.
3. Definire persistenza e isolamento per batch/conversazione; il runtime attuale usa ancora stato audio in memoria.
4. Stabilire idempotenza e gestione timeout tra webhook, trascrizione, Assistant API e invio WhatsApp.
5. Predisporre fixture anonime e corpus italiano annotato; niente dati reali non autorizzati.
6. Eseguire test automatici locali/CI e poi staging E2E isolato, solo dopo aver soddisfatto i gate e ottenuto le autorizzazioni per eventuali messaggi reali.
7. Tenere il percorso di scrittura titolare fail-closed finché `ATOMIC_CONFIRMATION_NOT_ENABLED` non è risolto con test di replay, scadenza e concorrenza.

## 6. Gate di uscita della fase design

La fase design è completa soltanto quando sono approvati:
- il contratto audio → Assistant API;
- le regole di delimitazione batch/singolo vocale;
- il modello di stato e idempotenza;
- la matrice di test con fixture e criteri pass/fail;
- il piano di rollout reversibile che non cambia il comportamento legacy prima che la nuova via sia verificata.

Questa matrice non afferma che i test siano stati eseguiti e non autorizza routing, merge o deployment.

## 7. Aggiornamento verificato — 2026-10-24

- Il normalizzatore puro ha test CI verdi per testo, trascrizione singola, batch ordinato, fallimenti ASR, whitelist del payload e timestamp. L'ultimo workflow del branch, commit `c45e01416cf8e0dfc959a6465d3bd26fac235bee`, è concluso con esito **success** (run 40126316962).
- Questo risultato non prova routing audio, dedup persistente, concorrenza del runtime, recupero dopo restart, invio WhatsApp o comportamento E2E. A01–A20 restano da eseguire o parzialmente coperti come indicato nella tabella.
- La coda GitHub Actions non è un blocco permanente: il run prima segnalato come queued è terminato con successo circa un minuto dopo. Il problema era attesa di esecuzione del runner, non una prova di test bloccato.

### Decisioni tecniche proposte per preparare i test

1. Batch parziale ASR: fail closed; nessuna finalizzazione silenziosa di un batch incompleto.
2. Idempotenza: singolo evento per account + sender + ID WhatsApp sorgente; batch per account + sender + batch ID + versione/fingerprint contenuto, con vincolo persistente da verificare.
3. Concorrenza: finalizzazione atomica condivisa, non solo lock locale; un solo risultato finale per batch.
4. Timeout API o WhatsApp: stato incerto, nessun retry cieco di azioni non idempotenti e nessuna falsa dichiarazione di consegna.
5. Restart: test esplicito con processo riavviato e storage durevole. Il nome di una classe o Redis dedup non costituiscono prova sufficiente.
6. Schema: nessuna migrazione finché la fonte SQL autorevole non è riconciliata; i test preparatori devono usare fixture e dipendenze isolate.

**Prossima attività sicura:** aggiungere test unitari per le regole pure di idempotenza/normalizzazione e definire interfacce fake per API/bot. Non collegare il routing reale finché persistenza, idempotenza, parziali ASR e timeout non hanno test verificabili. Nessun merge, deploy o invio reale è stato eseguito.
