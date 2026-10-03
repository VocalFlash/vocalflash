export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    name: "VocalFlash API",
    status: "online",
    docs: "Richiedi API Key a info@vocalflash.it",
    endpoints: {
      "POST /api/v1/transcribe": "Trascrive vocale in testo + sintesi"
    }
  });
}
