/**
 * Real Phase 1 cache → MusicStructureAnalyzer。
 * Synthetic Phase1 は入力にしない。失敗は明示的 fallback reason のみ。
 */

import { ANALYSIS_VERSION } from "../constants";
import { getRealPhase1Cached } from "../audio/realPhase1Cache";
import { analyzeMusicStructure } from "./MusicStructureAnalyzer";
import {
  cloneMusicStructureResult,
  isRealPhase1Provenance,
  recordMusicEngineTrace,
  timelineFromPhase2,
  type Phase2FallbackReason,
  type UnifiedMusicTimeline,
} from "./productionTimeline";
import type {
  MusicAnalysisResultPhase1,
  MusicStructureAnalysisResult,
} from "../types";

export type AnalyzePhase2Fn = (
  phase1: MusicAnalysisResultPhase1
) => MusicStructureAnalysisResult;

export type RealPhase2Success = {
  ok: true;
  phase1: MusicAnalysisResultPhase1;
  phase2: MusicStructureAnalysisResult;
  timeline: UnifiedMusicTimeline;
  phase1CacheHit: boolean;
};

export type RealPhase2Failure = {
  ok: false;
  fallbackReason: Phase2FallbackReason;
};

export type RealPhase2Attempt = RealPhase2Success | RealPhase2Failure;

export function realPhase1RejectReason(
  phase1: MusicAnalysisResultPhase1 | null | undefined,
  expectedVersion: string = ANALYSIS_VERSION
): Phase2FallbackReason | null {
  if (!phase1) return "cache-miss";
  if (!isRealPhase1Provenance(phase1.provenance)) return "wrong-provenance";
  if (phase1.analysisVersion !== expectedVersion) return "version-mismatch";
  if (
    !phase1.frames.length ||
    !Number.isFinite(phase1.duration) ||
    phase1.duration <= 0
  ) {
    return "invalid-phase1";
  }
  return null;
}

function isUsablePhase2(result: MusicStructureAnalysisResult): boolean {
  if (
    !Array.isArray(result.sections) ||
    !Array.isArray(result.phrases) ||
    !Array.isArray(result.changePoints) ||
    !Array.isArray(result.eventClusters)
  ) {
    return false;
  }
  return result.sections.length > 0;
}

function fail(reason: Phase2FallbackReason): RealPhase2Failure {
  recordMusicEngineTrace({
    analysisSource: "synthetic-legacy",
    analysisVersion: ANALYSIS_VERSION,
    cacheHit: false,
    cacheMiss: reason === "cache-miss" || reason === "missing-cache-key",
    fallbackReason: reason,
    phase1CacheHit: false,
    phase2Executed: false,
    phase2FallbackReason: reason,
  });
  return { ok: false, fallbackReason: reason };
}

export function analyzeRealPhase2FromCache(input: {
  cacheKey?: string | null;
  /** テスト用。cache を経由せず Real Phase1 を直接渡す */
  phase1?: MusicAnalysisResultPhase1;
  analyzePhase2?: AnalyzePhase2Fn;
}): RealPhase2Attempt {
  let phase1: MusicAnalysisResultPhase1 | null = null;
  let phase1CacheHit = false;

  if (input.phase1) {
    const reject = realPhase1RejectReason(input.phase1);
    if (reject) return fail(reject);
    phase1 = input.phase1;
  } else {
    const cacheKey = input.cacheKey?.trim() || "";
    if (!cacheKey) return fail("missing-cache-key");
    const rec = getRealPhase1Cached(cacheKey, ANALYSIS_VERSION);
    if (!rec) return fail("cache-miss");
    const reject = realPhase1RejectReason(rec.phase1);
    if (reject) return fail(reject);
    phase1 = rec.phase1;
    phase1CacheHit = true;
  }

  const t0 =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  let phase2: MusicStructureAnalysisResult;
  try {
    const run = input.analyzePhase2 ?? analyzeMusicStructure;
    phase2 = run(phase1);
  } catch {
    return fail("phase2-error");
  }
  const t1 =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();

  if (!isUsablePhase2(phase2)) {
    return fail("empty-phase2");
  }

  const preserved = cloneMusicStructureResult(phase2);
  const timeline = timelineFromPhase2(
    preserved,
    phase1.beats,
    phase1.energyCurve.points,
    "engine-phase12",
    "real"
  );

  recordMusicEngineTrace({
    analysisSource: "engine-phase12",
    analysisVersion: phase1.analysisVersion,
    phase2DurationMs: t1 - t0,
    cacheHit: phase1CacheHit,
    cacheMiss: !phase1CacheHit,
    changePointCount: preserved.changePoints.length,
    phase1CacheHit,
    phase1Provenance: phase1.provenance,
    phase1AnalysisVersion: phase1.analysisVersion,
    phase2Executed: true,
  });

  return {
    ok: true,
    phase1,
    phase2: preserved,
    timeline,
    phase1CacheHit,
  };
}
