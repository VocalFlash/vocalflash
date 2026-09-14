export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({error: "Usa POST"});
  if (!req.headers['x-api-key']) return res.status(401).json({error: "Manca X-API-Key"});
  return res.status(200).json({ ok: true, message: "API pronta, colleghiamo motore Whisper dopo" });
}
