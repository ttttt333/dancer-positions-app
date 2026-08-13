import type { BenchmarkConfig, OverallScoreWeights } from "../types/EvaluationTypes";

export const DEFAULT_OVERALL_WEIGHTS: OverallScoreWeights = {
  cueTiming: 0.15,
  cueF1: 0.15,
  majorCueRecall: 0.15,
  sectionAccuracy: 0.1,
  formationTopK: 0.15,
  transitionQuality: 0.1,
  executionSafety: 0.15,
  sequenceQuality: 0.15,
};

export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  matchingBeats: 1,
  majorImportance: 80,
  overallWeights: DEFAULT_OVERALL_WEIGHTS,
  gates: {
    majorCueRecall: 0.85,
    unsafeRecommendationRate: 0.02,
    formationTop3: 0.8,
    sequenceCorrelation: 0.75,
    cueF1: 0.8,
  },
  safetyCaps: {
    capB: 0.05,
    capC: 0.1,
    capD: 0.2,
  },
  regression: {
    overallDrop: 2,
    majorRecallDrop: 0.05,
    unsafeRise: 0.01,
  },
};

export function resolveBenchmarkConfig(
  partial?: Partial<BenchmarkConfig>
): BenchmarkConfig {
  if (!partial) return DEFAULT_BENCHMARK_CONFIG;
  return {
    ...DEFAULT_BENCHMARK_CONFIG,
    ...partial,
    overallWeights: { ...DEFAULT_OVERALL_WEIGHTS, ...partial.overallWeights },
    gates: { ...DEFAULT_BENCHMARK_CONFIG.gates, ...partial.gates },
    safetyCaps: { ...DEFAULT_BENCHMARK_CONFIG.safetyCaps, ...partial.safetyCaps },
    regression: { ...DEFAULT_BENCHMARK_CONFIG.regression, ...partial.regression },
  };
}

export function beatPeriodSec(bpm: number): number {
  const safe = bpm > 0 ? bpm : 120;
  return 60 / safe;
}

export function matchingWindowSec(bpm: number, matchingBeats: number): number {
  return beatPeriodSec(bpm) * Math.max(0.25, matchingBeats);
}
