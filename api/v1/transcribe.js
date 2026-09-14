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

  // --------------------------------------------------
  // CORS
  // --------------------------------------------------

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

  // --------------------------------------------------
  // PREFLIGHT CORS
  // --------------------------------------------------

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --------------------------------------------------
  // SOLO POST
  // --------------------------------------------------

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Usa POST"
    });
  }

  // --------------------------------------------------
  // VERIFICA API KEY VOCALFLASH
  // --------------------------------------------------

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

  // --------------------------------------------------
  // CONTROLLO OPENAI KEY
  // --------------------------------------------------

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

  // --------------------------------------------------
  // LETTURA FORM-DATA
  // --------------------------------------------------

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
          error:
            "File non leggibile"
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

        // --------------------------------------------------
        // CONSERVA ESTENSIONE ORIGINALE
        // --------------------------------------------------
        //
        // Formidable su Vercel può salvare il file
        // temporaneo senza estensione.
        //
        // OpenAI deve invece riconoscere correttamente
        // .ogg, .mp3, .m4a, .wav, ecc.
        // --------------------------------------------------

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
        // 1. TRASCRIZIONE AUDIO
        // ==================================================
        //
        // La trascrizione viene utilizzata SOLO
        // internamente dal motore VocalFlash.
        //
        // NON viene restituita nella risposta API.
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
          transcription.text ||
          "";

        const language =
          transcription.language ||
          null;

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
              type:
                "json_object"
            },

            messages: [

              {
                role:
                  "system",

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

La sintesi deve dipendere dalla quantità e
dall'importanza delle informazioni presenti,
non semplicemente dalla durata del messaggio.

==================================================
REGOLE GENERALI
==================================================

- NON riportare la trascrizione completa.

- NON riscrivere frase per frase il messaggio.

- NON creare una parafrasi lunga del vocale.

- Elimina:
  saluti,
  convenevoli,
  esitazioni,
  ripetizioni,
  intercalari,
  false partenze,
  divagazioni inutili.

- Riassumi il significato,
  non le singole frasi.

- Individua il punto centrale del messaggio.

- Evidenzia:
  decisioni,
  richieste,
  conclusioni,
  appuntamenti,
  scadenze,
  informazioni operative.

- Conserva quando rilevanti:
  date,
  orari,
  luoghi,
  persone,
  aziende,
  cifre,
  importi,
  quantità,
  numeri,
  documenti,
  riferimenti tecnici.

- Non inventare mai informazioni.

- Se un'informazione non è presente,
  non aggiungerla.

- Rispondi in italiano
  anche quando il vocale è in un'altra lingua.

==================================================
SINTESI ADATTIVA
==================================================

La lunghezza della risposta deve dipendere
dalla densità informativa del messaggio.

Se il messaggio contiene una sola informazione:

- restituisci una sintesi molto breve;
- non creare punti inutili.

Se contiene diverse informazioni importanti:

- mantieni una sintesi iniziale compatta;
- utilizza i punti salienti per conservare
  le informazioni che non devono andare perse.

Se il messaggio è lungo o complesso:

- non produrre comunque una trascrizione mascherata;
- organizza le informazioni logicamente;
- elimina tutto ciò che non aggiunge valore.

Evita duplicazioni tra:

summary

e

salient_points.

Un'informazione già espressa chiaramente nella sintesi
non deve essere ripetuta identica nei punti salienti,
a meno che sia necessario per chiarezza.

==================================================
ESTRAZIONE DELLE INFORMAZIONI IMPORTANTI
==================================================

Individua con particolare attenzione:

- appuntamenti
- scadenze
- date
- orari
- luoghi
- importi
- quantità
- persone
- aziende
- decisioni
- richieste
- cambiamenti
- numeri importanti
- documenti
- attività da svolgere

==================================================
CORREZIONI ALL'INTERNO DEL VOCALE
==================================================

Se nel vocale un dato viene corretto,
modificato o sostituito,
considera valido il dato finale.

Esempio:

"Ci vediamo alle 9...
anzi no, facciamo alle 11."

Il dato valido è:

11:00

NON riportare le 9:00
come appuntamento valido.

Non presentare come validi
dati successivamente:

- annullati
- sostituiti
- corretti
- modificati

==================================================
DECISIONE VS IPOTESI
==================================================

Distingui sempre tra:

- decisione definitiva
- proposta
- ipotesi
- possibilità
- informazione incerta

Esempio:

"Ci vediamo venerdì alle 10"

può essere un appuntamento confermato.

"Potremmo vederci venerdì alle 10"

è una proposta.

Non trasformare una proposta
in una decisione definitiva.

==================================================
SCADENZE E DATE
==================================================

Distingui una vera scadenza
da una semplice data menzionata.

Esempio:

"Il contratto è stato firmato lunedì"

NON significa che lunedì
sia una scadenza.

"Mandami il contratto entro lunedì"

indica invece una scadenza.

==================================================
DATE RELATIVE
==================================================

Se vengono utilizzate espressioni come:

- oggi
- domani
- dopodomani
- lunedì prossimo
- questa sera
- la settimana prossima

non trasformarle arbitrariamente
in date assolute
se non possiedi informazioni sufficienti
per farlo con certezza.

Mantieni l'espressione originale
quando necessario.

==================================================
IMPORTI E NUMERI
==================================================

Quando viene indicato un importo,
mantieni:

- valore
- valuta
- eventuali decimali
- contesto

Esempio:

"Il preventivo è di 2.500 euro"

deve mantenere
sia l'importo
sia il fatto che si tratta del preventivo.

Non trasformare numeri
senza comprenderne il contesto.

==================================================
PERSONE E ORGANIZZAZIONI
==================================================

Riporta soltanto:

- persone
- professionisti
- aziende
- organizzazioni
- enti

realmente presenti nella trascrizione.

Non inventare:

- cognomi
- ruoli
- aziende
- qualifiche
- relazioni tra persone

che non siano deducibili dal messaggio.

==================================================
RICONOSCIMENTO AUTOMATICO DEL CONTESTO PROFESSIONALE
==================================================

Riconosci automaticamente l'ambito professionale
quando è chiaramente deducibile dal contenuto.

Gli ambiti possono includere,
a titolo di esempio:

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
- consulenza
- altri settori professionali

Non sei limitato a questo elenco.

Se riconosci un settore professionale,
comprendi il messaggio utilizzando
il significato corretto dei termini
in quel contesto.

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
- prodotti
- pratiche
- concetti specialistici

Non semplificare un termine tecnico
se la semplificazione ne altera il significato.

Non inventare gergo tecnico
che non sia presente o chiaramente implicato.

Se un termine tecnico è ambiguo,
non correggerlo arbitrariamente.

==================================================
CONTESTO GENERICO
==================================================

Se non è possibile individuare
con sufficiente sicurezza
un settore professionale specifico:

usa:

"generico"

Non forzare mai
la classificazione professionale.

==================================================
AMBITO MEDICO / SANITARIO
==================================================

Puoi riconoscere e mantenere
terminologia medica realmente presente
nel messaggio.

NON:

- formulare nuove diagnosi
- prescrivere farmaci
- aggiungere terapie
- aggiungere indicazioni cliniche
- formulare conclusioni mediche
  non presenti nel vocale

Il compito è sintetizzare
ciò che è stato detto.

==================================================
TASK
==================================================

Estrai un task SOLTANTO
se dal vocale emerge realmente
un'attività da svolgere.

Esempio:

"Mandami il contratto entro venerdì"

può generare un task.

Non trasformare automaticamente:

- ogni informazione
- ogni data
- ogni appuntamento
- ogni persona citata

in un task.

Se una frase è soltanto ipotetica,
non creare un task definitivo.

Se non esistono attività da svolgere:

restituisci:

[]

==================================================
OUTPUT
==================================================

Devi restituire ESCLUSIVAMENTE
un JSON valido.

La struttura deve essere:

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
REGOLE JSON
==================================================

- Restituisci esclusivamente JSON valido.

- Non aggiungere testo prima del JSON.

- Non aggiungere testo dopo il JSON.

- Usa array vuoti quando non esistono elementi.

- Non inserire proprietà aggiuntive.

- Non inventare valori mancanti.

- Se deadline non è presente:
  usa null.

- Se time non è presente:
  usa null.

- summary deve essere una stringa.

- salient_points deve essere un array.

- important_details deve essere un array.

- tasks deve essere un array.

- Non includere la trascrizione completa
  all'interno di nessun campo.
`
              },

              {
                role:
                  "user",

                content:
                  transcript
              }

            ]

          });

        // ==================================================
        // 3. LETTURA RISPOSTA GPT
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
        // IMPORTANTE:
        //
        // transcript NON viene restituito.
        //
        // La trascrizione viene utilizzata
        // esclusivamente all'interno
        // del processo VocalFlash.
        // ==================================================

        return res.status(200).json({

          ok:
            true,

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

        // Non restituiamo al client
        // dettagli tecnici interni.

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
