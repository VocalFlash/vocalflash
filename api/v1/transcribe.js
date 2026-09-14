import OpenAI from "openai";
import formidable from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };

const client = new OpenAI({ apiKey: process.env.OPENAI_KEY });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method!== 'POST') return res.status(405).json({error: "Usa POST"});

  const apiKey = req.headers['x-api-key'];
  if (!apiKey ||!apiKey.startsWith('vf_live_')) {
    return res.status(401).json({error: "API Key non valida. Richiedi a info@vocalflash.it"});
  }

  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({error: "File non leggibile"});

    const audioFile = files.file || files.audio;
    if (!audioFile) return res.status(400).json({error: "Manca file audio (campo 'file')"});

    const filePath = Array.isArray(audioFile)? audioFile[0].filepath : audioFile.filepath;

    try {
      // 1. Whisper
      const transcription = await client.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-1",
        language: "it"
      });

      // 2. GPT con rilevamento contesto professionale (quello della tua landing)
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {role: "system", content: `Sei VocalFlash. Analizza trascrizione e restituisci JSON con:
- transcript: testo pulito
- context: uno tra edilizia, immobiliare, legale, finanziario-creditizio, medico, ricettivo, altro
- summary: max 3 bullet point
- todo: azione da fare
Mantieni sigle, cifre, nomi.
Rispondi solo JSON.`},
          {role: "user", content: transcription.text}
        ],
        response_format: {type: "json_object"}
      });

      const result = JSON.parse(completion.choices[0].message.content);

      fs.unlinkSync(filePath); // cancella come da privacy

      return res.status(200).json({
       ...result,
        credits_used: 1
      });

    } catch (e) {
      console.error(e);
      return res.status(500).json({error: e.message});
    }
  });
}
