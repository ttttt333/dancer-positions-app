import { useCallback, useState } from "react";
import type { ChoreographyProjectJson, Cue, DancerSpot, Formation } from "../types/choreography";
import { analyzeAudio, type AudioAnalysis } from "../lib/audioAnalyze";
import { generateId } from "../lib/generateId";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type SuggestStatus =
  | "idle"
  | "analyzing"   // 音声解析中
  | "requesting"  // Claude API呼び出し中
  | "done"        // 完了、結果あり
  | "error";

export interface SuggestResult {
  formations: Formation[];
  cues: Cue[];
  reasoning: string[];
  analysis: AudioAnalysis;
}

export function useAiFormationSuggest(project: ChoreographyProjectJson) {
  const [status, setStatus] = useState<SuggestStatus>("idle");
  const [result, setResult] = useState<SuggestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suggest = useCallback(
    async (peaks: number[], durationSec: number) => {
      setStatus("analyzing");
      setError(null);
      setResult(null);

      try {
        // Step1: ブラウザ内で音楽解析
        const analysis = analyzeAudio(peaks, durationSec);

        setStatus("requesting");

        // Step2: Supabase Edge Function 経由で Claude に問い合わせ
        const currentFormation = project.formations.find(
          (f) => f.id === project.activeFormationId
        );
        const dancers: { id: string; label: string; colorIndex: number }[] = (
          currentFormation?.dancers ?? []
        ).map((d: DancerSpot) => ({
          id: d.id,
          label: d.label,
          colorIndex: d.colorIndex,
        }));

        // ダンサーが0人の場合は仮のダンサーリストを生成
        const effectiveDancers =
          dancers.length > 0
            ? dancers
            : Array.from({ length: project.pieceDancerCount ?? 6 }, (_, i) => ({
                id: generateId(),
                label: String(i + 1),
                colorIndex: i,
              }));

        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/suggest-formations`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              analysis,
              dancerCount: effectiveDancers.length,
              stageWidthMm: project.stageWidthMm,
              stageDepthMm: project.stageDepthMm,
              dancers: effectiveDancers,
              lang: "ja",
            }),
          }
        );

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`APIエラー (${res.status}): ${errBody}`);
        }

        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        // レスポンスのバリデーション・型補完
        const formations: Formation[] = (data.formations ?? []).map(
          (f: Record<string, unknown>) => ({
            id: typeof f.id === "string" ? f.id : generateId(),
            name: typeof f.name === "string" ? f.name : "AIフォーメーション",
            dancers: Array.isArray(f.dancers)
              ? (f.dancers as Record<string, unknown>[]).map((d) => ({
                  id: typeof d.id === "string" ? d.id : generateId(),
                  label:
                    typeof d.label === "string"
                      ? d.label
                      : effectiveDancers.find((ed) => ed.id === d.id)?.label ?? "?",
                  xPct: clamp(Number(d.xPct) || 50, 5, 95),
                  yPct: clamp(Number(d.yPct) || 50, 8, 92),
                  colorIndex:
                    typeof d.colorIndex === "number"
                      ? d.colorIndex
                      : effectiveDancers.find((ed) => ed.id === d.id)?.colorIndex ?? 0,
                }))
              : [],
            setPieces: [],
          })
        );

        const cues: Cue[] = (data.cues ?? []).map((c: Record<string, unknown>) => ({
          id: typeof c.id === "string" ? c.id : generateId(),
          formationId: typeof c.formationId === "string" ? c.formationId : "",
          tStartSec: Math.max(0, Number(c.tStartSec) || 0),
          tEndSec: Math.min(durationSec, Number(c.tEndSec) || durationSec),
          name: typeof c.name === "string" ? c.name : undefined,
        }));

        setResult({
          formations,
          cues,
          reasoning: Array.isArray(data.reasoning) ? data.reasoning : [],
          analysis,
        });
        setStatus("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    },
    [project]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, suggest, reset };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
