import OpenAI from "openai";
import {
  linesToStagePositions,
  matchNameToRoster,
  matchPositionsToRoster,
  normalizeParsedLines,
} from "./parsePositionRosterMatch.mjs";

/**
 * @param {string[]} memberNameHints
 */
function buildSystemPrompt(memberNameHints) {
  const rosterBlock =
    memberNameHints.length > 0
      ? `\n【名簿リスト — 必須】\n読み取った文字は必ず次のいずれかに名寄せすること（新しい名前を invent しない）:\n[${memberNameHints.join(", ")}]\n`
      : "";

  return `あなたはプロのダンス振付師です。手書き・印刷の立ち位置図を解析します。画像は必ず解析対象です。
${rosterBlock}
解析手順（この順で内部的に考える）:
1. 画像右端に縦に並ぶ数字（例: 4, 8, 7, 8, 7）があれば、上から順に「各行の人数 count」として先に読み取る
2. 各行の手書き名前を左から右へ読み、名簿リストの中で最も近い名前に変換する
3. 各行の names 配列の要素数は count と一致させる（不足分は名簿から推測して補完）
4. 丸印付き配置図の場合は各マーカーの中心座標 x,y（0〜100%）も positions に入れる

ルール:
- かすれ・汚れ・メモ書きでも名簿から推測して名寄せする
- 絶対に「読み取れない」と返さず JSON のみ返す
- 文字上の小さな丸（○）は無視
- 上の行=舞台奥、下の行=客席側（手前）

必ず JSON のみ:
{
  "lines": [
    { "count": 4, "names": ["名前1", "名前2", "名前3", "名前4"] }
  ],
  "positions": [
    { "name": "string", "x": number, "y": number, "confidence": "high" | "low" }
  ]
}
手書き方眼紙メモでは lines を必ず埋める。配置図では positions も埋める。`;
}

/**
 * @param {string[]} [memberNameHints]
 */
function buildUserPrompt(memberNameHints) {
  const hints =
    Array.isArray(memberNameHints) && memberNameHints.length > 0
      ? memberNameHints
      : [];

  let text =
    "添付画像を解析してください。\n" +
    "1) 右端の縦数字があれば各行の人数として lines に反映\n" +
    "2) 各行の名前を名簿に名寄せ\n" +
    "3) 配置が分かる場合は positions に x,y も付与\n" +
    "必ず JSON を返してください。";

  if (hints.length > 0) {
    text +=
      "\n\n名簿（この中から選ぶ）:\n" + hints.map((n) => `・${n}`).join("\n");
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
    { role: "system", content: buildSystemPrompt(memberNameHints) },
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

function normalizePositionsArray(positions, roster) {
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
    let confidence =
      confRaw === "low" || confRaw === "high" ? confRaw : undefined;
    if (roster.length) {
      const matched = matchNameToRoster(name, roster);
      name = matched.name;
      if (!confidence) confidence = matched.confidence;
      else if (!matched.rosterMatched) confidence = "low";
    }
    out.push({
      name,
      x: Math.min(100, Math.max(0, Math.round(x * 100) / 100)),
      y: Math.min(100, Math.max(0, Math.round(y * 100) / 100)),
      ...(confidence ? { confidence } : {}),
    });
  }
  return out;
}

/**
 * @param {string} imageBase64
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
    ? opts.memberNameHints.filter((n) => typeof n === "string" && n.trim())
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

      return normalizeParsePositionResponse(raw, memberNameHints);
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
 * @param {string[]} [memberNameHints]
 */
export function normalizeParsePositionResponse(raw, memberNameHints = []) {
  const roster = memberNameHints.map((n) => String(n).trim()).filter(Boolean);
  const lines = normalizeParsedLines(
    raw && typeof raw === "object" ? raw.lines : null
  );

  let positions = [];

  if (lines.length > 0) {
    const linesWithRoster = lines.map((line) => ({
      count: line.count,
      names: line.names.map((name) => matchNameToRoster(name, roster).name),
    }));
    positions = linesToStagePositions(linesWithRoster);

    const aiPositions =
      raw && typeof raw === "object" && Array.isArray(raw.positions)
        ? normalizePositionsArray(raw.positions, roster)
        : [];

    if (aiPositions.length > 0) {
      const byName = new Map(aiPositions.map((p) => [p.name, p]));
      positions = positions.map((p) => {
        const refined = byName.get(p.name);
        if (refined && Number.isFinite(refined.x) && Number.isFinite(refined.y)) {
          return {
            ...p,
            x: refined.x,
            y: refined.y,
            confidence:
              refined.confidence === "high" ? "high" : p.confidence ?? "low",
          };
        }
        return p;
      });
    }

    const countMismatch = lines.some((l) => l.names.length !== l.count);

    if (positions.length === 0) {
      throw new Error("画像から名前と位置を読み取れませんでした");
    }

    return {
      positions: matchPositionsToRoster(positions, roster),
      lines,
      countMismatch,
    };
  }

  const rawPositions =
    raw && typeof raw === "object" ? raw.positions : null;
  if (!Array.isArray(rawPositions)) {
    throw new Error("Invalid positions payload");
  }

  positions = normalizePositionsArray(rawPositions, roster);
  if (positions.length === 0) {
    throw new Error("画像から名前と位置を読み取れませんでした");
  }

  return {
    positions: matchPositionsToRoster(positions, roster),
    countMismatch: false,
  };
}
