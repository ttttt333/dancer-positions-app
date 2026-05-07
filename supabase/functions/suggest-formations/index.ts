import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateId(): string {
  return crypto.randomUUID();
}

interface DancerInput {
  id: string;
  label: string;
  colorIndex: number;
}

interface Section {
  label: string;
  startSec: number;
  endSec: number;
  avgEnergy: number;
}

interface AudioAnalysis {
  durationSec: number;
  bpm: number;
  sections: Section[];
}

interface RequestBody {
  analysis: AudioAnalysis;
  dancerCount: number;
  stageWidthMm: number | null;
  stageDepthMm: number | null;
  dancers: DancerInput[];
  lang?: string;
}

function buildPrompt(body: RequestBody): string {
  const { analysis, dancerCount, stageWidthMm, stageDepthMm, dancers, lang } = body;
  const { durationSec, bpm, sections } = analysis;

  const sectionsText = sections
    .map(
      (s, i) =>
        `  ${i + 1}. ${s.label}: ${s.startSec.toFixed(1)}秒〜${s.endSec.toFixed(1)}秒（エネルギー: ${
          s.avgEnergy < 0.33 ? "低" : s.avgEnergy < 0.66 ? "中" : "高"
        }）`
    )
    .join("\n");

  const dancerListText = dancers
    .slice(0, 30)
    .map((d) => `  {id: "${d.id}", label: "${d.label}"}`)
    .join("\n");

  const stageText =
    stageWidthMm && stageDepthMm
      ? `幅 ${stageWidthMm}mm × 奥行 ${stageDepthMm}mm`
      : "サイズ未設定（標準的なステージを想定）";

  return `あなたはダンス・ステージパフォーマンスのフォーメーションデザイナーです。
音楽の構造に合わせて、ダンサーの立ち位置（フォーメーション）とタイムラインのキューを設計してください。

## 音楽情報
- 曲の長さ: ${durationSec.toFixed(1)}秒
- BPM: ${bpm}
- セクション:
${sectionsText}

## ステージ情報
- ダンサー数: ${dancerCount}人
- 舞台サイズ: ${stageText}
- ダンサー一覧:
${dancerListText}

## 設計ルール
- xPct（横位置）: 0=左端、50=センター、100=右端。実用範囲は 8〜92。
- yPct（奥行き位置）: 0=奥（上手側）、100=手前（客席側）。実用範囲は 10〜88。
- 各セクションごとに必ず1つ以上のフォーメーションを作る
- エネルギーが高いセクション（サビ等）は動的な形（扇・逆ピラミッド・左右分散など）
- エネルギーが低いセクション（イントロ・アウトロ）はシンプルな形（横一列・縦一列・密集など）
- ダンサーidは必ず入力のものを再利用すること（新しいidは作らない）
- キューのtStartSecはセクション開始の0.5秒後、tEndSecはセクション終了の0.3秒前
- フォーメーション名とキュー名は${lang === "ja" ? "日本語" : "日本語"}で

## 出力形式
必ず以下のJSONのみを返してください。説明文やコードブロック記号は不要です。

{
  "formations": [
    {
      "id": "uuid文字列",
      "name": "フォーメーション名（例: イントロ - 横一列）",
      "dancers": [
        {"id": "既存ダンサーのid", "xPct": 数値, "yPct": 数値, "colorIndex": 数値}
      ]
    }
  ],
  "cues": [
    {
      "id": "uuid文字列",
      "formationId": "上のformationsのid",
      "tStartSec": 数値,
      "tEndSec": 数値,
      "name": "キュー名（例: イントロ）"
    }
  ],
  "reasoning": [
    "各フォーメーションの意図の説明（1行ずつ）"
  ]
}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const body: RequestBody = await req.json();

    if (!body.analysis || !body.dancers || body.dancers.length === 0) {
      return new Response(
        JSON.stringify({ error: "analysis と dancers は必須です" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY が設定されていません" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildPrompt(body);

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return new Response(
        JSON.stringify({ error: `Claude API エラー: ${err}` }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const claudeData = await claudeRes.json();
    const rawText: string = claudeData.content?.[0]?.text ?? "";

    // JSONブロックを抽出（```json ... ``` も対応）
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) ??
      rawText.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1]! : rawText;

    let parsed: { formations: unknown[]; cues: unknown[]; reasoning: string[] };
    try {
      parsed = JSON.parse(jsonStr.trim());
    } catch {
      return new Response(
        JSON.stringify({ error: "Claudeのレスポンスのパースに失敗しました", raw: rawText }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // IDが重複・未設定のものを補完
    const formationIds = new Set<string>();
    const formations = (parsed.formations as Array<Record<string, unknown>>).map((f) => {
      const id = typeof f.id === "string" && f.id ? f.id : generateId();
      formationIds.add(id);
      return { ...f, id };
    });

    const cues = (parsed.cues as Array<Record<string, unknown>>).map((c) => ({
      ...c,
      id: typeof c.id === "string" && c.id ? c.id : generateId(),
    }));

    return new Response(
      JSON.stringify({ formations, cues, reasoning: parsed.reasoning ?? [] }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
