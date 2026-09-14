import OpenAI from "openai";
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

  const apiKey =
    req.headers["x-api-key"];

  const validApiKeys =
    getValidApiKeys();

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
      error:
        "OPENAI_API_KEY non configurata"
    });

  }

  const client =
    new OpenAI({
      apiKey: openaiKey
    });

  // ==================================================
  // LETTURA FORM-DATA
  // ==================================================

  const form =
    formidable({
      multiples: false
    });

  form.parse(
    req,
    async (err, fields, files) => {

      if (err) {

        console.error(
          "Errore parsing form:",
          err
        );

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

      let filePath = null;

      try {

        // ==================================================
        // CONSERVAZIONE ESTENSIONE AUDIO
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

        const tempFilePath =
          audioFile.filepath;

        filePath =
          `${tempFilePath}${extension}`;

        await fs.promises.rename(
          tempFilePath,
          filePath
        );

        // ==================================================
        // 1. TRASCRIZIONE
        // ==================================================
        //
        // Utilizzata internamente.
        // Non viene restituita al client.
        // ==================================================

        const transcription =
          await client.audio.transcriptions.create({

            file:
              fs.createReadStream(
                filePath
              ),

            model:
              "whisper-1",

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

            model:
              "gpt-4o-mini",

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

In particolare:

NON inventare:

- giorno
- mese
- anno
- ora
- minuti

soltanto per trasformare
un'espressione in un formato completo.

==================================================
ANNO NON PRESENTE
==================================================

Se nel messaggio viene detto:

"4 dicembre"

e NON viene pronunciato o stabilito chiaramente
l'anno,

devi conservare:

"4 dicembre"

NON devi trasformarlo in:

"4 dicembre 2023"

"4 dicembre 2026"

"2023-12-04"

"2026-12-04"

o qualsiasi altra data
contenente un anno inventato.

Questa regola vale SEMPRE,
anche se pensi di poter dedurre l'anno
dalla data corrente.

NON usare automaticamente
l'anno corrente.

NON usare automaticamente
l'anno precedente.

NON usare automaticamente
l'anno successivo.

==================================================
DATA COMPLETA
==================================================

Puoi utilizzare una data completa
soltanto se tutte le sue componenti
sono realmente presenti
o ricavabili senza ambiguità
dal contenuto del messaggio.

Esempio:

"4 dicembre 2026"

può essere riportato come:

"4 dicembre 2026"

Non è necessario convertire
la data in formato ISO.

Preferisci preservare
la forma naturale pronunciata.

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
- la settimana prossima
- il mese prossimo

devono normalmente essere mantenute
nella loro forma naturale.

Esempio:

"Mandamelo entro domani"

deadline:

"domani"

NON:

"2026-09-15"

a meno che la conversione
sia esplicitamente richiesta
e sia disponibile un riferimento temporale certo.

==================================================
ORARI
==================================================

Se viene detto:

"alle 15"

puoi riportare:

"15:00"

perché si tratta soltanto
di una normalizzazione dell'orario espresso.

Ma NON devi aggiungere un orario
se non è stato indicato.

Esempio:

"Ci vediamo martedì"

NON deve diventare:

"martedì alle 09:00"

==================================================
CORREZIONI DI DATE E ORARI
==================================================

Se un dato viene corretto durante il vocale,
considera valido SOLO quello finale.

Esempio:

"Ci vediamo alle 9,
anzi facciamo alle 11."

Orario valido:

11:00

NON riportare le 09:00
come appuntamento valido.

Altro esempio:

"Facciamo martedì...
no, meglio mercoledì."

La data valida è:

mercoledì

NON martedì.

==================================================
DATA VS SCADENZA VS APPUNTAMENTO
==================================================

Devi distinguere semanticamente
il ruolo della data.

Non classificare automaticamente
ogni riferimento temporale come "data".

------------------------------
SCADENZA
------------------------------

Una data è una SCADENZA
quando indica il termine entro cui
deve essere completata un'attività.

Esempio:

"Mandami il documento entro il 4 dicembre."

important_details:

{
  "type": "scadenza",
  "value": "4 dicembre",
  "status": "confermato"
}

------------------------------
APPUNTAMENTO
------------------------------

Una data è un APPUNTAMENTO
quando indica un incontro,
una riunione,
una visita,
un evento programmato
o un'attività fissata nel tempo.

Esempio:

"Ci vediamo il 5 dicembre alle 10."

important_details può contenere:

{
  "type": "appuntamento",
  "value": "5 dicembre alle 10:00",
  "status": "confermato"
}

------------------------------
DATA
------------------------------

Usa "data" quando il riferimento temporale
è importante ma NON rappresenta
né una scadenza né un appuntamento.

==================================================
DECISIONE VS PROPOSTA
==================================================

Distingui sempre tra:

- confermato
- proposto
- incerto

Esempio:

"Ci vediamo venerdì alle 10."

può essere:

confermato

"Potremmo vederci venerdì alle 10."

deve essere:

proposto

"Credo che forse sia venerdì."

deve essere:

incerto

NON trasformare mai
una proposta o un'ipotesi
in una decisione definitiva.

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

Non limitarti a:

"2.500"

Preserva il significato:

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
- relazioni tra persone

non presenti o non deducibili
dal messaggio.

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

NON forzare la classificazione.

==================================================
TERMINOLOGIA PROFESSIONALE
==================================================

Mantieni correttamente
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

Il compito è sintetizzare
ciò che è stato detto.

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
REGOLA FONDAMENTALE PER TASK.DEADLINE
==================================================

La deadline del task deve rispettare
ESATTAMENTE le stesse regole
stabilite per le date.

NON aggiungere MAI
un anno non presente.

Esempio:

"Preparare il materiale entro il 4 dicembre."

CORRETTO:

"deadline": "4 dicembre"

ERRATO:

"deadline": "2023-12-04"

ERRATO:

"deadline": "2026-12-04"

ERRATO:

"deadline": "04/12/2026"

Se viene detto:

"entro domani"

usa:

"deadline": "domani"

NON convertire automaticamente
in una data assoluta.

==================================================
TASK.TIME
==================================================

Inserisci un orario
soltanto quando è realmente presente.

Esempio:

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

Esempio:

"Invia il documento entro il 4 dicembre."

Se tasks contiene:

{
  "title": "Inviare il documento",
  "deadline": "4 dicembre"
}

important_details dovrebbe classificare
"4 dicembre" come:

"scadenza"

e NON semplicemente come:

"data"

==================================================
NESSUN TASK INVENTATO
==================================================

NON trasformare automaticamente:

- una semplice informazione
- una persona citata
- una data storica
- un appuntamento
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
  "context": "settore riconosciuto oppure generico",

  "summary":
    "sintesi breve e naturale del contenuto principale",

  "salient_points": [
    "informazione importante"
  ],

  "important_details": [
    {
      "type":
        "data|orario|appuntamento|scadenza|luogo|persona|importo|numero|decisione|altro",

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
esegui mentalmente questi controlli:

1. Ho inventato un anno?

Se sì:
RIMUOVILO.

2. Ho trasformato una data incompleta
in una data completa?

Se sì:
RIPRISTINA LA FORMA ORIGINALE.

3. Ho trasformato "domani",
"lunedì" o espressioni simili
in una data assoluta?

Se sì:
RIPRISTINA L'ESPRESSIONE ORIGINALE.

4. Una scadenza è stata classificata
semplicemente come "data"?

Se sì:
CLASSIFICALA COME "scadenza".

5. Un appuntamento è stato classificato
semplicemente come "data"?

Se sì:
CLASSIFICALO COME "appuntamento"
quando semanticamente appropriato.

6. Ho trasformato una proposta
in qualcosa di confermato?

Se sì:
CORREGGI LO STATUS.

7. Ho creato un task
che non rappresenta realmente
un'attività da svolgere?

Se sì:
RIMUOVILO.

8. Ho perso un'informazione importante
per rendere la risposta troppo breve?

Se sì:
RECUPERALA.

9. Sto ripetendo inutilmente
la stessa informazione
in summary e salient_points?

Se sì:
ELIMINA LA DUPLICAZIONE.

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
          JSON.parse(
            rawResult
          );

        // ==================================================
        // 4. RISPOSTA PUBBLICA API
        // ==================================================
        //
        // La trascrizione NON viene restituita.
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

        // ==================================================
        // LOG TECNICO VERCEL
        // ==================================================

        console.error(
          "Errore VocalFlash API:",
          e
        );

        return res.status(500).json({
          error:
            "Errore durante l'elaborazione del vocale"
        });

      } finally {

        // ==================================================
        // CANCELLAZIONE FILE TEMPORANEO
        // ==================================================

        try {

          if (
            filePath &&
            fs.existsSync(
              filePath
            )
          ) {

            await fs.promises.unlink(
              filePath
            );

          }

        } catch (cleanupError) {

          console.error(
            "Errore cancellazione file temporaneo:",
            cleanupError
          );

        }

      }

    }
  );

}
