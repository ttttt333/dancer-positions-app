import { parseRosterNamesFromBase64 } from "../shared/parseRosterNamesOpenAI.mjs";
import {
  setParseRouteCors,
  validateImageBase64,
  verifyParseRouteAuth,
} from "../shared/parseRouteSecurity.mjs";

/** Vercel Serverless: POST /api/parse-roster-names */
export default async function handler(req, res) {
  setParseRouteCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await verifyParseRouteAuth(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const imageBase64 =
    typeof req.body?.imageBase64 === "string" ? req.body.imageBase64.trim() : "";
  const imageMime =
    typeof req.body?.imageMime === "string" ? req.body.imageMime.trim() : "";

  const sizeCheck = validateImageBase64(imageBase64);
  if (!sizeCheck.ok) {
    return res.status(sizeCheck.status).json({ error: sizeCheck.error });
  }

  try {
    const result = await parseRosterNamesFromBase64(imageBase64, {
      mimeType: imageMime || undefined,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("[parse-roster-names] API error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to process roster image";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return res.status(status).json({ error: message });
  }
}
