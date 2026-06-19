import { parseRosterNamesFromBase64 } from "../shared/parseRosterNamesOpenAI.mjs";
import { validateImageBase64 } from "../shared/parseRouteSecurity.mjs";

/** Express: POST /api/parse-roster-names */
export async function handleParseRosterNamesRoute(req, res) {
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
    return res.json(result);
  } catch (error) {
    console.error("[parse-roster-names] route error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to process roster image";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return res.status(status).json({ error: message });
  }
}
