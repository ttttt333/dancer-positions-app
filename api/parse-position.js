import { parsePositionImageFromBase64 } from "../shared/parsePositionOpenAI.mjs";
import {
  setParseRouteCors,
  validateImageBase64,
  verifyParseRouteAuth,
} from "../shared/parseRouteSecurity.mjs";

/** Vercel Serverless: POST /api/parse-position */
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
  const memberNameHints = Array.isArray(req.body?.memberNameHints)
    ? req.body.memberNameHints
        .filter((n) => typeof n === "string" && n.trim())
        .map((n) => n.trim())
        .slice(0, 80)
    : undefined;

  const sizeCheck = validateImageBase64(imageBase64);
  if (!sizeCheck.ok) {
    return res.status(sizeCheck.status).json({ error: sizeCheck.error });
  }

  try {
    console.log("[parse-position] incoming", {
      userId: auth.userId,
      mime: imageMime || "image/jpeg",
      base64Len: imageBase64.length,
      memberHintCount: memberNameHints?.length ?? 0,
    });
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
