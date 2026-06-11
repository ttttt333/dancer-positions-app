import OpenAI from "openai";

function resolveOpenAIApiKey() {
  return (
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.VITE_OPENAI_API_KEY?.trim() ||
    ""
  );
}

function normalizeBase64Payload(imageBase64) {
  let raw = String(imageBase64 ?? "").trim();
  const dataUrlMatch = /^data:image\/[\w+.=-]+;base64,(.+)$/is.exec(raw);
  if (dataUrlMatch) raw = dataUrlMatch[1];
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

function normalizeNamesFromRaw(raw) {
  const list = raw && typeof raw === "object" ? raw.names : null;
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const name =
      typeof item === "string" || typeof item === "number"
        ? String(item).trim()
        : "";
    if (!name || seen.has(name)) continue;
    if (/^(unknown|不明|なし)$/i.test(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= 80) break;
  }
  return out;
}

async function callRosterVision(openai, { imageUrl, attempt }) {
  const system =
    attempt === 1
      ? `あなたはダンス公演の名簿・出欠表をデジタル化するアシスタントです。
写真に写っている参加者の名前をすべて読み取り、JSON のみ返してください。
手書き・印刷・表形式いずれも対応します。読み取れた名前は推測で補完してよいです。

形式: { "names": ["名前1", "名前2"] }`
      : `Dance team roster OCR. Extract every person name from the image.
Return JSON only: { "names": ["name1", "name2"] }`;

  const userText =
    attempt === 1
      ? "この名簿写真に写っているメンバー名をすべて names 配列に入れてください。"
      : "List all visible member names from this roster photo as JSON names array.";

  return openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          {
            type: "image_url",
            image_url: { url: imageUrl, detail: attempt === 1 ? "high" : "auto" },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 2048,
  });
}

/**
 * 名簿写真からメンバー名リストを抽出する。
 * @param {string} imageBase64
 * @param {{ mimeType?: string }} [opts]
 * @returns {Promise<{ names: string[] }>}
 */
export async function parseRosterNamesFromBase64(imageBase64, opts = {}) {
  const apiKey = resolveOpenAIApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const mime =
    typeof opts.mimeType === "string" && opts.mimeType.startsWith("image/")
      ? opts.mimeType
      : "image/jpeg";

  const { url: imageUrl } = buildImageDataUrl(imageBase64, mime);
  const openai = new OpenAI({
    apiKey,
    timeout: 90_000,
    maxRetries: 1,
  });

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const completion = await callRosterVision(openai, { imageUrl, attempt });
      const choice = completion.choices?.[0];
      const content = choice?.message?.content?.trim();
      const refusal = choice?.message?.refusal;

      if (!content) {
        lastError = new Error(
          refusal
            ? `名簿の読み取りが拒否されました: ${refusal}`
            : "名簿画像から名前を読み取れませんでした"
        );
        continue;
      }

      let raw;
      try {
        raw = JSON.parse(content);
      } catch {
        throw new Error("名簿解析の JSON が不正です");
      }

      const names = normalizeNamesFromRaw(raw);
      if (!names.length) {
        lastError = new Error("名簿画像から名前を検出できませんでした");
        continue;
      }

      return { names };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError ?? new Error("名簿画像から名前を読み取れませんでした");
}
