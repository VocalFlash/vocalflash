# VocalFlash — contratto proposto audio → Assistant API v1

**Stato:** contratto proposto; normalizzatore puro implementato e coperto da CI sul branch, integrazione runtime/API non implementata.  
**Branch:** `assistant-conversation-photo-v1`.  
**Decisione di sicurezza:** non modificare il routing audio finché questo contratto e i gate della matrice di accettazione non sono approvati e testati.

## 1. Evidenza sul comportamento attuale

La revisione del sorgente della branch `assistant-conversation-photo-v1` conferma:
- `app_customer.py` considera ogni messaggio `audio` candidato MultiVocale e lo passa a `PersistentMultivocaleRuntime`.
- I comandi testuali MultiVocale e i messaggi interattivi seguono lo stesso percorso di runtime.
- Se il runtime non gestisce il messaggio, l'audio torna al gestore legacy; non viene inoltrato all'Assistant API.
- `customer_text_bridge.py` inoltra solo testo ordinario, con `content_type: "text"`, ID del messaggio sorgente e identificativi account/sender.
- `api/v1/assistant.js` richiede `normalized_text` non vuoto e usa il tipo contenuto per l'ingest; il payload corrente non ha campi canonici per trascrizione, evidenze ASR o batch audio.

Quindi non basta cambiare `content_type` a `audio`: la pipeline attuale richiede testo normalizzato e non definisce il contratto per audio, trascrizione o batch. Questa è una conclusione dalla lettura statica, non un test runtime.

## 2. Proposta: un evento normalizzato per ogni messaggio sorgente

Il bot resta responsabile di ricevere il webhook Meta, scaricare il media, trascrivere il vocale e applicare la logica temporale MultiVocale. L'Assistant API riceve un evento normalizzato con testo disponibile e provenienza esplicita; non riceve il token Meta né deve scaricare direttamente il media da Meta.

Campi obbligatori per ogni evento:
- `external_account_id`: ID dell'account/canale WhatsApp associato.
- `sender_wa_id`: mittente originale.
- `external_message_id`: ID univoco del singolo messaggio WhatsApp.
- `occurred_at`: timestamp sorgente se disponibile, altrimenti null.
- `content_type`: valore canonico `text` oppure `audio_transcription`.
- `normalized_text`: testo originale normalizzato per messaggi testuali; per audio, trascrizione verbatim non vuota. La sintesi non deve sostituire la trascrizione alla cieca.
- `payload.source`: origine del dato (`whatsapp_text` o `whatsapp_audio_transcription`).
- `payload.transcription_status`: per audio, `succeeded` solo dopo una trascrizione riuscita.
- `payload.transcription_language`: lingua ASR se disponibile e affidabile.
- `payload.transcription_provider`: identificatore del provider/engine, non credenziali.
- `payload.transcription_version`: versione della pipeline ASR quando disponibile.

Il payload non deve includere token, URL media temporanei, segreti, audio binario o PII non necessari. Se occorre conservare la trascrizione integrale per audit o debug, definirne separatamente retention, accesso e minimizzazione: non presumerne la conservazione permanente.

## 3. Semantica del batch MultiVocale

Un messaggio WhatsApp resta un evento sorgente distinto, anche quando più vocali vengono sintetizzati insieme. Per un batch:
- mantenere l'elenco ordinato degli ID sorgente e il relativo ordine di arrivo;
- mantenere `batch_id` generato dal runtime e stabile per la sessione;
- registrare la ragione di chiusura del batch (`quiet_window`, `explicit_finish`, `manual_summary`, `timeout`);
- produrre un solo evento aggregato verso l'Assistant API dopo la finalizzazione, con testo aggregato delimitato per singolo vocale;
- conservare una mappa tra ogni segmento e il suo `external_message_id`, così le evidenze possono essere ricondotte al vocale corretto;
- applicare idempotenza all'evento aggregato tramite una chiave derivata da account + sender + batch ID + versione del contenuto; l'ID di ogni messaggio sorgente rimane comunque registrato.

Il batch non deve essere inviato all'API una volta per ogni vocale e poi di nuovo come sintesi finale. Il runtime deve scegliere una sola modalità di consegna per sessione.

### Campo aggregato proposto

Per un batch finalizzato, usare un `content_type` distinto, `audio_transcription_batch`, e un `payload.audio_batch` con:
- `batch_id`;
- `source_message_ids` ordinati;
- `finalization_reason`;
- `segments`, ciascuno con `source_message_id`, `transcript`, `occurred_at` e stato ASR.

Il campo `normalized_text` può contenere una concatenazione deterministica delle trascrizioni con delimitatori espliciti tra i segmenti, ma non deve essere l'unica fonte di provenienza. Se un segmento fallisce la trascrizione, il batch non deve fingere che sia completo: la politica (escludere con avviso, ritentare o fallire l'intero batch) è ancora una decisione aperta e deve essere definita prima dell'implementazione.

