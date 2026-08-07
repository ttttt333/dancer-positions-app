/**
 * useAiFormationSuggest — Tier1 スコア付き純アルゴリズム提案
 * フィードバック付き再提案に対応
 */

import { useState, useCallback, useRef } from "react";
import { analyzeAudio, type AudioAnalysis } from "../lib/audioAnalyze";
import { analyzeSongStructureFromPeaks } from "../lib/songStructureAnalysis";
import { fetchRemoteSongAnalysis } from "../lib/songAnalyzeClient";
import { generateAppFormationsFromChangePoints } from "../lib/choreocore/appBridge";
import type { FormationScore, SuggestFeedback } from "../lib/choreocore/tier1";
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
  analysisSource?: string;
  scores: FormationScore[];
  averageScore: number;
}

const genId = (): string =>
  crypto.randomUUID?.() ??
  `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export type SuggestAudioOpts = {
  audioUrl?: string | null;
  targetCueCount?: number;
  feedback?: SuggestFeedback;
};

type CachedAnalysis = {
  peaks: number[];
  durationSec: number;
  changePoints: ChangePoint[];
  bpm: number;
  duration: number;
  dynamism: number;
  sourceLabel: string;
  localAnalysis: AudioAnalysis;
  sections: {
    label: string;
    startSec: number;
    endSec: number;
    avgEnergy: number;
  }[];
  seedDancers: DancerSpot[];
};

export function useAiFormationSuggest(project: ChoreographyProjectJson) {
  const [status, setStatus] = useState<SuggestStatus>("idle");
  const [result, setResult] = useState<AiSuggestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<CachedAnalysis | null>(null);

  const runGenerate = useCallback(
    (
      cache: CachedAnalysis,
      extraInfo: string | undefined,
      targetCueCount: number | undefined,
      feedback: SuggestFeedback | undefined
    ) => {
      const generated = generateAppFormationsFromChangePoints({
        changePoints: cache.changePoints,
        seedDancers: cache.seedDancers,
        bpm: cache.bpm,
        durationSec: cache.duration,
        songDynamism: cache.dynamism,
        targetCueCount,
        sections: cache.sections,
        energyCurve: cache.peaks,
        feedback,
      });

      const note = extraInfo?.trim();
      const avg =
        generated.scores.length > 0
          ? generated.scores.reduce((s, x) => s + x.total, 0) /
            generated.scores.length
          : 0;
      const reasoning = [
        `解析ソース: ${cache.sourceLabel} / BPM ${Math.round(cache.bpm)} / 変化点候補 ${cache.changePoints.length} → キュー ${generated.cues.length}${targetCueCount != null ? `（指定 ${targetCueCount}）` : ""} / dynamism ${cache.dynamism.toFixed(2)}`,
        ...(feedback
          ? [
              `再提案フィードバック: ${[
                feedback.preferLessMovement ? "移動少なめ" : "",
                feedback.preferFewerCrossings ? "交差少なめ" : "",
                feedback.preferMoreImpact ? "インパクト重視" : "",
                feedback.note ? `メモ:${feedback.note.slice(0, 40)}` : "",
              ]
                .filter(Boolean)
                .join(" / ") || "なし"}`,
            ]
          : []),
        ...generated.reasoning,
        ...(note ? [`メモ: ${note.slice(0, 80)}`] : []),
      ];

      setResult({
        formations: generated.formations,
        cues: generated.cues,
        reasoning,
        analysis: {
          ...cache.localAnalysis,
          bpm: cache.bpm,
          durationSec: cache.duration,
        },
        analysisSource: cache.sourceLabel,
        scores: generated.scores,
        averageScore: Math.round(avg),
      });
      setStatus("done");
    },
    []
  );

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
      setError(null);

      try {
        if (controller.signal.aborted) return;

        // 再提案: キャッシュがあれば解析スキップ
        const canReuse =
          cacheRef.current &&
          cacheRef.current.peaks === peaks &&
          Math.abs(cacheRef.current.durationSec - durationSec) < 0.01 &&
          audioOpts?.feedback;

        if (canReuse && cacheRef.current) {
          setStatus("requesting");
          runGenerate(
            cacheRef.current,
            extraInfo,
            audioOpts?.targetCueCount,
            audioOpts?.feedback
          );
          return;
        }

        setResult(null);
        const localAnalysis = analyzeAudio(peaks, durationSec);
        const browser = analyzeSongStructureFromPeaks(peaks, durationSec);

        setStatus("requesting");

        const remote = await fetchRemoteSongAnalysis({
          audioSupabasePath: project.audioSupabasePath,
          audioUrl: audioOpts?.audioUrl,
          trackTitle: project.pieceTitle,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

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

        const sections = localAnalysis.sections.map((s) => ({
          label: s.label,
          startSec: s.startSec,
          endSec: s.endSec,
          avgEnergy: s.avgEnergy,
        }));

        const cache: CachedAnalysis = {
          peaks,
          durationSec,
          changePoints,
          bpm,
          duration,
          dynamism,
          sourceLabel,
          localAnalysis,
          sections,
          seedDancers,
        };
        cacheRef.current = cache;

        runGenerate(
          cache,
          extraInfo,
          audioOpts?.targetCueCount,
          audioOpts?.feedback
        );
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "提案に失敗しました");
        setStatus("error");
      }
    },
    [project, runGenerate]
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setResult(null);
    setError(null);
    cacheRef.current = null;
  }, []);

  return { status, result, error, suggest, reset };
}
