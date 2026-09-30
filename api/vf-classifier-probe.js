// TEMPORARY Preview-only batch probe for Request Classifier V1.
// Fixed cases only. Never returns or logs VOCALFLASH_API_KEYS.
// Delete after validation.

import classifierHandler from "./request-classifier-dry-run.js";

const EXPECTED_BRANCH = "request-classifier-dry-run-v1";
const BUSINESS_ID = "fbe891e3-d6cc-46f3-a76c-b5b702732049";

const CASES = {
  plumbing: "Da stamattina perde acqua dal sifone sotto il lavandino della cucina.",
  electrical: "Ogni volta che accendo il forno scatta il differenziale e resta tutta la casa senza corrente.",
  renovation: "Vorrei rifare completamente il bagno, compresi impianti e rivestimenti, e avere un preventivo.",
  ambiguous: "Vorrei sistemare il bagno: non so se basta riparare la perdita o se conviene rifarlo completamente.",
  unsupported: "Vorrei installare una tenda da sole motorizzata sul terrazzo."
};

function makeCaptureResponse() {
  const capture = { statusCode: 200, body: null, headers: {} };
  const res = {
    setHeader(name, value) { capture.headers[name] = value; return res; },
    status(code) { capture.statusCode = code; return res; },
    json(body) { capture.body = body; return capture; },
    end() { return capture; }
  };
  return { res, capture };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== EXPECTED_BRANCH) {
    return res.status(403).json({ error: "Probe allowed only on isolated Preview branch" });
  }

  const apiKey = (process.env.VOCALFLASH_API_KEYS || "")
    .split(",").map((v) => v.trim()).filter(Boolean)[0];
  if (!apiKey) return res.status(500).json({ error: "Preview API key unavailable" });

  const results = {};
  for (const [name, message] of Object.entries(CASES)) {
    const internalReq = {
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: {
        business_id: BUSINESS_ID,
        new_event: { normalized_text: message }
      }
    };
    const { res: captureRes, capture } = makeCaptureResponse();
    await classifierHandler(internalReq, captureRes);
    results[name] = { status: capture.statusCode, body: capture.body };
  }

  return res.status(200).json({ ok: true, fixed_cases: results });
}
