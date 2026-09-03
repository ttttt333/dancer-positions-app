import OpenAI from "openai";

function buildSystemPrompt(memberNameHints) {
  const roster = Array.isArray(memberNameHints)
    ? memberNameHints.map((n) => String(n).trim()).filter(Boolean).slice(0, 80)
    : [];

  const rosterBlock =
    roster.length > 0
      ? `\n【名簿 — name に出す文字列はこのリストだけ。一字一句コピー。漢字を作らない。同じ名簿名を2人に使わない。は と ほ は別人（はなか≠ほなか）。ただし手書きの癖で1字だけ崩れているときは、字形が最も近い名簿名を選ぶ（ほのあ→ほのか）】\n[${roster.join(", ")}]\n`
      : "";

  return `あなたはダンス公演の舞台配置図（フォーメーション図）をデジタル化する専門アシスタントです。
手書きメモ・ノート・方眼紙・デジタル立ち位置図の文字とマーカーを読み取ります。これは芸術公演の制作資料です。
${rosterBlock}
解析手順（この順で内部的に考えてから JSON を出力）:
1. 人は「小さな丸（○・●）」が本体。丸の中心が立ち位置。すぐ下（または中・右・縦書き）の名前はラベルだけ
2. 行は画像の上から下。上が舞台奥、下が客席（手前）。右端に人数が書いてあればそれを count にする（例: 7,7,5,4）
3. 各行の names は左から右。count はその行の丸の数と一致させる。隣の名前と繋げない
4. 各ラベルを「1文字ずつ」読む。罫線は文字ではない。この書き手の癖をページ全体で揃える
   - ほ は横棒が は より1本多い。はなか と ほのか を取り違えない
   - か は右上の払いがある。あ の丸だけと混同しやすい（ほのあ と読めたら ほのか を疑う）
   - め と あ、う と ゆ、な と た も崩れる。縦に詰まった3文字（ほのか、ゆうゆ）は上から全部読む
   - みゆう（3文字）と みゆ（2文字）は別人が多い
5. 名簿があるとき: rawRead に目で見た仮名を入れる。name は名簿から選んだ表記。名簿に無い読みは name を空文字。漢字は作らない。人数が足りないから未使用名を埋めない
6. 手書きでも positions を必ず返す。x,y は ○ の中心（0〜100%）

ルール:
- 手書きメモでは lines と positions の両方を返す
- x,y に文字の中心を入れない。labelX / labelY に名前の中心を入れてもよい
- ノートの罫線・影・汚れ・右端の人数・①は人ではない
- 画像を同じXの縦列に積まない。人数が多い行は隣の行の隙間に互い違い
- 絶対に「読み取れない」と返さず、必ず JSON を返す

必ず JSON のみ:
{
  "imageFrontDirection": "bottom",
  "lines": [
    { "rowIndex": 1, "count": 7, "names": ["名前1", "名前2"] }
  ],
  "positions": [
    { "name": "名前", "rawRead": "ほのあ", "x": 50, "y": 30, "labelX": 50, "labelY": 36, "confidence": "high" }
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
    "添付画像を1文字ずつ解析してください。\n" +
    "1) 人は丸。x,y は ○ の中心（名前の文字中心ではない）\n" +
    "2) 行は画像の上（舞台奥）から下（客席）。右端の人数を count にする。隣の行は隙間に互い違い\n" +
    "3) 各名前は丸の直下（または縦書き）だけ。隣と繋げない。詰まった3文字は全部読む\n" +
    "4) rawRead に目で見た仮名。名簿があるとき name は名簿の表記。は≠ほ。あ/か・め/あ・う/ゆの癖は名簿の近い名前へ\n" +
    "5) 漢字の推測禁止。名簿に無い名前は出さない";

  if (roster.length > 0) {
    text +=
      "\n\n使える名前（name はこれ以外禁止。表記をそのまま使う）:\n" +
      roster.map((n) => `・${n}`).join("\n");
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

function uniqueRosterLabels(roster) {
  const seen = new Set();
  const out = [];
  for (const candidate of roster) {
    const norm = normalizeNameForMatch(candidate);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(candidate);
  }
  return out;
}

const HIRAGANA_CONFUSION_GROUPS = [
  ["あ", "お"],
  ["あ", "め"],
  ["あ", "か"],
  ["め", "ぬ"],
  ["ぬ", "の"],
  ["か", "が"],
  ["き", "ぎ", "さ"],
  ["く", "ぐ"],
  ["け", "げ"],
  ["こ", "ご"],
  ["さ", "ざ"],
  ["し", "じ", "つ"],
  ["す", "ず"],
  ["せ", "ぜ"],
  ["そ", "ぞ", "ん", "る"],
  ["た", "だ"],
  ["ち", "ぢ"],
  ["つ", "う", "ら"],
  ["て", "で"],
  ["と", "ど"],
  ["な", "た"],
  ["ね", "れ", "わ"],
  ["は", "ば", "ぱ"],
  ["ひ", "び", "ぴ", "い"],
  ["ふ", "ぶ", "ぷ"],
  ["へ", "べ", "ぺ"],
  ["ほ", "ぼ", "ぽ"],
  ["ま", "も"],
  ["や", "ゃ"],
  ["ゆ", "ゅ", "う"],
  ["よ", "ょ"],
  ["り", "い"],
  ["る", "ろ"],
];
const HIRAGANA_SKIPPABLE = new Set(["っ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゃ", "ゅ", "ょ", "ー"]);
const HIRAGANA_CONFUSABLE = new Set();
for (const group of HIRAGANA_CONFUSION_GROUPS) {
  for (let i = 0; i < group.length; i += 1) {
    for (let j = 0; j < group.length; j += 1) {
      if (i === j) continue;
      HIRAGANA_CONFUSABLE.add(`${group[i]}\0${group[j]}`);
    }
  }
}

function hiraganaConfusable(a, b) {
  return a === b || HIRAGANA_CONFUSABLE.has(`${a}\0${b}`);
}

function hiraganaAlignCost(a, b) {
  if (a.length !== b.length) return null;
  let cost = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) continue;
    if (!hiraganaConfusable(a[i], b[i])) return null;
    cost += 1;
  }
  return cost;
}

function dropOneSkippableKana(s) {
  const out = [];
  const seen = new Set();
  for (let i = 0; i < s.length; i += 1) {
    if (!HIRAGANA_SKIPPABLE.has(s[i]) && s[i] !== "う") continue;
    const next = s.slice(0, i) + s.slice(i + 1);
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

function handwritingNameCost(raw, candidate) {
  if (!raw || !candidate) return null;
  if (raw === candidate) return 0;
  const same = hiraganaAlignCost(raw, candidate);
  if (same === 0) return 0;
  if (same === 1) return 1;
  if (same === 2 && raw.length >= 4 && candidate.length >= 4) return 2;
  if (Math.abs(raw.length - candidate.length) !== 1) return null;
  const longer = raw.length > candidate.length ? raw : candidate;
  const shorter = raw.length > candidate.length ? candidate : raw;
  let best = null;
  for (const dropped of dropOneSkippableKana(longer)) {
    if (dropped.length !== shorter.length) continue;
    const cost = hiraganaAlignCost(dropped, shorter);
    if (cost == null) continue;
    const total = cost + 1;
    if (total > 2) continue;
    if (best == null || total < best) best = total;
  }
  return best;
}

function scoreNameToRosterCandidate(rawName, candidate) {
  const normIn = normalizeNameForMatch(rawName);
  const normC = normalizeNameForMatch(candidate);
  if (!normIn || !normC) return null;
  if (normIn === normC) return 0;
  const shorter = normIn.length <= normC.length ? normIn : normC;
  const longer = normIn.length <= normC.length ? normC : normIn;
  if (shorter.length >= 2 && longer.length > shorter.length) {
    if (longer.startsWith(shorter) || longer.endsWith(shorter)) return 0.5;
  }
  const hw = handwritingNameCost(normIn, normC);
  if (hw == null || hw === 0) return hw;
  return hw;
}

function pickDisplayNameFromMatch(_original, matchedHint) {
  return String(matchedHint ?? "").trim();
}

function snapNamesToRosterUnique(names, roster) {
  const results = names.map((raw) => {
    const original = String(raw ?? "").trim();
    return { name: original, matched: false, original };
  });
  if (!roster.length) return results;
  const rosterUnique = uniqueRosterLabels(roster);

  const usedNorm = new Set();
  const assignPass = (allow) => {
    for (let i = 0; i < names.length; i += 1) {
      if (results[i].matched) continue;
      const original = String(names[i] ?? "").trim();
      if (!original) {
        results[i] = { name: "", matched: false, original };
        continue;
      }
      const scored = [];
      for (const candidate of rosterUnique) {
        const normC = normalizeNameForMatch(candidate);
        if (!normC || usedNorm.has(normC)) continue;
        const score = scoreNameToRosterCandidate(original, candidate);
        if (score == null || !allow(score)) continue;
        scored.push({ candidate, score });
      }
      if (scored.length === 0) continue;
      scored.sort((a, b) => a.score - b.score);
      if (scored.length >= 2 && scored[0].score === scored[1].score) continue;
      const best = scored[0].candidate;
      usedNorm.add(normalizeNameForMatch(best));
      results[i] = {
        name: pickDisplayNameFromMatch(original, best),
        matched: true,
        original,
      };
    }
  };

  assignPass((score) => score === 0);
  assignPass((score) => score === 0.5);
  assignPass((score) => score === 1);
  assignPass((score) => score === 2);
  for (let i = 0; i < results.length; i += 1) {
    if (results[i].matched) continue;
    const original = String(names[i] ?? "").trim();
    results[i] = { name: "", matched: false, original };
  }
  return results;
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
        if (/^unknown$/i.test(s) || s === "不明") names.push("");
        else names.push(s);
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

function yForRow(rowIdx, rowCount) {
  if (rowCount <= 1) return 50;
  return Math.round((10 + (rowIdx / (rowCount - 1)) * 75) * 100) / 100;
}

function xForColumnCentered(colIdx, maxCols) {
  if (maxCols <= 1) return 50;
  const colUnit = 10;
  const maxSpan = 84;
  const span = Math.min(maxSpan, maxCols * colUnit);
  const left = 50 - span / 2;
  const step = span / maxCols;
  return Math.round((left + (colIdx + 0.5) * step) * 100) / 100;
}

function formationRowsAreRagged(rowLengths) {
  const uniq = new Set(rowLengths.filter((n) => n > 0));
  return uniq.size > 1;
}

function linesToPositions(lines) {
  const valid = lines.filter((l) => l.names?.length > 0);
  if (valid.length === 0) return [];

  const rowCount = valid.length;
  const lengths = valid.map((l) => l.names.length);
  const maxCols = Math.max(...lengths, 1);
  const ragged = formationRowsAreRagged(lengths);
  const out = [];
  valid.forEach((line, rowIdx) => {
    const names = line.names;
    const y = yForRow(rowIdx, rowCount);
    const cols = ragged ? Math.max(names.length, 1) : maxCols;

    names.forEach((name, colIdx) => {
      out.push({
        name,
        x: xForColumnCentered(colIdx, cols),
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
Never invent names. If a roster is given, copy those strings into name. Put the literal kana you see in rawRead. Distinguish は vs ほ (はなか≠ほなか). Recover handwriting quirks (ほのあ→ほのか). Never guess kanji from hiragana. Return JSON only.${rosterLine}
Format: { "imageFrontDirection": "bottom", "lines": [{ "count": 4, "names": ["A","B"] }], "positions": [{ "name": "A", "rawRead": "A", "x": 50, "y": 30, "labelX": 50, "labelY": 36 }] }`;
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
      const rawRead =
        typeof p.rawRead === "string" || typeof p.rawRead === "number"
          ? String(p.rawRead).trim()
          : "";
      let name =
        typeof nameRaw === "string" || typeof nameRaw === "number"
          ? String(nameRaw).trim()
          : "";
      if (!name || /^unknown$/i.test(name) || name === "不明") {
        if (roster.length > 0) {
          name = "";
        } else {
          fallbackIdx += 1;
          name = `メンバー${fallbackIdx}`;
        }
      }
      const snapSource = rawRead || name;
      const x = Number(p.markerX ?? p.x);
      const y = Number(p.markerY ?? p.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const confRaw = p.confidence;
      const labelX = Number(p.labelX);
      const labelY = Number(p.labelY);
      positions.push({
        name: snapSource,
        x: Math.min(100, Math.max(0, Math.round(x * 100) / 100)),
        y: Math.min(100, Math.max(0, Math.round(y * 100) / 100)),
        markerX: Math.min(100, Math.max(0, Math.round(x * 100) / 100)),
        markerY: Math.min(100, Math.max(0, Math.round(y * 100) / 100)),
        ...(Number.isFinite(labelX) && Number.isFinite(labelY)
          ? {
              labelX: Math.min(100, Math.max(0, Math.round(labelX * 100) / 100)),
              labelY: Math.min(100, Math.max(0, Math.round(labelY * 100) / 100)),
            }
          : {}),
        ...(confRaw === "low" || confRaw === "high" ? { confidence: confRaw } : {}),
      });
    }
  }

  const applySnap = (list) => {
    if (!roster.length) {
      return list.map((name) => ({
        name,
        matched: false,
        original: name,
      }));
    }
    return snapNamesToRosterUnique(list, roster);
  };

  if (lines.length > 0) {
    const flat = lines.flatMap((line) => line.names);
    const snapped = applySnap(flat);
    let i = 0;
    lines = lines.map((line) => ({
      ...line,
      names: line.names.map(() => {
        const m = snapped[i];
        i += 1;
        return m.name;
      }),
    }));
  }

  const markerPositions = positions;
  if (markerPositions.length > 0) {
    const snapped = applySnap(markerPositions.map((p) => p.name));
    positions = markerPositions.map((p, idx) => {
      const m = snapped[idx];
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
  } else if (lines.length > 0) {
    const snapped = applySnap(lines.flatMap((line) => line.names));
    positions = linesToPositions(lines).map((p, idx) => {
      const m = snapped[idx];
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
  }

  if (positions.length === 0) {
    throw new Error("画像から名前と位置を読み取れませんでした");
  }

  const countMismatches = computeCountMismatches(lines);
  const frontRaw =
    raw && typeof raw === "object" ? raw.imageFrontDirection : null;
  const imageFrontDirection =
    frontRaw === "top" ||
    frontRaw === "bottom" ||
    frontRaw === "left" ||
    frontRaw === "right"
      ? frontRaw
      : undefined;

  return {
    positions,
    ...(lines.length ? { lines } : {}),
    ...(countMismatches.length ? { countMismatches } : {}),
    ...(imageFrontDirection ? { imageFrontDirection } : {}),
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
