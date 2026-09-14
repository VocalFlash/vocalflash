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

  res.setHeader("Access-Control-Allow-Origin", "*");
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

  // --------------------------------------------------
  // CONTROLLO OPENAI KEY
  // --------------------------------------------------

  if (!openaiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEY non configurata"
    });
  }

  const client = new OpenAI({
    apiKey: openaiKey
  });

  // --------------------------------------------------
  // LETTURA FORM-DATA
  // --------------------------------------------------

  const form = formidable({
    multiples: false
  });

  form.parse(req, async (err, fields, files) => {

    if (err) {

      console.error(
        "Errore parsing form:",
        err
      );

      return res.status(400).json({
        error: "File non leggibile"
      });
    }

    const audioFile = normalizeUploadedFile(
      files.file || files.audio
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
      // CONSERVA ESTENSIONE ORIGINALE DEL FILE
      //
      // Formidable su Vercel può creare il file temporaneo
      // senza estensione.
      //
      // OpenAI ha invece bisogno di riconoscere correttamente
      // il formato: .ogg, .mp3, .m4a, .wav, ecc.
      // --------------------------------------------------

      const originalName =
        audioFile.originalFilename ||
        "audio.ogg";

      const extension =
        path.extname(originalName).toLowerCase() ||
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

      if (!supportedExtensions.includes(extension)) {
        return res.status(400).json({
          error: `Formato audio non supportato: ${extension}`
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

      // --------------------------------------------------
      // 1. TRASCRIZIONE AUDIO
      // --------------------------------------------------

      const transcription =
        await client.audio.transcriptions.create({

          file:
            fs.createReadStream(filePath),

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

      // --------------------------------------------------
      // 2. MOTORE INTELLIGENTE VOCALFLASH
      // --------------------------------------------------

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

Devi comprenderne il significato ed estrarre ESCLUSIVAMENTE
le informazioni realmente utili.

REGOLE GENERALI:

- NON riportare inutilmente la trascrizione completa nella sintesi.
- NON riscrivere frase per frase il messaggio.
- Elimina saluti, convenevoli, esitazioni, ripetizioni,
  intercalari e divagazioni.
- Riassumi il significato, non le singole frasi.
- Individua il punto centrale del messaggio.
- Evidenzia decisioni, richieste e conclusioni.
- Conserva date, orari, luoghi, nomi, cifre, importi,
  appuntamenti e scadenze quando sono importanti.
- Non inventare mai informazioni.
- Se un'informazione non è presente, non aggiungerla.
- Rispondi in italiano anche quando il vocale è in un'altra lingua.

SINTESI ADATTIVA:

- La quantità di testo deve dipendere soprattutto dalla densità
  e dall'importanza delle informazioni, non solo dalla durata del vocale.
- Sii il più sintetico possibile senza perdere informazioni rilevanti.
- Se il contenuto è breve e semplice, usa pochissimi punti.
- Se è medio, usa indicativamente 3-5 punti salienti
  se realmente utili.
- Se è lungo o complesso, mantieni comunque la sintesi iniziale
  compatta e usa più punti soltanto quando servono.
- Evita duplicazioni tra summary e salient_points.
- Non riempire il formato con informazioni inutili.

ESTRAZIONE DELLE INFORMAZIONI IMPORTANTI:

- Individua con particolare attenzione appuntamenti,
  scadenze, importi, persone, decisioni,
  richieste e cambiamenti.

- Se nel vocale un dato viene corretto o modificato,
  considera valido il dato finale.

Esempio:
"Non alle 9, facciamo alle 11"
significa che l'orario valido è 11:00.

- Non presentare come validi dati successivamente
  annullati, sostituiti o corretti.

- Distingui una decisione definitiva da una proposta,
  ipotesi o possibilità.

- Non trasformare:
  "potremmo farlo venerdì"
  in un appuntamento confermato.

- Distingui una scadenza da una semplice data citata.

- Per gli importi conserva valuta, unità,
  eventuali decimali e il contesto
  a cui si riferiscono.

- Se una data o un orario sono relativi,
  come "domani",
  non inventare una data assoluta
  non ricavabile con certezza.

- Se un'informazione è incerta o condizionale,
  mantieni esplicitamente tale incertezza.

PERSONE E ORGANIZZAZIONI:

- Riporta soltanto persone, professionisti,
  aziende o organizzazioni realmente citati.

- Non inventare cognomi, ruoli o società
  non presenti nella trascrizione.

RICONOSCIMENTO DEL CONTESTO PROFESSIONALE:

- Riconosci automaticamente l'ambito professionale
  quando è chiaramente deducibile dal contenuto.

Gli ambiti possono includere, a titolo di esempio:

- edilizia / cantiere
- finanziario / creditizio
- immobiliare
- legale
- medico / sanitario
- ricettivo / alberghiero
- commerciale
- assicurativo
- amministrativo
- tecnico
- altri settori professionali

- Se riconosci il settore,
  usa terminologia coerente con quel contesto.

- Mantieni termini tecnici,
  sigle,
  ruoli professionali,
  procedure,
  documenti,
  misure,
  importi
  e concetti specialistici
  realmente presenti.

- Non inventare gergo,
  diagnosi,
  conclusioni tecniche
  o informazioni specialistiche.

- Non correggere arbitrariamente
  un termine tecnico ambiguo.

- Se il settore non è chiaramente riconoscibile,
  usa "generico".

AMBITO MEDICO / SANITARIO:

- Puoi riconoscere e mantenere
  terminologia medica realmente presente.

- Non formulare nuove diagnosi.

- Non prescrivere farmaci.

- Non aggiungere consigli clinici
  non presenti nel messaggio.

TASK:

- Estrai un task soltanto se dal vocale emerge realmente
  un'attività da svolgere.

Esempio:

"Mandami il contratto entro venerdì"

può generare un task.

- Non trasformare automaticamente
  ogni appuntamento o informazione in un task.

- Se una frase è soltanto ipotetica,
  non creare un task definitivo.

- Se non ci sono attività da svolgere,
  restituisci un array vuoto.

OUTPUT:

Devi restituire ESCLUSIVAMENTE
un JSON valido con questa struttura:

{
  "context": "settore riconosciuto oppure generico",
  "summary": "sintesi breve e naturale del contenuto principale",
  "salient_points": [
    "informazione importante"
  ],
  "important_details": [
    {
      "type": "data|orario|appuntamento|scadenza|luogo|persona|importo|numero|decisione|altro",
      "value": "dato estratto",
      "status": "confermato|incerto|proposto"
    }
  ],
  "tasks": [
    {
      "title": "attività da svolgere",
      "deadline": null,
      "time": null,
      "status": "confermato|proposto"
    }
  ]
}

REGOLE DEL JSON:

- Usa array vuoti quando non esistono elementi.
- Non inserire proprietà aggiuntive.
- Non inventare valori mancanti.
- Se deadline o time non sono presenti,
  usa null.
- summary deve essere una stringa,
  non un array.
`
            },

            {
              role: "user",
              content: transcript
            }

          ]

        });

      // --------------------------------------------------
      // 3. LETTURA RISPOSTA GPT
      // --------------------------------------------------

      const rawResult =
        completion.choices?.[0]?.message?.content;

      if (!rawResult) {
        throw new Error(
          "Nessuna risposta dal motore di sintesi"
        );
      }

      const result =
        JSON.parse(rawResult);

      // --------------------------------------------------
      // 4. RISPOSTA FINALE API
      // --------------------------------------------------

      return res.status(200).json({

        ok: true,

        transcript,

        language,

        context:
          result.context ||
          "generico",

        summary:
          result.summary ||
          "",

        salient_points:
          Array.isArray(result.salient_points)
            ? result.salient_points
            : [],

        important_details:
          Array.isArray(result.important_details)
            ? result.important_details
            : [],

        tasks:
          Array.isArray(result.tasks)
            ? result.tasks
            : [],

        credits_used: 1

      });

    } catch (e) {

      // --------------------------------------------------
      // LOG TECNICO SU VERCEL
      // --------------------------------------------------

      console.error(
        "Errore VocalFlash API:",
        e
      );

      // Non mostriamo dettagli tecnici
      // o informazioni sensibili al client.

      return res.status(500).json({
        error:
          "Errore durante l'elaborazione del vocale"
      });

    } finally {

      // --------------------------------------------------
      // CANCELLAZIONE FILE TEMPORANEO
      // --------------------------------------------------

      try {

        if (
          filePath &&
          fs.existsSync(filePath)
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

  });

}