## 4. Regole di comportamento dell'Assistant

- La risposta WhatsApp è una sintesi orientata all'azione, non una trascrizione integrale automatica.
- La trascrizione è evidenza d'ingresso; non equivale a un dato confermato dal cliente né a una conferma operativa.
- Conservare negazioni, date, importi, quantità, nomi, luoghi e termini professionali; quando ASR o interpretazione sono incerti, esplicitare l'incertezza o chiedere chiarimenti.
- Non inferire indirizzi, diagnosi, urgenza, consenso o autorizzazioni non esplicitati.
- Non aprire una pratica solo perché è arrivato un vocale: classificazione, dati obbligatori, policy e conferma devono passare i rispettivi gate.
- Non rispondere “pratica creata” o “messaggio inviato” se il relativo esito non è verificato.
- I messaggi successivi devono usare contesto persistente con scoping per account, sender e pratica; il testo da solo non è una chiave di correlazione sufficiente.

## 5. Errori e idempotenza

Stati minimi distinti:
- `MEDIA_DOWNLOAD_FAILED`
- `TRANSCRIPTION_FAILED`
- `TRANSCRIPTION_EMPTY`
- `BATCH_PARTIAL_FAILURE`
- `BATCH_FINALIZED`
- `ASSISTANT_INGEST_FAILED`
- `ASSISTANT_ROUTING_FAILED`
- `REPLY_ATTEMPTED`
- `REPLY_CONFIRMED`
- `REPLY_OUTCOME_UNKNOWN`

Gli stati non sono necessariamente valori da scrivere tutti nel database attuale: sono una proposta di contratto operativo. Prima di implementarli occorre mappare lo schema reale e verificare le migrazioni autorevoli.

Regole:
- webhook ripetuto con lo stesso ID sorgente non deve creare una seconda trascrizione finalizzata o una seconda azione;
- un timeout HTTP non prova che la richiesta remota non sia stata eseguita;
- un timeout dell'invio WhatsApp non deve innescare un retry cieco;
- dedup Redis e marker di tentativo non sono outbox durevole né consegna exactly-once;
- gli eventi batch devono essere recuperabili dopo restart, non solo da memoria di processo.

## 6. Decisioni ancora aperte — nessuna va indovinata

1. **Confine batch:** mantenere l'attuale finestra automatica (5 secondi + 4 secondi di grace sul primo audio) o introdurre una regola esplicita per passare al workflow customer? Non cambiare il timing senza regressioni.
2. **Trascrizione parziale:** escludere segmento fallito con avviso oppure bloccare l'intero batch? Proposta prudente: non finalizzare silenziosamente un batch incompleto; rendere esplicita la perdita e richiedere una scelta.
3. **Retention:** per quanto tempo conservare trascrizioni e segmenti, chi può leggerli e come gestire cancellazione?
4. **Schema:** dove persistere batch ID, source IDs, stato ASR e provenienza? Bloccato finché lo schema SQL autorevole non è riconciliato.
5. **Idempotenza API:** identificativo stabile dell'evento aggregato e comportamento di replay devono essere verificati nel percorso di ingest.
6. **Risposta finale:** il bot invia una sola risposta per batch o un riepilogo per sessione? Proposta: una sola risposta finale per batch, coerente con MultiVocale, salvo futura scelta di prodotto.
7. **Conferme e scritture:** mantenere fail-closed finché la conferma atomica non è abilitata e verificata.

## 7. Piano minimo per implementazione sicura

1. Normalizzazione pura e fixture sintetiche: implementate sul branch; CI da confermare sul commit più recente.
2. Confermare le decisioni aperte su batch parziale, retention, idempotenza e risposta finale.
3. Aggiungere test di dedup, batch concorrenti, replay e riavvio nel runtime bot.
4. Estendere il contratto e i test API: l'endpoint attuale non trasferisce ancora i campi canonici del payload al workflow.
5. Riconciliare lo schema SQL autorevole prima di qualsiasi persistenza aggiuntiva.
6. Eseguire CI sui due repository e test d'integrazione isolati.
7. Solo dopo, preparare un rollout reversibile dietro flag e staging isolato; nessun deploy o invio reale senza autorizzazione.

## 8. Gate

Questo documento non autorizza l'implementazione del routing, il cambiamento del timing MultiVocale, DDL sul database live, merge o deployment. La normalizzazione pura è stata aggiunta come `lib/audio-assistant-event-normalizer-v1.js`, con test dedicati. Non è ancora importata da `api/v1/assistant.js` né dal bot. Restano bloccati routing audio, modifiche al timing MultiVocale, DDL sul database live, merge e deployment.
