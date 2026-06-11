import OpenAI from "openai";

const SYSTEM_PROMPT =
  "あなたはダンスの立ち位置図を解析する専門家です。画像から立ち位置の情報を抽出し、必ず以下のJSON形式で返してください: " +
  '{ "positions": [ { "name": "string", "x": number, "y": number } ] }。' +
  "xとyは0から100のパーセンテージで推定してください。name は画像に書かれた名前・番号をそのまま使ってください。";

/**
 * @param {string} imageBase64 JPEG/PNG の Base64（data: プレフィックスなし）
 */
export async function parsePositionImageFromBase64(imageBase64) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({ apiKey: apiKey.trim() });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "この画像から立ち位置情報を抽出してください。" },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from vision model");
  }

  let raw;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error("Invalid JSON from vision model");
  }

  return normalizeParsePositionResponse(raw);
}

/**
 * @param {unknown} raw
 * @returns {{ positions: { name: string; x: number; y: number }[] }}
 */
export function normalizeParsePositionResponse(raw) {
  const positions = raw && typeof raw === "object" ? raw.positions : null;
  if (!Array.isArray(positions)) {
    throw new Error("Invalid positions payload");
  }

  const out = [];
  for (const p of positions) {
    if (!p || typeof p.name !== "string") continue;
    const name = p.name.trim();
    if (!name) continue;
    const x = Number(p.x);
    const y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({
      name,
      x: Math.min(100, Math.max(0, Math.round(x * 100) / 100)),
      y: Math.min(100, Math.max(0, Math.round(y * 100) / 100)),
    });
  }

  if (out.length === 0) {
    throw new Error("No positions found in image");
  }

  return { positions: out };
}
