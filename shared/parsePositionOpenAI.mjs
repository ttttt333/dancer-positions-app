import OpenAI from "openai";

const SYSTEM_PROMPT = `あなたはプロのダンス振付師であり、立ち位置図の解析専門家です。
提供された画像は必ずダンスの立ち位置図・方眼紙名簿・配置メモのいずれかであり、解析対象です。

視覚的ヒント（必ず画像全体を走査）:
- 人を示す丸印・番号・イニシャル・ひらがな/カタカナ/漢字の名前
- 方眼紙の行・列に並んだ手書きテキスト
- 薄い字・かすれ・汚れ・影・折れ跡があっても無視して読む
- 文字の上の小さな丸（○）は装飾なので無視

厳密な解析ステップ:
1. 画像内に人間を示すアイコンや番号、名前の記載がないか、隅から隅まで走査する
2. 文字がかすれ・汚れていても、フォーメーションと名簿候補から名前を推測し座標を特定する
3. 名前が見つからない場合でも座標のみ抽出し、name は "Unknown" とする（座標だけでも positions に入れる）
4. この画像は解析対象。絶対に「何も見つからない」「読み取れない」と返さず、必ず JSON で回答する

ルール:
- 不明瞭な文字は名簿候補・ダンス班の文脈から最も可能性の高い名前を推測
- positions は可能な限り多く埋める。空配列は最終手段
- x,y は画像全体のパーセント（左上 0,0・右下 100,100）。各マーカーの中心
- 確信度: confidence は "high" または "low"

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
    "添付画像はダンスの立ち位置図です。ダンサー名と立ち位置（x,y パーセント）をすべて抽出してください。" +
    "汚い字・かすれ・メモ書きでも文脈から推測し、必ず JSON を返してください。";

  if (hints.length > 0) {
    text +=
      "\n\n登録メンバー名簿（いずれかである可能性が高い）:\n" +
      hints.map((n) => `・${n}`).join("\n");
  }

  return text;
}

function resolveOpenAIApiKey() {
  const raw = process.env.OPENAI_API_KEY ?? "";
  const trimmed = String(raw).trim().replace(/^["']|["']$/g, "");
  return trimmed || null;
}

/** data: プレフィックス付きでも受け取り、純粋 Base64 のみ返す */
export function normalizeBase64Payload(imageBase64) {
  let raw = String(imageBase64 ?? "").trim();
  const dataUrlMatch = /^data:image\/[\w+.=-]+;base64,(.+)$/is.exec(raw);
  if (dataUrlMatch) {
    raw = dataUrlMatch[1];
  }
  raw = raw.replace(/\s/g, "");
  if (!raw || raw.length < 64) {
    throw new Error("Image data is too small or corrupted");
  }
  return raw;
}

function buildImageDataUrl(base64, mime) {
  const clean = normalizeBase64Payload(base64);
  const safeMime =
    typeof mime === "string" && mime.startsWith("image/") ? mime : "image/jpeg";
  return { clean, url: `data:${safeMime};base64,${clean}` };
}

function logParseRequestDebug({ mime, base64Len, memberHintCount, attempt }) {
  console.log("[parse-position] OpenAI request", {
    attempt,
    mime,
    base64Len,
    memberHintCount,
    model: "gpt-4o",
  });
}

function logParseResponseDebug(choice, attempt) {
  const msg = choice?.message;
  console.log("[parse-position] OpenAI response", {
    attempt,
    finishReason: choice?.finish_reason,
    hasContent: Boolean(msg?.content?.trim()),
    refusal: msg?.refusal ?? null,
  });
}

function emptyResponseError(choice) {
  const refusal = choice?.message?.refusal;
  const finishReason = choice?.finish_reason;
  if (refusal) {
    return new Error(`Vision model refused: ${refusal}`);
  }
  if (finishReason === "length") {
    return new Error("Vision response truncated (image may be too large)");
  }
  if (finishReason === "content_filter") {
    return new Error("Vision response blocked by content filter");
  }
  return new Error("Empty response from vision model");
}

async function callVisionModel(openai, { imageUrl, memberNameHints, attempt }) {
  const imageDetail = attempt === 1 ? "high" : "auto";
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: buildUserPrompt(memberNameHints) },
        {
          type: "image_url",
          image_url: { url: imageUrl, detail: imageDetail },
        },
      ],
    },
  ];

  return openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    response_format: { type: "json_object" },
    max_tokens: 4096,
  });
}

/**
 * @param {string} imageBase64 JPEG/PNG 等の Base64（data: プレフィックスあり/なし両対応）
 * @param {{ mimeType?: string; memberNameHints?: string[] }} [opts]
 */
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

  const { clean, url: imageUrl } = buildImageDataUrl(imageBase64, mime);

  const openai = new OpenAI({
    apiKey,
    timeout: 120_000,
    maxRetries: 1,
  });

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    logParseRequestDebug({
      mime,
      base64Len: clean.length,
      memberHintCount: memberNameHints.length,
      attempt,
    });

    try {
      const completion = await callVisionModel(openai, {
        imageUrl,
        memberNameHints,
        attempt,
      });

      const choice = completion.choices?.[0];
      logParseResponseDebug(choice, attempt);

      const content = choice?.message?.content?.trim();
      if (!content) {
        lastError = emptyResponseError(choice);
        continue;
      }

      let raw;
      try {
        raw = JSON.parse(content);
      } catch {
        throw new Error("Invalid JSON from vision model");
      }

      return normalizeParsePositionResponse(raw);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < 2) {
        console.warn("[parse-position] retrying after error:", lastError.message);
      }
    }
  }

  throw lastError ?? new Error("Empty response from vision model");
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
    const unknownLike =
      !name ||
      name === "?" ||
      name === "不明" ||
      name === "読み取れない" ||
      /^unknown$/i.test(name);
    if (unknownLike) {
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
