/**
 * useAiFormationSuggest — 純アルゴリズム版
 * ブラウザ波形解析（フォールバック）または将来の Python /analyze 結果 → choreocore 生成
 */

import { useState, useCallback, useRef } from "react";
import { analyzeAudio, type AudioAnalysis } from "../lib/audioAnalyze";
import { analyzeSongStructureFromPeaks } from "../lib/songStructureAnalysis";
import { generateAppFormationsFromChangePoints } from "../lib/choreocore/appBridge";
import type {
  ChoreographyProjectJson,
  Formation,
  Cue,
  DancerSpot,
} from "../types/choreography";

export type SuggestStatus =
  | "idle"
  | "analyzing"
  | "requesting"
  | "done"
  | "error";

export interface AiSuggestResult {
  formations: Formation[];
  cues: Cue[];
  reasoning: string[];
  analysis: AudioAnalysis;
}

const genId = (): string =>
  crypto.randomUUID?.() ??
  `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function useAiFormationSuggest(project: ChoreographyProjectJson) {
  const [status, setStatus] = useState<SuggestStatus>("idle");
  const [result, setResult] = useState<AiSuggestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const suggest = useCallback(
    async (peaks: number[], durationSec: number, extraInfo?: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("analyzing");
      setResult(null);
      setError(null);

      try {
        if (controller.signal.aborted) return;

        const analysis = analyzeAudio(peaks, durationSec);
        // コスト0: ブラウザ内で変化点推定（Fly の /analyze が使える場合は後で差し替え可能）
        const structure = analyzeSongStructureFromPeaks(peaks, durationSec);

        const activeFormation =
          project.formations.find((f) => f.id === project.activeFormationId) ??
          project.formations[0];

        let seedDancers: DancerSpot[] = [
          ...(activeFormation?.dancers ?? []),
        ];

        if (seedDancers.length === 0) {
          const count = Math.min(25, project.pieceDancerCount ?? 6);
          seedDancers = Array.from({ length: count }, (_, i) => ({
            id: genId(),
            label: String(i + 1),
            xPct: 20 + (i % 5) * 15,
            yPct: 30 + Math.floor(i / 5) * 12,
            colorIndex: i % 12,
          }));
        }

        if (controller.signal.aborted) return;
        setStatus("requesting");

        const generated = generateAppFormationsFromChangePoints({
          changePoints: structure.change_points,
          seedDancers,
          bpm: structure.bpm,
          durationSec: structure.duration,
          songDynamism: structure.song_dynamism,
        });

        if (controller.signal.aborted) return;

        const note = extraInfo?.trim();
        const reasoning = [
          `純アルゴリズム（LLMなし）/ BPM ${structure.bpm} / 変化点 ${structure.change_points.length} / dynamism ${structure.song_dynamism.toFixed(2)}`,
          ...generated.reasoning,
          ...(note ? [`メモ: ${note.slice(0, 80)}`] : []),
        ];

        setResult({
          formations: generated.formations,
          cues: generated.cues,
          reasoning,
          analysis: {
            ...analysis,
            bpm: structure.bpm,
            durationSec: structure.duration,
          },
        });
        setStatus("done");
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "提案に失敗しました");
        setStatus("error");
      }
    },
    [project]
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, suggest, reset };
}
