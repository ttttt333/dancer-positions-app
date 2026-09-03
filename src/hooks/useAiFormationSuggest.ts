/**
 * useAiFormationSuggest — 照明連動フォーメーションAI提案
 * ClassProfile 制約 + FCP/照明テーブル + 被り回避
 */

import { useState, useCallback, useRef } from "react";
import { analyzeAudio, type AudioAnalysis } from "../lib/audioAnalyze";
import { analyzeSongStructureFromPeaks } from "../lib/songStructureAnalysis";
import { fetchRemoteSongAnalysis } from "../lib/songAnalyzeClient";
import {
  generateLightingSyncSuggestion,
  lightingSyncPayloadToApp,
  getClassProfile,
  CLASS_ADVANCED_MON7,
  CLASS_ELEMENTARY,
  CLASS_TODDLER,
  applyTasteToProfile,
  isEmptyTaste,
  resolveSuggestTaste,
  runEngineAppSuggest,
  type SuggestTaste,
} from "../lib/choreocore/lightingSync";
import type {
  ClassProfile,
  LightingSyncSuggestPayload,
} from "../lib/choreocore/lightingSync";
import type { AiEvaluationOutput } from "../lib/choreocore/engine/types/EvaluationTypes";
import {
  DEFAULT_FORMATION_WEIGHTS,
  type FormationScore,
  type SuggestFeedback,
} from "../lib/choreocore/tier1";
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
  /** 仕様書 6. 出力 JSON */
  lightingSyncPayload?: LightingSyncSuggestPayload;
  classProfileId?: string;
  evaluation?: AiEvaluationOutput;
}

