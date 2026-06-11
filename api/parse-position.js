import {
  normalizeParsePositionResponse,
  parsePositionImageFromBase64,
} from "../shared/parsePositionOpenAI.mjs";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/** Vercel Serverless: POST /api/parse-position */
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
  const memberNameHints = Array.isArray(req.body?.memberNameHints)
    ? req.body.memberNameHints
        .filter((n) => typeof n === "string" && n.trim())
        .map((n) => n.trim())
        .slice(0, 80)
    : undefined;

  if (!imageBase64) {
    return res.status(400).json({ error: "Image data is required" });
  }

  try {
    const result = await parsePositionImageFromBase64(imageBase64, {
      mimeType: imageMime || undefined,
      memberNameHints,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("[parse-position] API error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to process image";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return res.status(status).json({ error: message });
  }
}

export { normalizeParsePositionResponse };
