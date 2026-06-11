import OpenAI from "openai";

const SYSTEM_PROMPT =
  "あなたはダンスの立ち位置図・方眼紙の名簿を解析する専門家です。" +
  "次のような画像すべてに対応してください:\n" +
  "1) ステージ図に丸印と名前がある立ち位置図\n" +
  "2) 方眼紙に手書きで名前が行・列に並んだシート（写真・スキャン）\n" +
  "3) 印刷された配置表\n\n" +
  "ルール:\n" +
  "- 各ダンサー（名前のかたまり）ごとに 1 件の positions 要素を返す\n" +
  "- name は手書き・印刷の表記をそのまま（ひらがな・カタカナ・漢字）。読みが分かればその読み、不明なら見たまま\n" +
  "- 文字の上の小さな丸（○）は装飾なので無視し、名前本体だけを読む\n" +
  "- x, y は画像全体に対する相対位置のパーセント（左上 0,0 ・右下 100,100）。各名前ブロックの中心を推定\n" +
  "- 方眼紙では行・列の並びからステージ上の左右・前後を推定（上の行ほど手前、左から右へ並ぶ想定）\n" +
  "- 同じ行に複数の名前がある場合はそれぞれ別の positions にする\n" +
  "- 読み取れた名前が 1 人もない場合のみ positions を空配列にする\n\n" +
  '必ず JSON のみ: { "positions": [ { "name": "string", "x": number, "y": number } ] }';

/**
 * @param {string} imageBase64 JPEG/PNG 等の Base64（data: プレフィックスなし）
 * @param {{ mimeType?: string }} [opts]
 */
export async function parsePositionImageFromBase64(imageBase64, opts = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const mime =
    typeof opts.mimeType === "string" && opts.mimeType.startsWith("image/")
      ? opts.mimeType
      : "image/jpeg";

  const openai = new OpenAI({ apiKey: apiKey.trim() });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "この画像からダンサー名と立ち位置（x,y パーセント）をすべて抽出してください。" +
              "方眼紙の手書き名簿の場合も、各行・各名前の位置から座標を推定してください。",
          },
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${imageBase64}` },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4096,
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
    if (!p || typeof p !== "object") continue;
    const nameRaw = p.name;
    if (typeof nameRaw !== "string" && typeof nameRaw !== "number") continue;
    const name = String(nameRaw).trim();
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
    throw new Error("画像から名前と位置を読み取れませんでした");
  }

  return { positions: out };
}