const genId = (): string =>
  crypto.randomUUID?.() ??
  `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export type SuggestAudioOpts = {
  audioUrl?: string | null;
  targetCueCount?: number;
  feedback?: SuggestFeedback;
  /** ClassProfile.classId（例: toddler_default / mon_07pm） */
  classProfileId?: string;
  /** 曲イメージ・スタイル・歌詞。隊形選びと移動量に反映 */
  taste?: SuggestTaste;
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
  seedDancers: DancerSpot[];
};

function profileFromFeedback(
  base: ClassProfile,
  feedback?: SuggestFeedback
): ClassProfile {
  if (!feedback) return base;
  let next = { ...base };
  if (feedback.preferLessMovement) {
    next = {
      ...next,
      maxMoveDistancePerCount: Math.min(
        next.maxMoveDistancePerCount,
        CLASS_TODDLER.maxMoveDistancePerCount + 0.15
      ),
      minCountsBetweenChanges: Math.max(
        next.minCountsBetweenChanges,
        CLASS_ELEMENTARY.minCountsBetweenChanges
      ),
    };
  }
  if (feedback.preferFewerCrossings) {
    next = { ...next, allowCrossMovement: false };
  }
  if (feedback.preferMoreImpact) {
    next = {
      ...next,
      allowCrossMovement: true,
      use3DLeveling: true,
      maxMoveDistancePerCount: Math.max(
        next.maxMoveDistancePerCount,
        CLASS_ADVANCED_MON7.maxMoveDistancePerCount
      ),
      minCountsBetweenChanges: Math.min(next.minCountsBetweenChanges, 2),
    };
  }
  return next;
}

function scoresFromPayload(
  payload: LightingSyncSuggestPayload
): { scores: FormationScore[]; averageScore: number } {
  const weights = { ...DEFAULT_FORMATION_WEIGHTS };
  const scores: FormationScore[] = payload.formations.map((f) => {
    const warnN = f.warnings?.length ?? 0;
    const movePenalty = (f.warnings ?? []).filter((w) => w.code === "MOVE_LIMIT")
      .length;
    const crossPenalty = (f.warnings ?? []).filter(
      (w) => w.code === "CROSS_FORBIDDEN"
    ).length;
    const safety = Math.max(0, 100 - warnN * 12 - crossPenalty * 15);
    const move = Math.max(40, 92 - movePenalty * 15);
    const visual =
      f.lightingPreset === "full_bright_warm" ||
      f.lightingPreset === "strobe_flash"
        ? 88
        : f.lightingPreset === "pin_spot_dark"
          ? 70
          : 78;
    const total = Math.round(
      move * weights.move +
        safety * weights.safety +
        visual * weights.visual +
        75 * weights.music
    );
    return {
      total: Math.max(0, Math.min(100, total)),
      axes: {
        move,
        safety,
        visual,
        music: 75,
      },
      weights,
    };
  });
  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((s, x) => s + x.total, 0) / scores.length)
      : 0;
  return { scores, averageScore };
}

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
      feedback: SuggestFeedback | undefined,
      classProfileId: string | undefined,
      taste: SuggestTaste | undefined
    ) => {
      const base = getClassProfile(classProfileId ?? "mon_07pm");
      const tasteBias = resolveSuggestTaste(taste);
      const withTaste = isEmptyTaste(taste)
        ? base
        : applyTasteToProfile(base, tasteBias);
      const profile = profileFromFeedback(withTaste, feedback);

      const constraintLine = `制約: 最大移動 ${profile.maxMoveDistancePerCount}m/count · 最低間隔 ${profile.minCountsBetweenChanges} counts · 交差${profile.allowCrossMovement ? "可" : "不可"} · 3D姿勢${profile.use3DLeveling ? "ON" : "OFF"}`;
      const tasteLine = tasteBias.summary
        ? `曲の指定を隊形に反映: ${tasteBias.summary}`
        : null;
      const feedbackLine = feedback
        ? `再提案フィードバック: ${[
            feedback.preferLessMovement ? "移動少なめ" : "",
            feedback.preferFewerCrossings ? "交差少なめ" : "",
            feedback.preferMoreImpact ? "インパクト重視" : "",
            feedback.note ? `メモ:${feedback.note.slice(0, 40)}` : "",
          ]
            .filter(Boolean)
            .join(" / ") || "なし"}`
        : null;
      const note = extraInfo?.trim();

      try {
        const engine = runEngineAppSuggest({
          peaks: cache.peaks,
          durationSec: cache.duration,
          bpm: cache.bpm,
          remoteChangePoints: cache.changePoints,
          seedDancers: cache.seedDancers,
          profile,
          tasteBias,
          targetCueCount,
        });
        if (engine && engine.formations.length > 0) {
          setResult({
            formations: engine.formations,
            cues: engine.cues,
            reasoning: [
              `曲理解エンジン / クラス: ${profile.className}（${profile.classId}）`,
              `解析ソース: ${cache.sourceLabel} / BPM ${Math.round(cache.bpm)} / キュー ${engine.cues.length}枠${targetCueCount != null ? `（上限 ${targetCueCount}）` : ""}`,
              constraintLine,
              ...(tasteLine ? [tasteLine] : []),
              ...(feedbackLine ? [feedbackLine] : []),
              ...engine.reasoning,
              ...(note ? [`メモ: ${note.slice(0, 80)}`] : []),
            ],
            analysis: {
              ...cache.localAnalysis,
              bpm: cache.bpm,
              durationSec: cache.duration,
            },
            analysisSource: `${cache.sourceLabel} · engine`,
            scores: engine.scores,
            averageScore: engine.averageScore,
            lightingSyncPayload: engine.lightingSyncPayload,
            classProfileId: profile.classId,
            evaluation: engine.evaluation,
          });
          setStatus("done");
          return;
        }
      } catch {
        /* 照明連動へフォールバック */
      }

      const payload = generateLightingSyncSuggestion({
        peaks: cache.peaks,
        durationSec: cache.duration,
        memberIds: cache.seedDancers.map((d) => d.id),
        classProfile: profile,
        remoteChangePoints: cache.changePoints,
        remoteBpm: cache.bpm,
        targetMaxFormations: targetCueCount,
        taste,
      });

      const mapped = lightingSyncPayloadToApp(payload, cache.seedDancers);
      const { scores, averageScore } = scoresFromPayload(payload);

      const reasoning = [
        `照明連動エンジン（予備） / クラス: ${profile.className}（${profile.classId}）`,
        `解析ソース: ${cache.sourceLabel} / BPM ${Math.round(cache.bpm)} / FCP ${payload.formations.length}枠${targetCueCount != null ? `（上限 ${targetCueCount}）` : ""}`,
        constraintLine,
        ...(tasteLine ? [tasteLine] : []),
        ...(feedbackLine ? [feedbackLine] : []),
        ...mapped.reasoning,
        ...(note ? [`メモ: ${note.slice(0, 80)}`] : []),
      ];

      setResult({
        formations: mapped.formations,
        cues: mapped.cues,
        reasoning,
        analysis: {
          ...cache.localAnalysis,
          bpm: cache.bpm,
          durationSec: cache.duration,
        },
        analysisSource: cache.sourceLabel,
        scores,
        averageScore,
        lightingSyncPayload: payload,
        classProfileId: profile.classId,
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
            audioOpts?.feedback,
            audioOpts?.classProfileId,
            audioOpts?.taste
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

        const cache: CachedAnalysis = {
          peaks,
          durationSec,
          changePoints,
          bpm,
          duration,
          dynamism,
          sourceLabel,
          localAnalysis,
          seedDancers,
        };
        cacheRef.current = cache;

        runGenerate(
          cache,
          extraInfo,
          audioOpts?.targetCueCount,
          audioOpts?.feedback,
          audioOpts?.classProfileId,
          audioOpts?.taste
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
