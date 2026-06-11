import OpenAI from "openai";

function buildSystemPrompt(memberNameHints) {
  const roster = Array.isArray(memberNameHints)
    ? memberNameHints.map((n) => String(n).trim()).filter(Boolean).slice(0, 80)
    : [];

  const rosterBlock =
    roster.length > 0
      ? `\n【名簿リスト — 名前は必ずこの中から最も近いものを選ぶ。名簿にない新しい名前を作らない】\n[${roster.join(", ")}]\n`
      : "";

  return `あなたはダンス公演の舞台配置図（フォーメーション図）をデジタル化する専門アシスタントです。
手書きメモ・方眼紙・デジタル立ち位置図の文字とマーカーを読み取ります。これは芸術公演の制作資料です。
${rosterBlock}
解析手順（この順で内部的に考えてから JSON を出力）:
1. 画像右端や行の横に書かれた「列の人数」（例: 4, 8, 7）を先にすべて読み取る
2. 上から下へ各行の名前を読み取り、名簿リストの中から最も近い名前に変換する
3. 各行の names の数は count と一致させる（不足分は名簿から推測して埋める）
4. デジタル図（色付き丸・番号）の場合は各丸の中心座標 x,y（0〜100%）も positions に入れる

ルール:
- 不明瞭な字・かすれ・汚れでも名簿から推測して補完する
- 文字の上の小さな丸（○）は無視
- 絶対に「読み取れない」と返さず、必ず JSON を返す
- 手書きメモでは lines を必ず返す。デジタル図では positions を必ず返す。両方該当すれば両方

必ず JSON のみ:
{
  "lines": [
    { "rowIndex": 1, "count": 4, "names": ["名前1", "名前2", "名前3", "名前4"] }
  ],
  "positions": [
    { "name": "名前", "x": 50, "y": 30, "confidence": "high" }
  ]
}`;
}

function buildUserPrompt(memberNameHints) {
  const roster =
    Array.isArray(memberNameHints) && memberNameHints.length > 0
      ? memberNameHints
          .map((n) => String(n).trim())
          .filter(Boolean)
          .slice(0, 80)
      : [];

  let text =
    "添付画像を解析してください。\n" +
    "1) 右端の数字を列の人数（count）として読み取る\n" +
    "2) 各行の名前を名簿から選んで lines に入れる\n" +
    "3) 丸印がある図なら positions に座標も入れる";

  if (roster.length > 0) {
    text +=
      "\n\n名簿（この中から名前を選ぶ）:\n" + roster.map((n) => `・${n}`).join("\n");
  }

  return text;
}

