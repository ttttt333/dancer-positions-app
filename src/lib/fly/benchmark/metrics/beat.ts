import type { TimingDetectionMetrics } from "../types";
import { evidenceConfidenceFromSampleCount } from "../versions";
import { f1, matchTimesGreedy, mean, median } from "./matching";

export const DEFAULT_BEAT_THRESHOLDS_MS = [20, 40, 60, 100] as const;
export const DEFAULT_ONSET_THRESHOLDS_MS = [20, 50, 100] as const;
export const DEFAULT_DOWNBEAT_THRESHOLDS_MS = [20, 40, 60, 100] as const;

export function scoreTimingDetection(
  refTimes: number[] | null | undefined,
  hypTimes: number[] | null | undefined,
  thresholdsMs: readonly number[],
  opts?: { requireRef?: boolean }
): TimingDetectionMetrics {
  const requireRef = opts?.requireRef ?? true;
  if (requireRef && refTimes == null) {
    return emptyTiming(thresholdsMs, "NOT_AVAILABLE", 0);
  }
  const ref = refTimes ?? [];
  const hyp = hypTimes ?? [];
  if (ref.length === 0) {
    return emptyTiming(
      thresholdsMs,
      hyp.length === 0 ? "EMPTY" : "EMPTY",
      hyp.length
    );
  }

  const byThreshold: TimingDetectionMetrics["byThreshold"] = {};
  for (const ms of thresholdsMs) {
    const tol = ms / 1000;
    const pairs = matchTimesGreedy(ref, hyp, tol);
    const nRef = ref.length;
    const nHyp = hyp.length;
    const matched = pairs.length;
    const precision = nHyp > 0 ? matched / nHyp : 0;
    const recall = nRef > 0 ? matched / nRef : 0;
    const errors = pairs.map((p) => p.error);
    byThreshold[String(ms)] = {
      precision,
      recall,
      f1: f1(precision, recall),
      meanTimingError: mean(errors),
      medianTimingError: median(errors),
      matched,
      nRef,
      nHyp,
    };
  }

  const sampleCount = Math.max(ref.length, hyp.length, 1);
  return {
    status: "OK",
    thresholdsMs: [...thresholdsMs],
    byThreshold,
    sampleCount,
    evidenceConfidence: evidenceConfidenceFromSampleCount(sampleCount),
  };
}

function emptyTiming(
  thresholdsMs: readonly number[],
  status: TimingDetectionMetrics["status"],
  sampleCount: number
): TimingDetectionMetrics {
  const byThreshold: TimingDetectionMetrics["byThreshold"] = {};
  for (const ms of thresholdsMs) {
    byThreshold[String(ms)] = {
      precision: 0,
      recall: 0,
      f1: 0,
      meanTimingError: null,
      medianTimingError: null,
      matched: 0,
      nRef: 0,
      nHyp: 0,
    };
  }
  return {
    status,
    thresholdsMs: [...thresholdsMs],
    byThreshold,
    sampleCount,
    evidenceConfidence: evidenceConfidenceFromSampleCount(sampleCount),
  };
}

export function scoreBeats(
  ref: number[] | null | undefined,
  hyp: number[] | null | undefined
): TimingDetectionMetrics {
  return scoreTimingDetection(ref, hyp, DEFAULT_BEAT_THRESHOLDS_MS);
}

export function scoreOnsets(
  ref: number[] | null | undefined,
  hyp: number[] | null | undefined
): TimingDetectionMetrics {
  // Onset GT optional in v1 — null/undefined → NOT_AVAILABLE; [] → EMPTY
  if (ref == null) {
    return scoreTimingDetection(null, hyp, DEFAULT_ONSET_THRESHOLDS_MS, {
      requireRef: true,
    });
  }
  return scoreTimingDetection(ref, hyp, DEFAULT_ONSET_THRESHOLDS_MS);
}

export function scoreDownbeats(
  ref: number[] | null | undefined,
  hyp: number[] | null | undefined
): TimingDetectionMetrics {
  if (ref == null) {
    return scoreTimingDetection(null, hyp, DEFAULT_DOWNBEAT_THRESHOLDS_MS, {
      requireRef: true,
    });
  }
  return scoreTimingDetection(ref, hyp, DEFAULT_DOWNBEAT_THRESHOLDS_MS);
}
