import { parsePositionImageFromBase64 } from "../shared/parsePositionOpenAI.mjs";

/** Express: POST /api/parse-position（Vite 開発時のプロキシ先） */
export async function handleParsePositionRoute(req, res) {
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
    return res.json(result);
  } catch (error) {
    console.error("[parse-position] route error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to process image";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return res.status(status).json({ error: message });
  }
}
