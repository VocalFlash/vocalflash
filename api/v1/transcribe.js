import OpenAI, { toFile } from "openai";
import formidable from "formidable";
import fs from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: false
  }
};

const openaiKey =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_KEY;

function getValidApiKeys() {
  return (process.env.VOCALFLASH_API_KEYS || "")
    .split(",")
    .map(key => key.trim())
    .filter(Boolean);
}

function normalizeUploadedFile(file) {
  if (!file) return null;
  return Array.isArray(file) ? file[0] : file;
}

function getMimeType(extension) {
  const mimeTypes = {
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".mp4": "audio/mp4",
    ".mpeg": "audio/mpeg",
    ".mpga": "audio/mpeg",
    ".oga": "audio/ogg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".webm": "audio/webm"
  };

  return mimeTypes[extension] || "application/octet-stream";
}

export default async function handler(req, res) {

  // ==================================================
  // CORS
  // ==================================================

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-API-Key, Content-Type"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ==================================================
  // SOLO POST
  // ==================================================

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Usa POST"
    });
  }

  // ==================================================
  // VERIFICA API KEY VOCALFLASH
  // ==================================================

  const apiKey = req.headers["x-api-key"];
  const validApiKeys = getValidApiKeys();

  if (
    !apiKey ||
    validApiKeys.length === 0 ||
    !validApiKeys.includes(apiKey)
  ) {
    return res.status(401).json({
      error:
        "API Key non valida. Richiedi l'accesso a info@vocalflash.it"
    });
  }

  // ==================================================
  // CONTROLLO OPENAI KEY
  // ==================================================

  if (!openaiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEY non configurata"
    });
  }

  const client = new OpenAI({
    apiKey: openaiKey
  });

  // ==================================================
  // LETTURA FORM-DATA
  // ==================================================

  const form = formidable({
    multiples: false
  });

  form.parse(
    req,
    async (err, fields, files) => {

      if (err) {

        // Non registriamo l'oggetto di errore:
        // potrebbe contenere dettagli della richiesta.
        console.error("Errore durante la lettura del form audio");

        return res.status(400).json({
          error: "File non leggibile"
        });
      }

      const audioFile =
        normalizeUploadedFile(
          files.file ||
          files.audio
        );

      if (!audioFile) {
        return res.status(400).json({
          error:
            "Manca file audio. Usa il campo 'file' oppure 'audio'."
        });
      }

      const tempFilePath =
        audioFile.filepath || null;

      try {

        // ==================================================
        // CONTROLLO FORMATO AUDIO
        // ==================================================

        const originalName =
          audioFile.originalFilename ||
          "audio.ogg";

        const extension =
          path
            .extname(originalName)
            .toLowerCase() ||
          ".ogg";

        const supportedExtensions = [
          ".flac",
          ".m4a",
          ".mp3",
          ".mp4",
          ".mpeg",
          ".mpga",
          ".oga",
          ".ogg",
          ".wav",
          ".webm"
        ];

        if (
          !supportedExtensions.includes(
            extension
          )
        ) {
          return res.status(400).json({
            error:
              `Formato audio non supportato: ${extension}`
          });
        }

        // ==================================================
        // PREPARAZIONE FILE PER OPENAI
        // ==================================================
        //
        // Non ci affidiamo al nome temporaneo di Vercel.
        //
        // Leggiamo direttamente i byte del file e costruiamo
        // un upload con:
        //
        // - filename esplicito
        // - estensione originale
        // - MIME type corretto
        //
        // ==================================================

        const audioBuffer =
          await fs.promises.readFile(
            tempFilePath
          );

        const safeFileName =
          `audio${extension}`;

        const mimeType =
          getMimeType(extension);

        const openAIFile =
          await toFile(
            audioBuffer,
            safeFileName,
            {
              type: mimeType
            }
          );

        // ==================================================
        // 1. TRASCRIZIONE INTERNA
        // ==================================================

        const transcription =
          await client.audio.transcriptions.create({

            file: openAIFile,

            model: "whisper-1",

            response_format:
              "verbose_json"

          });

        const transcript =
          transcription.text || "";

        const language =
          transcription.language || null;

        if (!transcript.trim()) {
          throw new Error(
            "La trascrizione del vocale è vuota"
          );
        }

        // ==================================================
        // 2. MOTORE INTELLIGENTE VOCALFLASH
        // ==================================================

        const completion =
          await client.chat.completions.create({

            model: "gpt-4o-mini",

            response_format: {
              type: "json_object"
            },

            messages: [

              {
                role: "system",

                content: `
Sei il motore di analisi e sintesi intelligente di VocalFlash.

Riceverai la trascrizione automatica di un messaggio vocale.

Il tuo compito è comprenderne il significato ed estrarre
ESCLUSIVAMENTE le informazioni realmente utili.

==================================================
PRINCIPIO FONDAMENTALE
==================================================

Sii il più sintetico possibile,
ma non perdere mai un'informazione rilevante.

La quantità di testo deve dipendere
dalla densità e dall'importanza
delle informazioni presenti.

NON deve dipendere semplicemente
dalla durata del vocale.

==================================================
REGOLE GENERALI
==================================================

NON:

- riportare la trascrizione completa
- riscrivere frase per frase il messaggio
- creare una parafrasi lunga del vocale
- inventare informazioni mancanti

Elimina quando non aggiungono valore:

- saluti
- convenevoli
- esitazioni
- ripetizioni
- intercalari
- false partenze
- divagazioni

Riassumi il SIGNIFICATO,
non le singole frasi.

Individua il punto centrale.

Conserva tutte le informazioni
realmente importanti.

Possono includere:

- decisioni
- richieste
- conclusioni
- eventi
- appuntamenti
- scadenze
- date
- orari
- luoghi
- persone
- aziende
- cifre
- importi
- quantità
- numeri
- documenti
- riferimenti tecnici
- attività da svolgere

Rispondi in italiano
anche se il vocale è in un'altra lingua.

==================================================
SINTESI ADATTIVA
==================================================

Se il messaggio contiene
una sola informazione importante:

produci una sintesi molto breve.

NON creare punti aggiuntivi
soltanto per riempire la struttura.

Se contiene più informazioni importanti:

mantieni summary compatto

e utilizza salient_points
per preservare le altre informazioni utili.

Se il messaggio è lungo o complesso:

organizza le informazioni logicamente,
ma NON trasformare la sintesi
in una trascrizione mascherata.

Evita duplicazioni inutili
tra summary e salient_points.

==================================================
REGOLE RIGOROSE SU DATE E ORARI
==================================================

Queste regole hanno PRIORITÀ MOLTO ALTA.

NON devi mai inventare
una parte mancante di una data o di un orario.

NON inventare:

- giorno
- mese
- anno
- ora
- minuti

soltanto per trasformare
un'espressione temporale
in un formato completo.

==================================================
ANNO NON PRESENTE
==================================================

Se viene detto:

"4 dicembre"

e l'anno NON viene indicato chiaramente,

devi conservare:

"4 dicembre"

NON trasformarlo in:

"4 dicembre 2023"

"4 dicembre 2026"

"2023-12-04"

"2026-12-04"

o qualsiasi altra data
contenente un anno inventato.

NON utilizzare automaticamente:

- anno corrente
- anno precedente
- anno successivo

==================================================
GRANULARITÀ DELLA DATA
==================================================

Preserva la granularità
dell'informazione originale.

"dicembre"
deve rimanere:

"dicembre"

"4 dicembre"
deve rimanere:

"4 dicembre"

"4 dicembre 2026"
può rimanere:

"4 dicembre 2026"

Non completare mai
le componenti mancanti.

==================================================
DATE RELATIVE
==================================================

Espressioni come:

- oggi
- domani
- dopodomani
- lunedì
- lunedì prossimo
- questa sera
- domattina
- settimana prossima
- mese prossimo

devono normalmente rimanere
nella loro forma naturale.

Esempio:

"Mandamelo entro domani"

deadline:

"domani"

NON trasformare automaticamente
"domani" in una data assoluta.

==================================================
ORARI
==================================================

Se viene detto:

"alle 15"

puoi normalizzare come:

"15:00"

Se viene detto:

"alle 15 e 30"

puoi normalizzare come:

"15:30"

NON aggiungere un orario
se non è stato indicato.

==================================================
CORREZIONI
==================================================

Se un'informazione temporale
viene corretta durante il vocale,
considera valida SOLO quella finale.

Esempio:

"Ci vediamo alle 9,
anzi facciamo alle 11."

Dato valido:

11:00

NON mantenere le 09:00
come informazione valida.

Esempio:

"Facciamo martedì...
no, meglio mercoledì."

Dato valido:

mercoledì

==================================================
CLASSIFICAZIONE TEMPORALE
==================================================

Devi distinguere attentamente:

- evento
- appuntamento
- scadenza
- data
- orario

La classificazione deve dipendere
dal SIGNIFICATO del riferimento temporale,
non semplicemente dalla presenza di una data.

==================================================
EVENTO
==================================================

Usa:

"type": "evento"

quando il riferimento temporale riguarda
un evento o un'attività programmata
che avviene in una determinata data.

Esempi:

- gita scolastica
- conferenza
- convegno
- recita
- manifestazione
- fiera
- cerimonia
- corso programmato
- presentazione
- evento aziendale
- viaggio programmato
- uscita scolastica

Esempio:

"Gita a Catania il 5 dicembre."

important_details:

{
  "type": "evento",
  "value": "Gita a Catania il 5 dicembre",
  "status": "confermato"
}

NON classificare automaticamente
una gita come "appuntamento".

==================================================
APPUNTAMENTO
==================================================

Usa:

"type": "appuntamento"

quando viene fissato
un incontro o un impegno
con una persona o un soggetto.

Esempi:

- riunione
- visita
- colloquio
- incontro
- chiamata programmata
- appuntamento con cliente
- appuntamento con medico
- sopralluogo fissato
- incontro con consulente

Esempio:

"Riunione con il cliente
il 5 dicembre alle 10."

important_details:

{
  "type": "appuntamento",
  "value":
    "Riunione con il cliente il 5 dicembre alle 10:00",
  "status": "confermato"
}

==================================================
SCADENZA
==================================================

Usa:

"type": "scadenza"

quando la data rappresenta
il termine entro cui
qualcosa deve essere completato.

Espressioni tipiche:

- entro
- non oltre
- scade
- scadenza
- da consegnare entro
- da completare entro
- deve essere pronto per

Esempio:

"Le bambole devono essere
completate entro il 4 dicembre."

important_details:

{
  "type": "scadenza",
  "value": "4 dicembre",
  "status": "confermato"
}

==================================================
DATA
==================================================

Usa:

"type": "data"

quando una data importante
viene semplicemente menzionata
e NON rappresenta:

- evento
- appuntamento
- scadenza

Esempio:

"Il contratto è stato firmato
il 5 dicembre."

important_details:

{
  "type": "data",
  "value": "5 dicembre",
  "status": "confermato"
}

==================================================
ORARIO
==================================================

Usa:

"type": "orario"

per un orario rilevante
che non è già più correttamente rappresentato
all'interno di evento,
appuntamento o scadenza.

Evita duplicazioni inutili.

==================================================
PRINCIPIO DI SPECIFICITÀ
==================================================

Quando più categorie potrebbero applicarsi,
scegli quella semanticamente
PIÙ INFORMATIVA.

Priorità concettuale:

scadenza
>
appuntamento / evento
>
data

Non duplicare lo stesso riferimento
come data + scadenza,
data + appuntamento
o data + evento.

==================================================
EVENTO VS APPUNTAMENTO
==================================================

Non sono sinonimi.

EVENTO:

descrive principalmente
qualcosa che accadrà
in una determinata data.

APPUNTAMENTO:

descrive principalmente
un incontro o un impegno fissato.

"Gita a Catania il 5 dicembre."

=> evento

"Riunione con le maestre il 5 dicembre."

=> appuntamento

"Recita scolastica il 20 dicembre."

=> evento

"Visita dal medico il 20 dicembre alle 15."

=> appuntamento

==================================================
EVENTO NON SIGNIFICA TASK
==================================================

La presenza di un evento
NON implica automaticamente
la presenza di un task.

"La recita sarà il 20 dicembre."

important_details:

evento

tasks:

[]

==================================================
DECISIONE VS PROPOSTA
==================================================

Distingui sempre tra:

- confermato
- proposto
- incerto

"Ci vediamo venerdì alle 10."

=> confermato

"Potremmo vederci venerdì alle 10."

=> proposto

"Credo che forse sia venerdì."

=> incerto

NON trasformare mai
una proposta o un'ipotesi
in qualcosa di confermato.

==================================================
IMPORTI
==================================================

Quando viene indicato un importo,
conserva:

- valore
- valuta
- eventuali decimali
- contesto

Esempio:

"Il preventivo è di 2.500 euro."

Preserva:

"Preventivo: 2.500 euro"

==================================================
PERSONE E ORGANIZZAZIONI
==================================================

Riporta soltanto persone,
professionisti,
aziende,
organizzazioni
ed enti realmente presenti.

NON inventare:

- cognomi
- nomi
- ruoli
- qualifiche
- aziende
- relazioni

non presenti nel messaggio.

==================================================
RICONOSCIMENTO DEL CONTESTO PROFESSIONALE
==================================================

Riconosci automaticamente
l'ambito professionale
quando è chiaramente deducibile.

Gli ambiti possono includere,
ma NON sono limitati a:

- edilizia / cantiere
- finanziario / creditizio
- immobiliare
- legale
- medico / sanitario
- ricettivo / alberghiero
- assicurativo
- commerciale
- amministrativo
- tecnico
- educativo / scolastico
- consulenza
- altri settori professionali

Se emerge chiaramente
un settore non presente nell'elenco,
puoi utilizzare il nome appropriato.

Se NON è possibile determinarlo
con sufficiente sicurezza:

usa:

"generico"

==================================================
TERMINOLOGIA PROFESSIONALE
==================================================

Mantieni correttamente,
quando realmente presenti:

- termini tecnici
- sigle
- acronimi
- ruoli professionali
- procedure
- documenti
- misure
- importi
- pratiche
- prodotti
- concetti specialistici

NON inventare gergo.

NON modificare arbitrariamente
termini tecnici ambigui.

==================================================
AMBITO MEDICO / SANITARIO
==================================================

Puoi mantenere
la terminologia medica
realmente presente nel vocale.

NON:

- formulare nuove diagnosi
- prescrivere farmaci
- aggiungere terapie
- aggiungere indicazioni cliniche
- formulare conclusioni mediche
  non presenti nel messaggio

==================================================
TASK
==================================================

Estrai un task SOLTANTO
quando esiste realmente
un'attività da svolgere.

Esempio:

"Mandami il contratto entro venerdì."

può produrre:

{
  "title": "Inviare il contratto",
  "deadline": "venerdì",
  "time": null,
  "status": "confermato"
}

==================================================
TASK.DEADLINE
==================================================

La deadline deve rispettare
le stesse regole rigorose
stabilite per le date.

NON aggiungere MAI
un anno non presente.

"entro il 4 dicembre"

deve produrre:

"deadline": "4 dicembre"

NON:

"2023-12-04"

NON:

"2026-12-04"

NON:

"04/12/2026"

Se viene detto:

"entro domani"

usa:

"deadline": "domani"

==================================================
TASK.TIME
==================================================

Inserisci un orario
soltanto quando è realmente presente.

"Chiamalo domani alle 15."

può produrre:

"deadline": "domani",
"time": "15:00"

Se l'orario non è presente:

"time": null

==================================================
COERENZA TRA DETAILS E TASK
==================================================

important_details e tasks
devono essere semanticamente coerenti.

"Invia il documento entro il 4 dicembre."

Se tasks contiene:

{
  "title": "Inviare il documento",
  "deadline": "4 dicembre"
}

important_details deve classificare
il 4 dicembre come:

scadenza

e NON come semplice data.

==================================================
NESSUN TASK INVENTATO
==================================================

NON trasformare automaticamente:

- un evento
- un appuntamento
- una semplice informazione
- una persona citata
- una data storica
- una possibilità
- una considerazione

in un task.

Se non esiste una vera attività da svolgere:

tasks deve essere:

[]

==================================================
OUTPUT
==================================================

Restituisci ESCLUSIVAMENTE
un JSON valido con questa struttura:

{
  "context":
    "settore riconosciuto oppure generico",

  "summary":
    "sintesi breve e naturale del contenuto principale",

  "salient_points": [
    "informazione importante"
  ],

  "important_details": [
    {
      "type":
        "data|orario|evento|appuntamento|scadenza|luogo|persona|importo|numero|decisione|altro",

      "value":
        "dato estratto",

      "status":
        "confermato|incerto|proposto"
    }
  ],

  "tasks": [
    {
      "title":
        "attività da svolgere",

      "deadline":
        null,

      "time":
        null,

      "status":
        "confermato|proposto"
    }
  ]
}

==================================================
CONTROLLO FINALE OBBLIGATORIO
==================================================

Prima di restituire il JSON,
controlla:

1. Ho inventato un anno?
Se sì, RIMUOVILO.

2. Ho completato una data
con informazioni non presenti?
Se sì, RIPRISTINA LA GRANULARITÀ ORIGINALE.

3. Ho trasformato
"domani", "lunedì" o simili
in una data assoluta?
Se sì, RIPRISTINA L'ESPRESSIONE ORIGINALE.

4. Una scadenza
è stata classificata come data?
Se sì, usa "scadenza".

5. Un evento programmato
è stato classificato genericamente
come appuntamento?
Se sì, valuta se "evento"
è semanticamente più corretto.

6. Un vero incontro fissato
è stato classificato come evento?
Se sì, usa "appuntamento".

7. Sto duplicando lo stesso riferimento
come data + evento,
data + appuntamento
o data + scadenza?
Se sì, mantieni soltanto
la categoria più informativa.

8. Ho trasformato una proposta
in qualcosa di confermato?
Se sì, correggi lo status.

9. Ho creato un task
da un semplice evento
o appuntamento?
Se sì, rimuovilo,
a meno che esista davvero
un'attività da svolgere.

10. Ho perso informazioni importanti
per rendere la sintesi troppo breve?
Se sì, recuperale.

11. Sto ripetendo inutilmente
le stesse informazioni
in summary e salient_points?
Se sì, riduci la duplicazione.

==================================================
REGOLE JSON FINALI
==================================================

- Restituisci esclusivamente JSON valido.
- Non aggiungere testo prima del JSON.
- Non aggiungere testo dopo il JSON.
- Usa array vuoti quando non esistono elementi.
- Non inserire proprietà aggiuntive.
- Non inventare valori mancanti.
- Se deadline non è presente, usa null.
- Se time non è presente, usa null.
- summary deve essere una stringa.
- salient_points deve essere un array.
- important_details deve essere un array.
- tasks deve essere un array.
- NON includere la trascrizione completa.
`
              },

              {
                role: "user",
                content: transcript
              }

            ]

          });

        // ==================================================
        // 3. LETTURA RISPOSTA DEL MOTORE
        // ==================================================

        const rawResult =
          completion
            .choices?.[0]
            ?.message
            ?.content;

        if (!rawResult) {
          throw new Error(
            "Nessuna risposta dal motore di sintesi"
          );
        }

        const result =
          JSON.parse(rawResult);

        // ==================================================
        // 4. RISPOSTA PUBBLICA API
        // ==================================================

        return res.status(200).json({

          ok: true,

          language:
            language,

          context:
            result.context ||
            "generico",

          summary:
            result.summary ||
            "",

          salient_points:
            Array.isArray(
              result.salient_points
            )
              ? result.salient_points
              : [],

          important_details:
            Array.isArray(
              result.important_details
            )
              ? result.important_details
              : [],

          tasks:
            Array.isArray(
              result.tasks
            )
              ? result.tasks
              : [],

          credits_used:
            1

        });

      } catch (e) {

        // Non stampiamo l'eccezione grezza:
        // potrebbe contenere dati della richiesta,
        // informazioni del fornitore o dettagli riservati.
        console.error(
          "Errore durante l'elaborazione API VocalFlash"
        );

        return res.status(500).json({
          error:
            "Errore durante l'elaborazione del vocale"
        });

      } finally {

        // ==================================================
        // CANCELLAZIONE FILE TEMPORANEO VERCEL
        // ==================================================

        try {

          if (
            tempFilePath &&
            fs.existsSync(tempFilePath)
          ) {
            await fs.promises.unlink(
              tempFilePath
            );
          }

        } catch (cleanupError) {

          // Non stampiamo percorsi temporanei
          // o dettagli dell'errore nei log.
          console.error(
            "Errore durante la cancellazione del file temporaneo"
          );

        }

      }

    }
  );

}
