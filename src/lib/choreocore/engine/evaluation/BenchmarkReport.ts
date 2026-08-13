import type { BenchmarkSummary } from "../types/EvaluationTypes";

export function formatBenchmarkReport(summary: BenchmarkSummary): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  return [
    "============================",
    "ChoreoCore AI Benchmark",
    "=======================",
    "",
    `Overall: ${summary.overallScore.toFixed(1)} / 100`,
    `Grade: ${summary.grade}`,
    `Status: ${summary.status}`,
    "",
    `Cue Precision: ${pct(summary.cuePrecision)}`,
    `Cue Recall: ${pct(summary.cueRecall)}`,
    `Cue F1: ${pct(summary.cueF1)}`,
    `Major Cue Recall: ${pct(summary.majorCueRecall)}`,
    `Section Accuracy: ${pct(summary.sectionAccuracy)}`,
    `Formation Top-1: ${pct(summary.formationTop1)}`,
    `Formation Top-3: ${pct(summary.formationTop3)}`,
    `Transition Correlation: ${summary.transitionCorrelation.toFixed(2)}`,
    `Unsafe Recommendation: ${pct(summary.unsafeRecommendationRate)}`,
    `Sequence Correlation: ${summary.sequenceCorrelation.toFixed(2)}`,
    `Critical Failures: ${summary.criticalFailureCount}`,
    "",
    "============================",
  ].join("\n");
}
