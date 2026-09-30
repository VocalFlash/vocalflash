// TEMPORARY CONTROLLED PROBE - Preview branch only.
// Delete after isolated Work Resolver validation.
// Never returns or logs VOCALFLASH_API_KEYS.

import dryRunHandler from "./work-resolver-dry-run.js";

const EXPECTED_BRANCH = "work-resolver-db-dry-run-v1";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }

  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== EXPECTED_BRANCH
  ) {
    return res.status(403).json({ error: "Probe allowed only on isolated Preview branch" });
  }

  const apiKey = (process.env.VOCALFLASH_API_KEYS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)[0];

  if (!apiKey) {
    return res.status(500).json({ error: "Preview API key unavailable" });
  }

  const internalReq = {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: {
      business_id: "6df93e54-31c3-4817-97ca-9331c164bcac",
      contact_id: "2d00ab37-e661-4b63-ae02-e6e5322648aa",
      new_event: {
        actor_type: "customer",
        content_type: "text",
        normalized_text: "Ecco la foto che mi avevi chiesto."
      }
    }
  };

  return dryRunHandler(internalReq, res);
}
