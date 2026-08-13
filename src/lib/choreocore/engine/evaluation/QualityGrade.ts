import type {
  BenchmarkConfig,
  CueMetrics,
  EvaluationResult,
  FormationMetrics,
  QualityGrade,
  SectionMetrics,
  SequenceMetrics,
  TransitionMetrics,
} from "../types/EvaluationTypes";
import { clamp, correlationToScore, finite, mean } from "./EvaluationMetrics";

export function qualityGrade(score: number): QualityGrade {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function capGrade(grade: QualityGrade, max: QualityGrade): QualityGrade {
  const order: QualityGrade[] = ["A+", "A", "B", "C", "D", "F"];
  return order.indexOf(grade) > order.indexOf(max) ? grade : max;
}

export function applySafetyCap(
  grade: QualityGrade,
  unsafeRate: number,
  caps: BenchmarkConfig["safetyCaps"]
): QualityGrade {
  if (unsafeRate > caps.capD) return capGrade(grade, "D");
  if (unsafeRate > caps.capC) return capGrade(grade, "C");
  if (unsafeRate > caps.capB) return capGrade(grade, "B");
  return grade;
}

function timingScore(cue: CueMetrics): number {
  const meanErr = cue.timingErrorMean;
  return clamp(100 - meanErr * 40, 0, 100);
}

export function overallQualityScore(
  cue: CueMetrics,
  section: SectionMetrics,
  formation: FormationMetrics,
  transition: TransitionMetrics,
  sequence: SequenceMetrics,
  config: BenchmarkConfig
): number {
  const w = config.overallWeights;
  const parts = [
    timingScore(cue) * w.cueTiming,
    cue.f1 * 100 * w.cueF1,
    cue.majorCueRecall * 100 * w.majorCueRecall,
    section.classificationAccuracy * 100 * w.sectionAccuracy,
    ((formation.top1Agreement + formation.top3Agreement + formation.top5Agreement) / 3) *
      100 *
      w.formationTopK,
    correlationToScore(transition.correlation) * w.transitionQuality,
    (1 - transition.unsafeRecommendationRate) * 100 * w.executionSafety,
    correlationToScore(sequence.correlation) * w.sequenceQuality,
  ];
  const weightSum =
    w.cueTiming +
    w.cueF1 +
    w.majorCueRecall +
    w.sectionAccuracy +
    w.formationTopK +
    w.transitionQuality +
    w.executionSafety +
    w.sequenceQuality;
  const raw = parts.reduce((s, v) => s + v, 0);
  return clamp(finite(raw / (weightSum > 0 ? weightSum : 1)), 0, 100);
}

export function meanMetrics(results: EvaluationResult[]): {
  cuePrecision: number;
  cueRecall: number;
  cueF1: number;
  majorCueRecall: number;
  sectionAccuracy: number;
  formationTop1: number;
  formationTop3: number;
  transitionCorrelation: number;
  unsafeRecommendationRate: number;
  sequenceCorrelation: number;
  overallScore: number;
} {
  if (results.length === 0) {
    return {
      cuePrecision: 0,
      cueRecall: 0,
      cueF1: 0,
      majorCueRecall: 0,
      sectionAccuracy: 0,
      formationTop1: 0,
      formationTop3: 0,
      transitionCorrelation: 0,
      unsafeRecommendationRate: 0,
      sequenceCorrelation: 0,
      overallScore: 0,
    };
  }
  return {
    cuePrecision: mean(results.map((r) => r.cueMetrics.precision)),
    cueRecall: mean(results.map((r) => r.cueMetrics.recall)),
    cueF1: mean(results.map((r) => r.cueMetrics.f1)),
    majorCueRecall: mean(results.map((r) => r.cueMetrics.majorCueRecall)),
    sectionAccuracy: mean(results.map((r) => r.sectionMetrics.classificationAccuracy)),
    formationTop1: mean(results.map((r) => r.formationMetrics.top1Agreement)),
    formationTop3: mean(results.map((r) => r.formationMetrics.top3Agreement)),
    transitionCorrelation: mean(results.map((r) => r.transitionMetrics.correlation)),
    unsafeRecommendationRate: mean(results.map((r) => r.transitionMetrics.unsafeRecommendationRate)),
    sequenceCorrelation: mean(results.map((r) => r.sequenceMetrics.correlation)),
    overallScore: mean(results.map((r) => r.overallScore)),
  };
}
