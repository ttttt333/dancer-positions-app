/**
 * Real Phase 1 のメモリキャッシュ。
 * synthetic / phase1FromPeaks の結果は入れない。
 * キー: audio identity（wave cacheKey）+ ANALYSIS_VERSION。不一致は miss。
 */

import { ANALYSIS_VERSION } from "../constants";
import type { MusicAnalysisResultPhase1 } from "../types";

export type RealPhase1CacheRecord = {
  cacheKey: string;
  analysisVersion: string;
  duration: number;
  sampleRate: number;
  frameCount: number;
  phase1: MusicAnalysisResultPhase1;
};

const memory = new Map<string, RealPhase1CacheRecord>();

export function realPhase1StorageKey(
  cacheKey: string,
  analysisVersion: string = ANALYSIS_VERSION
): string {
  return `${cacheKey}::${analysisVersion}`;
}

export function clearRealPhase1Cache(): void {
  memory.clear();
}

export function getRealPhase1Cached(
  cacheKey: string | null | undefined,
  analysisVersion: string = ANALYSIS_VERSION
): RealPhase1CacheRecord | null {
  if (!cacheKey) return null;
  const hit = memory.get(realPhase1StorageKey(cacheKey, analysisVersion));
  if (!hit || hit.phase1.provenance !== "real") return null;
  if (hit.analysisVersion !== analysisVersion) return null;
  return hit;
}

export function setRealPhase1Cached(
  cacheKey: string,
  phase1: MusicAnalysisResultPhase1
): RealPhase1CacheRecord | null {
  if (phase1.provenance !== "real") return null;
  if (phase1.analysisVersion !== ANALYSIS_VERSION) return null;
  if (!Number.isFinite(phase1.duration) || phase1.duration <= 0) return null;
  if (!phase1.frames.length) return null;
  const record: RealPhase1CacheRecord = {
    cacheKey,
    analysisVersion: phase1.analysisVersion,
    duration: phase1.duration,
    sampleRate: phase1.sampleRate,
    frameCount: phase1.frames.length,
    phase1,
  };
  memory.set(realPhase1StorageKey(cacheKey, phase1.analysisVersion), record);
  return record;
}
