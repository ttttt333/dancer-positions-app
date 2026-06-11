import { parseRosterNamesFromBase64 } from "../shared/parseRosterNamesOpenAI.mjs";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/** Vercel Serverless: POST /api/parse-roster-names */
export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const imageBase64 =
    typeof req.body?.imageBase64 === "string" ? req.body.imageBase64.trim() : "";
  const imageMime =
    typeof req.body?.imageMime === "string" ? req.body.imageMime.trim() : "";

  if (!imageBase64) {
    return res.status(400).json({ error: "Image data is required" });
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
