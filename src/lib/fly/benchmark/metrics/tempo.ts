import type { TempoMetrics } from "../types";
import { evidenceConfidenceFromSampleCount } from "../versions";

const EQUIV_REL = 0.04; // 4% relative band for 0.5x / 1x / 2x

export function scoreTempo(
  humanBpm: number | null | undefined,
  hypBpm: number | null | undefined
): TempoMetrics {
  if (humanBpm == null || !(humanBpm > 0)) {
    return {
      status: "NOT_AVAILABLE",
      humanBpm: humanBpm ?? null,
      hypBpm: hypBpm ?? null,
      absoluteErrorBpm: null,
      relativeErrorPercent: null,
      equivalenceRatio: null,
      tempoClassError: null,
      sampleCount: 0,
      evidenceConfidence: "NONE",
    };
  }
  if (hypBpm == null || !(hypBpm > 0)) {
    return {
      status: "EMPTY",
      humanBpm,
      hypBpm: hypBpm ?? null,
      absoluteErrorBpm: null,
      relativeErrorPercent: null,
      equivalenceRatio: null,
      tempoClassError: null,
      sampleCount: 1,
      evidenceConfidence: evidenceConfidenceFromSampleCount(1),
    };
  }

  const abs = Math.abs(hypBpm - humanBpm);
  const rel = (abs / humanBpm) * 100;
  let equivalenceRatio: 0.5 | 1 | 2 | null = null;
  for (const r of [1, 0.5, 2] as const) {
    const target = humanBpm * r;
    if (Math.abs(hypBpm - target) / Math.max(humanBpm, 1e-9) <= EQUIV_REL) {
      equivalenceRatio = r;
      break;
    }
  }
  const tempoClassError = equivalenceRatio == null;

  return {
    status: "OK",
    humanBpm,
    hypBpm,
    absoluteErrorBpm: abs,
    relativeErrorPercent: rel,
    equivalenceRatio,
    tempoClassError,
    sampleCount: 1,
    evidenceConfidence: evidenceConfidenceFromSampleCount(1),
  };
}
