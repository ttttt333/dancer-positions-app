/**
 * useAiFormationSuggest — 純アルゴリズム版
 * 優先: Fly /analyze（Edge analyze-song）→ 失敗時ブラウザ波形解析
 */

import { useState, useCallback, useRef } from "react";
import { analyzeAudio, type AudioAnalysis } from "../lib/audioAnalyze";
import { analyzeSongStructureFromPeaks } from "../lib/songStructureAnalysis";
import { fetchRemoteSongAnalysis } from "../lib/songAnalyzeClient";
import { generateAppFormationsFromChangePoints } from "../lib/choreocore/appBridge";
import type { ChangePoint } from "../lib/choreocore/types";
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
  /** fly / cache / browser */
  analysisSource?: string;
}

const genId = (): string =>
  crypto.randomUUID?.() ??
  `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export type SuggestAudioOpts = {
  /** playbackEngine などから渡す再生中 URL（https のみ Fly から取得可） */
  audioUrl?: string | null;
  /** 開始を含む目標キュー数（曲展開から重要変化点を選定） */
  targetCueCount?: number;
};

export function useAiFormationSuggest(project: ChoreographyProjectJson) {
  const [status, setStatus] = useState<SuggestStatus>("idle");
  const [result, setResult] = useState<AiSuggestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const suggest = useCallback(
    async (
      peaks: number[],
      durationSec: number,
      extraInfo?: string,
      audioOpts?: SuggestAudioOpts
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("analyzing");
      setResult(null);
      setError(null);

      try {
        if (controller.signal.aborted) return;

        const localAnalysis = analyzeAudio(peaks, durationSec);

        setStatus("requesting");

        const remote = await fetchRemoteSongAnalysis({
          audioSupabasePath: project.audioSupabasePath,
          audioUrl: audioOpts?.audioUrl,
          trackTitle: project.pieceTitle,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const browser = analyzeSongStructureFromPeaks(peaks, durationSec);

        const changePoints: ChangePoint[] = remote
          ? remote.change_points
          : browser.change_points;
        const bpm = remote?.bpm ?? browser.bpm;
        const duration = remote?.duration ?? browser.duration;
        const dynamism = remote?.song_dynamism ?? browser.song_dynamism;
        const sourceLabel = remote
          ? remote.source === "cache"
            ? "fly-cache"
            : remote.source === "direct"
              ? "fly-direct"
              : "fly"
          : "browser";

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

        const targetCueCount = audioOpts?.targetCueCount;

        const generated = generateAppFormationsFromChangePoints({
          changePoints,
          seedDancers,
          bpm,
          durationSec: duration,
          songDynamism: dynamism,
          targetCueCount,
        });

        if (controller.signal.aborted) return;

        const note = extraInfo?.trim();
        const reasoning = [
          `解析ソース: ${sourceLabel} / BPM ${Math.round(bpm)} / 変化点候補 ${changePoints.length} → キュー ${generated.cues.length}${targetCueCount != null ? `（指定 ${targetCueCount}）` : ""} / dynamism ${dynamism.toFixed(2)}`,
          ...generated.reasoning,
          ...(note ? [`メモ: ${note.slice(0, 80)}`] : []),
        ];

        setResult({
          formations: generated.formations,
          cues: generated.cues,
          reasoning,
          analysis: {
            ...localAnalysis,
            bpm,
            durationSec: duration,
          },
          analysisSource: sourceLabel,
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