function normalizeNameForMatch(s) {
  return String(s)
    .trim()
    .replace(/[\u30a1-\u30f6]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    )
    .replace(/\s+/g, "");
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(row[j] + 1, prev + 1, row[j - 1] + cost);
      row[j - 1] = prev;
      prev = next;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

function snapNameToRoster(rawName, roster) {
  const original = String(rawName ?? "").trim();
  if (!original || !roster.length) {
    return { name: original || "Unknown", matched: false, original };
  }

  const normIn = normalizeNameForMatch(original);
  for (const candidate of roster) {
    if (normalizeNameForMatch(candidate) === normIn) {
      return { name: candidate, matched: true, original };
    }
  }

  let best = roster[0];
  let bestDist = Infinity;
  for (const candidate of roster) {
    const d = levenshtein(normIn, normalizeNameForMatch(candidate));
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }

  const threshold =
    normIn.length <= 3 ? 2 : Math.max(2, Math.ceil(normIn.length * 0.45));
  if (bestDist <= threshold) {
    return { name: best, matched: true, original };
  }

  return { name: original, matched: false, original };
}

function parseLinesFromRaw(raw) {
  const linesRaw = raw && typeof raw === "object" ? raw.lines : null;
  if (!Array.isArray(linesRaw)) return [];

  const out = [];
  for (let i = 0; i < linesRaw.length; i += 1) {
    const line = linesRaw[i];
    if (!line || typeof line !== "object") continue;
    const count = Number(line.count);
    const namesRaw = Array.isArray(line.names) ? line.names : [];
    const names = [];
    for (const n of namesRaw) {
      if (typeof n === "string" || typeof n === "number") {
        const s = String(n).trim();
        if (s && !/^unknown$/i.test(s)) names.push(s);
      }
    }
    if (names.length === 0) continue;
    out.push({
      rowIndex: Number.isFinite(Number(line.rowIndex))
        ? Number(line.rowIndex)
        : i + 1,
      count: Number.isFinite(count) && count > 0 ? count : names.length,
      names,
    });
  }
  return out;
}

function linesToPositions(lines) {
  const valid = lines.filter((l) => l.names?.length > 0);
  if (valid.length === 0) return [];

  const rowCount = valid.length;
  const out = [];
  valid.forEach((line, rowIdx) => {
    const names = line.names;
    const count = names.length;
    const y =
      rowCount <= 1
        ? 50
        : Math.round((10 + (rowIdx / (rowCount - 1)) * 75) * 100) / 100;

    names.forEach((name, colIdx) => {
      const x =
        count <= 1
          ? 50
          : Math.round((8 + ((colIdx + 0.5) / count) * 84) * 100) / 100;
      out.push({
        name,
        x,
        y,
        confidence: "low",
        lineIndex: rowIdx,
      });
    });
  });
  return out;
}

function computeCountMismatches(lines) {
  const mismatches = [];
  lines.forEach((line, lineIndex) => {
    const expected = Number(line.count);
    const actual = line.names?.length ?? 0;
    if (!Number.isFinite(expected) || expected <= 0) return;
    if (actual !== expected) {
      mismatches.push({ lineIndex, expected, actual });
    }
  });
  return mismatches;
}

function resolveOpenAIApiKey() {
  const raw = process.env.OPENAI_API_KEY ?? "";
  const trimmed = String(raw).trim().replace(/^["']|["']$/g, "");
  return trimmed || null;
}

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

function buildFallbackSystemPrompt(memberNameHints) {
  const roster = Array.isArray(memberNameHints)
    ? memberNameHints.map((n) => String(n).trim()).filter(Boolean).slice(0, 80)
    : [];
  const rosterLine =
    roster.length > 0
      ? `\nCandidate member names: ${roster.join(", ")}`
      : "";
  return `You transcribe a dance stage formation diagram for choreography software.
Read handwritten or printed labels and marker positions. Return JSON only.${rosterLine}
Format: { "lines": [{ "count": 4, "names": ["A","B"] }], "positions": [{ "name": "A", "x": 50, "y": 30 }] }`;
}

function buildFallbackUserPrompt() {
  return "Transcribe this dance formation diagram. Return JSON with lines and/or positions.";
}

async function callVisionModel(openai, { imageUrl, memberNameHints, attempt }) {
  const imageDetail = attempt === 1 ? "high" : "auto";
  const useFallback = attempt >= 2;
  return openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: useFallback
          ? buildFallbackSystemPrompt(memberNameHints)
          : buildSystemPrompt(memberNameHints),
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: useFallback
              ? buildFallbackUserPrompt()
              : buildUserPrompt(memberNameHints),
          },
          {
            type: "image_url",
            image_url: { url: imageUrl, detail: imageDetail },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4096,
  });
}

/**
 * @param {unknown} raw
 * @param {{ memberNameHints?: string[] }} [opts]
 */
export function normalizeParsePositionResponse(raw, opts = {}) {
  const roster = Array.isArray(opts.memberNameHints)
    ? opts.memberNameHints.map((n) => String(n).trim()).filter(Boolean)
    : [];

  let lines = parseLinesFromRaw(raw);
  let positions = [];

  const positionsRaw = raw && typeof raw === "object" ? raw.positions : null;
  if (Array.isArray(positionsRaw)) {
    let fallbackIdx = 0;
    for (const p of positionsRaw) {
      if (!p || typeof p !== "object") continue;
      const nameRaw = p.name;
      let name =
        typeof nameRaw === "string" || typeof nameRaw === "number"
          ? String(nameRaw).trim()
          : "";
      if (!name || /^unknown$/i.test(name) || name === "不明") {
        fallbackIdx += 1;
        name = `メンバー${fallbackIdx}`;
      }
      const x = Number(p.x);
      const y = Number(p.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const confRaw = p.confidence;
      positions.push({
        name,
        x: Math.min(100, Math.max(0, Math.round(x * 100) / 100)),
        y: Math.min(100, Math.max(0, Math.round(y * 100) / 100)),
        ...(confRaw === "low" || confRaw === "high" ? { confidence: confRaw } : {}),
      });
    }
  }

  if (positions.length === 0 && lines.length > 0) {
    positions = linesToPositions(lines);
  }

  if (roster.length > 0) {
    positions = positions.map((p) => {
      const m = snapNameToRoster(p.name, roster);
      return {
        ...p,
        name: m.name,
        confidence:
          m.matched && m.original && m.original !== m.name
            ? "low"
            : p.confidence ?? (m.matched ? "high" : "low"),
        rosterMatched: m.matched,
      };
    });

    lines = lines.map((line) => ({
      ...line,
      names: line.names.map((n) => snapNameToRoster(n, roster).name),
    }));
  }

  if (positions.length === 0) {
    throw new Error("画像から名前と位置を読み取れませんでした");
  }

  const countMismatches = computeCountMismatches(lines);

  return {
    positions,
    ...(lines.length ? { lines } : {}),
    ...(countMismatches.length ? { countMismatches } : {}),
  };
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

  const { clean, url: imageUrl } = buildImageDataUrl(imageBase64, mime);

  const openai = new OpenAI({
    apiKey,
    timeout: 120_000,
    maxRetries: 1,
  });

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
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

      return normalizeParsePositionResponse(raw, { memberNameHints });
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < 2) {
        console.warn("[parse-position] retrying after error:", lastError.message);
      }
    }
  }

  throw lastError ?? new Error("Empty response from vision model");
}
