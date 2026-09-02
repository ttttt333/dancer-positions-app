/**
 * translate-update-log — お知らせ本文（日本語）をアプリ 8 言語へ翻訳する。
 * 管理者のみ。保存自体は choreocore_save_update_log RPC 側。
 */

// @ts-ignore Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  CORS_HEADERS,
  getUserFromAuthHeader,
  jsonResponse,
} from "../_shared/billing.ts";
import { createServiceClient, isAdminEmail } from "../_shared/admin.ts";

const TARGETS = ["en", "ko", "zh", "es", "fr", "de", "pt"] as const;

function robustParseJson(raw: string): unknown {
  let text = String(raw ?? "").trim();
  if (!text) throw new Error("empty");
  text = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  if (!text.startsWith("{") && text.includes('"en"')) {
    text = `{${text}`;
  }
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  let parsed = tryParse(text);
  if (parsed) return parsed;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    parsed = tryParse(text.slice(start, end + 1));
    if (parsed) return parsed;
  }
  throw new Error("parse");
}

async function isUpdateLogAdmin(email: string): Promise<boolean> {
  if (isAdminEmail(email)) return true;
  try {
    const admin = await createServiceClient();
    const { data } = await admin
      .from("choreocore_admin_emails")
      .select("email")
      .ilike("email", email)
      .maybeSingle();
    return Boolean(data && typeof data.email === "string");
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const user = await getUserFromAuthHeader(req);
  if (!user?.email) {
    return jsonResponse({ error: "ログインが必要です" }, 401);
  }
  if (!(await isUpdateLogAdmin(user.email))) {
    return jsonResponse({ error: "管理者権限がありません" }, 403);
  }

  // @ts-ignore Deno
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: "ANTHROPIC_API_KEY not configured" }, 503);
  }

  let source = "";
  try {
    const payload = (await req.json()) as { body?: unknown };
    source = typeof payload.body === "string" ? payload.body : "";
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  if (!source.trim()) {
    return jsonResponse({ error: "body required" }, 400);
  }
  if (source.length > 20000) {
    return jsonResponse({ error: "body too long" }, 400);
  }

  const prompt = `Translate this ChoreoCore product update-log from Japanese into the other UI languages.
Keep markdown structure (#, ##, lists), version numbers, product name "ChoreoCore", and URLs unchanged.
zh = Simplified Chinese. pt = Brazilian Portuguese.
Return a single JSON object with keys: ${TARGETS.join(", ")}.
Each value is the full translated markdown. No commentary.

Japanese source:
${source}`;

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      system:
        "You are a JSON API. Reply with a single JSON object only. Never use markdown fences. No prose.",
      messages: [
        { role: "user", content: prompt },
        { role: "assistant", content: "{" },
      ],
    }),
  });

  if (!claudeRes.ok) {
    const err = await claudeRes.text();
    console.error("Claude API error:", err);
    return jsonResponse({ error: `Claude API error: ${claudeRes.status}` }, 502);
  }

  const claudeData = await claudeRes.json();
  const text = `{${claudeData.content?.[0]?.text ?? ""}`;
  let parsed: unknown;
  try {
    parsed = robustParseJson(text);
  } catch {
    return jsonResponse({ error: "translation parse failed" }, 502);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return jsonResponse({ error: "translation parse failed" }, 502);
  }

  const rec = parsed as Record<string, unknown>;
  const bodies: Record<string, string> = { ja: source };
  for (const loc of TARGETS) {
    const v = rec[loc];
    if (typeof v === "string" && v.trim()) bodies[loc] = v;
  }

  return jsonResponse({ bodies });
});
