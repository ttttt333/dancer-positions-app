/**
 * StructureResultV2 を EngineAppSuggest に注入する結合層。
 * UI（useAiFormationSuggest）と同じ経路を、スクリプト／テストからも使えるようにする。
 */

import { fetchSongStructureV2 } from "../../api/songAnalysisClient";
import type { StructureResultV2 } from "../types/songStructure";
import {
  runEngineAppSuggest,
  type EngineAppSuggestInput,
  type EngineAppSuggestResult,
} from "../lightingSync/engineSuggestPipeline";

export type SuggestPipelineParams = EngineAppSuggestInput & {
  /** 未キャッシュ時に Fly / Edge から StructureResultV2 を取得 */
  audioUrl?: string | null;
  audioSupabasePath?: string | null;
  trackTitle?: string | null;
  /** 既に取得済みなら再フェッチしない */
  cachedStructureV2?: StructureResultV2 | null;
};

/**
 * structureV2 を解決してから AI サジェストを実行する。
 * null のときはエンジン側のレガシー近似（approximateSongSectionV2FromLegacy）が動作する。
 */
export async function resolveStructureV2ForSuggest(params: {
  audioUrl?: string | null;
  audioSupabasePath?: string | null;
  trackTitle?: string | null;
  cachedStructureV2?: StructureResultV2 | null;
  signal?: AbortSignal;
}): Promise<StructureResultV2 | null> {
  if (params.cachedStructureV2) return params.cachedStructureV2;
  if (params.audioUrl || params.audioSupabasePath) {
    return fetchSongStructureV2(params.audioUrl ?? "", {
      audioSupabasePath: params.audioSupabasePath,
      trackTitle: params.trackTitle,
      signal: params.signal,
    });
  }
  return null;
}

export async function runSuggestPipeline(
  params: SuggestPipelineParams
): Promise<EngineAppSuggestResult> {
  const structureV2 =
    params.structureV2 ??
    (await resolveStructureV2ForSuggest({
      audioUrl: params.audioUrl,
      audioSupabasePath: params.audioSupabasePath,
      trackTitle: params.trackTitle,
      cachedStructureV2: params.cachedStructureV2,
    }));

  return runEngineAppSuggest({
    peaks: params.peaks,
    durationSec: params.durationSec,
    bpm: params.bpm,
    remoteChangePoints: params.remoteChangePoints,
    sectionFamilies: params.sectionFamilies,
    seedDancers: params.seedDancers,
    profile: params.profile,
    tasteBias: params.tasteBias,
    targetCueCount: params.targetCueCount,
    dancerSpacingMm: params.dancerSpacingMm,
    stageWidthMm: params.stageWidthMm,
    audioCacheKey: params.audioCacheKey,
    projectKey: params.projectKey,
    canaryActivation: params.canaryActivation,
    layoutVarietySalt: params.layoutVarietySalt,
    structureV2: structureV2 ?? undefined,
  });
}
