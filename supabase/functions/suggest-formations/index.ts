/**
 * suggest-formations — Supabase Edge Function
 * 音声解析結果 + ダンサー情報 → Claude Haiku でフォーメーション提案
 */

// @ts-ignore Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Claude が ```json で返したり、max_tokens で途中切れしてもなるべく救う。
 * assistant prefilling（先頭 `{`）にも対応。
 */
function robustParseJson(raw: string): unknown {
  let text = String(raw ?? "").trim();
  if (!text) throw new Error("Claudeのレスポンスが空です");

  // 途中にフェンスがある場合も除去
  text = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  // prefilling で `{` を渡している場合、本文が `"formations":...` から始まることがある
  if (!text.startsWith("{") && text.includes('"formations"')) {
    text = `{${text}`;
  }
  if (!text.endsWith("}") && text.includes("{")) {
    // 閉じ括弧不足（途中切れ）の簡易修復はせず、後段で明確なエラーにする
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

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    parsed = tryParse(fence[1].trim());
    if (parsed) return parsed;
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    parsed = tryParse(text.slice(start, end + 1));
    if (parsed) return parsed;
  }

  const truncated =
    !text.trimEnd().endsWith("}") ||
    (text.match(/\{/g)?.length ?? 0) > (text.match(/\}/g)?.length ?? 0);

  throw new Error(
    truncated
      ? "Claudeの応答が途中で切れました。曲を短くするか人数を減らして再試行してください。"
      : `Claudeのレスポンスのパースに失敗しました。受け取ったテキスト(先頭100文字): ${text.slice(0, 100)}`
  );
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // @ts-ignore Deno
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { analysis, dancerCount, stageWidthMm, stageDepthMm, dancers } = body;

    if (!analysis || !dancers || dancers.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing analysis or dancers" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const sectionsDesc = (analysis.sections || [])
      .map(
        (s: { label?: string; startSec?: number; endSec?: number; avgEnergy?: number }, i: number) =>
          `${i + 1}. "${s.label}" ${s.startSec}s–${s.endSec}s (energy: ${s.avgEnergy})`
      )
      .join("\n");

    const dancerLabels = dancers.map(
      (d: { id: string; label: string; colorIndex: number }) =>
        `${d.id}(label:"${d.label}", color:${d.colorIndex})`
    );

    const secPerBeat = 60 / (analysis.bpm || 120);
    const secPer8count = secPerBeat * 8;
    const secPer4count = secPerBeat * 4;
    const secPer32count = secPerBeat * 32;
    const durationSec = Number(analysis.durationSec) || 0;

    // 出力肥大化を防ぐ（途中切れの主因）。最大 8 フォーメーション。
    const byDuration = Math.max(
      3,
      Math.floor(durationSec / Math.max(secPer32count, 1))
    );
    const maxFormations = Math.min(8, byDuration);

    const extraInfo = body.extraInfo ?? "";

    const prompt = `あなたはプロのダンス振付師AIです。楽曲の解析結果に基づき、${dancerCount}人のダンサーのフォーメーションとキューを提案してください。

## 楽曲情報
- 長さ: ${durationSec}秒
- BPM: ${analysis.bpm}
- 1拍: ${secPerBeat.toFixed(3)}秒
- 1エイト(8拍): ${secPer8count.toFixed(3)}秒
- 4エイト(32拍): ${secPer32count.toFixed(3)}秒
- セクション:
${sectionsDesc}

## ステージ情報
- 幅: ${stageWidthMm}mm, 奥行: ${stageDepthMm}mm
- 座標系: xPct 0=左(下手) 100=右(上手), yPct 0=奥 100=手前(客席)
- 実用範囲: x 8〜92, y 10〜88

## ダンサー (${dancerCount}人)
${dancerLabels.join("\n")}
${extraInfo ? `\n## 追加情報\n${extraInfo}\n` : ""}
## タイミング規則（32拍ブロック）
- cue.tStartSec = blockStart
- cue.tEndSec = blockStart + ${(secPer32count - secPer4count).toFixed(3)}（28拍）
- 次の cue.tStartSec = blockStart + ${secPer32count.toFixed(3)}
- 最後のブロックだけ曲終了に合わせて短くしてよい

## 設計ルール
1. ダンサー id は入力のものを再利用（新規 id 禁止）
2. 低エネルギー → 単純形、高エネルギー → 動的な形
3. 重ならないよう最低 5% 離す
4. フォーメーション名は短い日本語
5. **フォーメーション数は最大 ${maxFormations} 個**（これ以上作らない）
6. reasoning は最大 5 文、各文は短く

## 出力（JSONのみ・マークダウン禁止・説明文禁止）
{
  "formations": [
    {
      "id": "短い一意ID",
      "name": "短い名前",
      "dancers": [
        { "id": "既存id", "xPct": 50, "yPct": 50, "colorIndex": 0 }
      ]
    }
  ],
  "cues": [
    {
      "id": "短い一意ID",
      "formationId": "formationsのid",
      "tStartSec": 0,
      "tEndSec": 10,
      "name": "短い名前"
    }
  ],
  "reasoning": ["短い理由"]
}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 16384,
        system:
          "You are a JSON API. Reply with a single JSON object only. Never use markdown fences. No prose.",
        messages: [
          { role: "user", content: prompt },
          // prefilling: マークダウン開始を防ぎ、JSON 強制
          { role: "assistant", content: "{" },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      console.error("Claude API error:", err);
      return new Response(
        JSON.stringify({ error: `Claude API error: ${claudeRes.status}` }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const claudeData = await claudeRes.json();
    const stopReason = claudeData.stop_reason as string | undefined;
    const text = `{${claudeData.content?.[0]?.text ?? ""}`;

    if (stopReason === "max_tokens") {
      console.error(
        "Claude response truncated (max_tokens). preview:",
        text.slice(0, 200)
      );
      return new Response(
        JSON.stringify({
          error:
            "AIの応答が長すぎて途中で切れました。人数を減らすか、もう一度生成してください。",
        }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const parsed: any = robustParseJson(text);

    const seenFormationIds = new Set<string>();
    for (const f of parsed.formations || []) {
      if (!f.id || typeof f.id !== "string" || seenFormationIds.has(f.id)) {
        f.id = crypto.randomUUID();
      }
      seenFormationIds.add(f.id);

      for (const d of f.dancers || []) {
        d.xPct = Math.min(95, Math.max(5, Number(d.xPct) || 50));
        d.yPct = Math.min(92, Math.max(8, Number(d.yPct) || 50));
      }
    }

    for (const c of parsed.cues || []) {
      if (!c.id || typeof c.id !== "string") {
        c.id = crypto.randomUUID();
      }
    }

    // 万一多すぎる場合はサーバ側でも上限
    if (Array.isArray(parsed.formations) && parsed.formations.length > maxFormations) {
      const keep = parsed.formations.slice(0, maxFormations);
      const keepIds = new Set(keep.map((f: { id: string }) => f.id));
      parsed.formations = keep;
      parsed.cues = (parsed.cues || []).filter((c: { formationId: string }) =>
        keepIds.has(c.formationId)
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("suggest-formations error:", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Internal error" }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
