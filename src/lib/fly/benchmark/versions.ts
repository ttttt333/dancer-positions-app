/** Phase 4.5 version stamps — keep docs in sync */
export const FLY_BENCHMARK_VERSION = "1.0.0";
export const FLY_GROUND_TRUTH_VERSION = "1.0.0";
export const FLY_DATASET_VERSION = "1.0.0";
export const FLY_METRICS_VERSION = "1.0.0";

export type EvidenceConfidence = "NONE" | "LOW" | "MEDIUM" | "HIGH";

/** Evidence band from sample count — Accuracy alone is never enough */
export function evidenceConfidenceFromSampleCount(n: number): EvidenceConfidence {
  if (!Number.isFinite(n) || n <= 0) return "NONE";
  if (n >= 30) return "HIGH";
  if (n >= 10) return "MEDIUM";
  return "LOW";
}
