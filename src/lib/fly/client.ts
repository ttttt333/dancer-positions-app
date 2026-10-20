/**
 * FLY クライアント入口 — 既存 Edge/Fly 取得を包み、FlyAnalysisResult を返す。
 * Formation Engine へ渡すときは structureV2 を併用する。
 *
 * Phase 4: 既定は librosa/AIO のみ。PCM を渡し flag ON のときだけ Essentia を Fusion へ合流。
 * Essentia 結果は Formation Engine に直結しない。
 */

import {
  fetchRemoteSongAnalysis,
  type RemoteSongAnalysis,
} from "../songAnalyzeClient";
import type { FlyAudioInput } from "./adapters/types";
import { fuseWithOptionalEssentia } from "./ensemble";
import { fuseToFlyAnalysis } from "./fusion";
import { structureV2FromFlyAnalysis } from "./toStructureV2";
import type { FlyAnalysisResult } from "./types";
import type { StructureResultV2 } from "../choreocore/types/songStructure";
import type { FlyFusionResult } from "./fusionMulti";

export type FlyAnalyzeSongOpts = {
  audioUrl?: string | null;
  audioSupabasePath?: string | null;
  trackTitle?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
  /**
   * Optional decoded PCM for Essentia adapter (feature flag required).
   * Without this, path is identical to Phase 1–3.
   */
  audioPcm?: FlyAudioInput | null;
};

export type FlyAnalyzeSongBundle = {
  fly: FlyAnalysisResult | null;
  /** Formation Engine / overlay 互換 */
  structureV2: StructureResultV2 | null;
  remote: RemoteSongAnalysis | null;
  /** Multi-analyzer fusion detail (Phase 4+) */
  fusion?: FlyFusionResult | null;
};

/**
 * 音源を解析し FLY 契約へ投影する。
 * 失敗時は null（呼び出し側で browser fallback）。
 */
export async function analyzeSongWithFly(
  opts: FlyAnalyzeSongOpts
): Promise<FlyAnalyzeSongBundle> {
  const remote = await fetchRemoteSongAnalysis({
    audioUrl: opts.audioUrl,
    audioSupabasePath: opts.audioSupabasePath,
    trackTitle: opts.trackTitle,
    signal: opts.signal,
    timeoutMs: opts.timeoutMs,
  });

  if (!remote?.structure_v2) {
    return { fly: null, structureV2: null, remote, fusion: null };
  }

  const fusion = await fuseWithOptionalEssentia({
    structureV2: remote.structure_v2,
    audioHash: remote.audio_hash,
    songDynamism: remote.song_dynamism,
    analyzerVersion: remote.analyzer_version,
    changePoints: remote.change_points,
    sourceLabel: remote.source,
    audio: opts.audioPcm ?? null,
  });

  const fly =
    fusion.fly ??
    fuseToFlyAnalysis({
      structureV2: remote.structure_v2,
      audioHash: remote.audio_hash,
      songDynamism: remote.song_dynamism,
      analyzerVersion: remote.analyzer_version,
      changePoints: remote.change_points,
      sourceLabel: remote.source,
    });

  return {
    fly,
    structureV2: fusion.structureV2 ?? structureV2FromFlyAnalysis(fly),
    remote,
    fusion,
  };
}
