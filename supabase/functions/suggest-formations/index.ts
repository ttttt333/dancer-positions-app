/**
 * suggest-formations — Supabase Edge Function
 * 音声解析結果 + ダンサー情報 → Claude Haiku でフォーメーション提案
 */

// @ts-ignore Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // @ts-ignore Deno
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { analysis, dancerCount, stageWidthMm, stageDepthMm, dancers, lang } = body;

    if (!analysis || !dancers || dancers.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing analysis or dancers" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Build sections description
    const sectionsDesc = (analysis.sections || [])
      .map((s: any, i: number) =>
        `${i + 1}. "${s.label}" ${s.startSec}s–${s.endSec}s (energy: ${s.avgEnergy})`
      )
      .join("\n");

    const dancerIds = dancers.map((d: any) => d.id);
    const dancerLabels = dancers.map((d: any) => `${d.id}(label:"${d.label}", color:${d.colorIndex})`);

    const prompt = `あなたはプロのダンス振付師AIです。楽曲の解析結果に基づき、${dancerCount}人のダンサーのフォーメーション（立ち位置）とタイムライン（キュー）を提案してください。

## 楽曲情報
- 長さ: ${analysis.durationSec}秒
- BPM: ${analysis.bpm}
- セクション:
${sectionsDesc}

## ステージ情報
- 幅: ${stageWidthMm}mm, 奥行: ${stageDepthMm}mm
- 座標系: xPct 0=左端(下手) 100=右端(上手), yPct 0=奥 100=手前(客席側)
- 実用範囲: x: 8〜92, y: 10〜88

## ダンサー (${dancerCount}人)
${dancerLabels.join("\n")}

## ルール
1. 各セクションに1つのフォーメーションを作成（セクション数 = フォーメーション数）
2. ダンサーIDは必ず入力のものを再利用。新規IDを生成しない
3. エネルギー低(< 0.3) → シンプル形（横一列・縦一列・密集）
4. エネルギー高(> 0.6) → 動的な形（扇・逆ピラミッド・左右分散・ダイヤモンド）
5. キューのタイミング: tStartSec = セクション開始 + 0.5秒, tEndSec = セクション終了 - 0.3秒
6. ダンサー同士が重ならないよう最低5%は離す
7. 各フォーメーションに意味のある日本語名をつける（例: "サビ - 逆V字"）
8. 隣接フォーメーション間で大きすぎる移動を避ける（前のフォーメーションからの自然な流れ）

## 出力形式（JSON のみ。説明文は不要）
{
  "formations": [
    {
      "id": "一意のUUID",
      "name": "セクション名 - 形の説明",
      "dancers": [
        { "id": "既存ダンサーid", "xPct": 数値, "yPct": 数値, "colorIndex": 数値 }
      ]
    }
  ],
  "cues": [
    {
      "id": "一意のUUID",
      "formationId": "上記formationsのid",
      "tStartSec": 数値,
      "tEndSec": 数値,
      "name": "セクション名"
    }
  ],
  "reasoning": [
    "各フォーメーションの意図を1文で説明"
  ]
}`;

    // Call Claude API
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20250414",
        max_tokens: 4096,
        messages: [
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      console.error("Claude API error:", err);
      return new Response(
        JSON.stringify({ error: `Claude API error: ${claudeRes.status}` }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const claudeData = await claudeRes.json();
    const text = claudeData.content?.[0]?.text ?? "";

    // Parse JSON from response (handle ```json blocks)
    let jsonStr = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr.trim());
    } catch {
      // Try to find JSON object in the text
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objMatch) {
        parsed = JSON.parse(objMatch[0]);
      } else {
        throw new Error("Claude response is not valid JSON");
      }
    }

    // Validate & fix IDs
    const seenFormationIds = new Set<string>();
    for (const f of parsed.formations || []) {
      if (!f.id || typeof f.id !== "string" || seenFormationIds.has(f.id)) {
        f.id = crypto.randomUUID();
      }
      seenFormationIds.add(f.id);

      // Clamp coordinates
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

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("suggest-formations error:", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Internal error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
