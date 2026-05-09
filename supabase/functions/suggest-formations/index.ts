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

    // 1拍あたりの秒数・1エイト(8拍)・4カウントの秒数を計算
    const secPerBeat = 60 / (analysis.bpm || 120);
    const secPer8count = secPerBeat * 8;   // 1エイト = 8拍
    const secPer4count = secPerBeat * 4;   // 4カウント = 4拍
    const secPer32count = secPerBeat * 32; // 4エイト = 32拍

    const extraInfo = body.extraInfo ?? "";

    const prompt = `あなたはプロのダンス振付師AIです。楽曲の解析結果に基づき、${dancerCount}人のダンサーのフォーメーション（立ち位置）とタイムライン（キュー）を提案してください。

## 楽曲情報
- 長さ: ${analysis.durationSec}秒
- BPM: ${analysis.bpm}
- 1拍: ${secPerBeat.toFixed(3)}秒
- 1エイト(8拍): ${secPer8count.toFixed(3)}秒
- 4エイト(32拍): ${secPer32count.toFixed(3)}秒
- セクション:
${sectionsDesc}

## ステージ情報
- 幅: ${stageWidthMm}mm, 奥行: ${stageDepthMm}mm
- 座標系: xPct 0=左端(下手) 100=右端(上手), yPct 0=奥 100=手前(客席側)
- 実用範囲: x: 8〜92, y: 10〜88

## ダンサー (${dancerCount}人)
${dancerLabels.join("\n")}
${extraInfo ? `\n## ユーザーからの追加情報\n${extraInfo}\n` : ""}
## フォーメーション切り替えの基本ルール（最重要）
フォーメーションの切り替えは【4エイト(32拍)単位】を基本とする。
以下のタイミング構造を必ず守ること：

【1フォーメーションブロックの構造（32拍を1単位とする）】
- 拍 1〜28（3エイト+4カウント）: 現在のフォーメーション位置をキープ（cueのtStartSec〜tEndSec）
- 拍 29〜32（4カウント）: 次のフォーメーションへ移動中（この間はキュー外 = 空白）
- 次ブロックの拍 1〜: 次のフォーメーション開始（次のcueのtStartSec）

具体的な計算式（ブロック開始秒を blockStart とする）:
- cue.tStartSec = blockStart
- cue.tEndSec   = blockStart + ${(secPer32count - secPer4count).toFixed(3)}  （28拍分 = 32拍 - 4カウント）
- 次のcue.tStartSec = blockStart + ${secPer32count.toFixed(3)}  （32拍後）

楽曲の長さに収まるよう、32拍単位でブロックを区切ること。
セクションをまたいでもこの32拍ルールを守る（セクション境界がずれてもよい）。
ただし最後のブロックは楽曲終了に合わせて短くしてよい。

## フォーメーション設計ルール
1. ダンサーIDは必ず入力のものを再利用。新規IDを生成しない
2. エネルギー低(< 0.3) → シンプル形（横一列・縦一列・密集）
3. エネルギー高(> 0.6) → 動的な形（扇・逆ピラミッド・左右分散・ダイヤモンド）
4. ダンサー同士が重ならないよう最低5%は離す
5. 各フォーメーションに意味のある日本語名をつける（例: "サビ-1 逆V字"）
6. 隣接フォーメーション間で移動距離が大きすぎないよう自然な流れを意識する

## 重要: 出力フォーマット
- 必ず純粋なJSONのみを返すこと
- \`\`\`json や \`\`\` などのマークダウン記法は絶対に使用しないこと
- 説明文・前置き・後書きは一切不要。JSONオブジェクト { } のみを返すこと

{
  "formations": [
    {
      "id": "一意のUUID",
      "name": "セクション名-番号 形の説明",
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
      "name": "フォーメーション名"
    }
  ],
  "reasoning": [
    "各フォーメーションの意図と32拍割り当ての理由を1文で説明"
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
        system: "あなたはJSONのみを返すAPIです。マークダウン記法（```json等）は絶対に使用しないこと。説明文・前置き・後書きは不要。回答は常に純粋なJSONオブジェクト { } のみとすること。",
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

    /**
     * robustParseJson — Claude レスポンスから JSON を抽出する堅牢なパーサー
     * 試行順:
     *   1. ```json ... ``` または ``` ... ``` ブロックを除去して parse
     *   2. 先頭・末尾の空白を除去して parse
     *   3. 文字列中の最外 { ... } を抽出して parse
     *   4. すべて失敗したら Error を throw
     */
    function robustParseJson(raw: string): any {
      // Step 1: コードブロック（```json や ```）を除去
      let stripped = raw
        .replace(/^```(?:json)?\s*/i, "")   // 先頭の ```json または ```
        .replace(/\s*```\s*$/i, "")          // 末尾の ```
        .trim();

      // Step 2: そのまま parse を試みる
      try {
        return JSON.parse(stripped);
      } catch (_) { /* 続行 */ }

      // Step 3: 文字列全体に複数のコードブロックが含まれる場合も対処
      const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (codeBlockMatch) {
        try {
          return JSON.parse(codeBlockMatch[1].trim());
        } catch (_) { /* 続行 */ }
      }

      // Step 4: テキスト中から最初の { ... } ブロックを抽出（最大ネスト対応）
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        try {
          return JSON.parse(raw.slice(start, end + 1));
        } catch (_) { /* 続行 */ }
      }

      // Step 5: すべて失敗
      console.error("robustParseJson: 全パース試行失敗。raw text:", raw.slice(0, 300));
      throw new Error(
        `Claudeのレスポンスのパースに失敗しました。受け取ったテキスト(先頭100文字): ${raw.slice(0, 100)}`
      );
    }

    const parsed: any = robustParseJson(text);

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
