import OpenAI from "openai";

const SYSTEM_PROMPT = `あなたはプロのダンス振付師であり、立ち位置図・方眼紙名簿の解析専門家です。
手書きの図面は字が汚い・かすれている・メモ書き混じりのことがありますが、ダンス指導者として文脈から粘り強く読み取ってください。

対応する画像:
1) ステージ図に丸印と名前がある立ち位置図
2) 方眼紙に手書きで名前が行・列に並んだシート（写真・スキャン）
3) 印刷された配置表・走り書きメモ

解析手順（この順で内部的に考えてから JSON を出力）:
1. 画像全体のレイアウト（行・列・ステージの向き）を把握する
2. 各「人」のかたまり（名前・記号・丸印）を一つずつ特定する
3. 各かたまりの中心座標 x,y（0〜100%）を決める

ルール:
- 不明瞭な文字は、フォーメーション・ダンス班・一般的な人名・渡された名簿候補から「最も可能性の高い名前」を推測して補完する
- 「読み取れない」「不明」「?」だけの名前に諦めない。空欄・null は禁止。推測でも必ず名前文字列を入れる
- 名前が特定しづらくても、記号・丸・配置から「人」と判断できるものは座標を必ず抽出する
- 文字の上の小さな丸（○）は装飾なので無視し、名前本体を読む
- x,y は画像全体に対する相対位置（左上 0,0・右下 100,100）。各名前ブロックの中心
- 方眼紙は上の行ほど手前、左から右へ並ぶ想定で座標を推定
- 同じ行の複数名前はそれぞれ別要素にする
- 確信度が低い推測は confidence:"low"、はっきり読めたら "high"
- positions は可能な限り多く埋める。メモ書きの除外線や汚れは無視して人の位置だけ拾う

必ず JSON のみ:
{ "positions": [ { "name": "string", "x": number, "y": number, "confidence": "high" | "low" } ] }`;

/**
 * @param {string[]} [memberNameHints]
 */
function buildUserPrompt(memberNameHints) {
  const hints =
    Array.isArray(memberNameHints) && memberNameHints.length > 0
      ? memberNameHints
          .map((n) => String(n).trim())
          .filter(Boolean)
          .slice(0, 80)
      : [];

  let text =
    "この画像からダンサー名と立ち位置（x,y パーセント）をすべて抽出してください。" +
    "汚い字・かすれ・メモ書きでも文脈から推測し、空の positions を返さないでください。";

  if (hints.length > 0) {
    text +=
      "\n\nこの作品の登録メンバー名簿（いずれかである可能性が高いです）:\n" +
      hints.map((n) => `・${n}`).join("\n") +
      "\n手書きが読みにくいときは、上記名簿との音・字形の類似から最も近い名前を選んで補完してください。";
  }

  return text;
}

/**
 * @param {string} imageBase64 JPEG/PNG 等の Base64（data: プレフィックスなし）
 * @param {{ mimeType?: string; memberNameHints?: string[] }} [opts]
 */
function resolveOpenAIApiKey() {
  const raw = process.env.OPENAI_API_KEY ?? "";
  const trimmed = String(raw).trim().replace(/^["']|["']$/g, "");
  return trimmed || null;
}

export async function parsePositionImageFromBase64(imageBase64, opts = {}) {
  const apiKey = resolveOpenAIApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const mime =
    typeof opts.mimeType === "string" && opts.mimeType.startsWith("image/")
      ? opts.mimeType
      : "image/jpeg";

  const memberNameHints = Array.isArray(opts.memberNameHints)
    ? opts.memberNameHints
    : [];

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildUserPrompt(memberNameHints),
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
 * @returns {{ positions: { name: string; x: number; y: number; confidence?: string }[] }}
 */
export function normalizeParsePositionResponse(raw) {
  const positions = raw && typeof raw === "object" ? raw.positions : null;
  if (!Array.isArray(positions)) {
    throw new Error("Invalid positions payload");
  }

  const out = [];
  let fallbackIdx = 0;
  for (const p of positions) {
    if (!p || typeof p !== "object") continue;
    const nameRaw = p.name;
    let name =
      typeof nameRaw === "string" || typeof nameRaw === "number"
        ? String(nameRaw).trim()
        : "";
    if (!name || name === "?" || name === "不明" || name === "読み取れない") {
      fallbackIdx += 1;
      name = `メンバー${fallbackIdx}`;
    }
    const x = Number(p.x);
    const y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const confRaw = p.confidence;
    const confidence =
      confRaw === "low" || confRaw === "high" ? confRaw : undefined;
    out.push({
      name,
      x: Math.min(100, Math.max(0, Math.round(x * 100) / 100)),
      y: Math.min(100, Math.max(0, Math.round(y * 100) / 100)),
      ...(confidence ? { confidence } : {}),
    });
  }

  if (out.length === 0) {
    throw new Error("画像から名前と位置を読み取れませんでした");
  }

  return { positions: out };
}
