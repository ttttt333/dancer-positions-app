import type { BenchmarkSummary } from "../types/EvaluationTypes";
import type { HumanCeilingRatio } from "../types/RealWorldTypes";
import {
  QUALITY_GATE_TARGETS,
  type GateVerdict,
  type QualityGateId,
  type QualityGateRow,
} from "../types/AdvisorTypes";

function verdict(actual: number, target: number, higherIsBetter: boolean): GateVerdict {
  if (higherIsBetter) {
    if (actual + 1e-12 >= target) return "PASS";
    if (actual >= target * 0.9) return "WATCH";
    return "FAIL";
  }
  if (actual - 1e-12 <= target) return "PASS";
  if (actual <= target * 1.5) return "WATCH";
  return "FAIL";
}

export function evaluateQualityGates(
  summary: BenchmarkSummary,
  ceilingRatio: HumanCeilingRatio
): QualityGateRow[] {
  const rows: Array<Omit<QualityGateRow, "verdict">> = [
    { id: "cueF1", label: "Cue F1", target: QUALITY_GATE_TARGETS.cueF1, actual: summary.cueF1, unit: "ratio", higherIsBetter: true },
    { id: "majorCueRecall", label: "Major Cue Recall", target: QUALITY_GATE_TARGETS.majorCueRecall, actual: summary.majorCueRecall, unit: "ratio", higherIsBetter: true },
    { id: "sectionAccuracy", label: "Section Accuracy", target: QUALITY_GATE_TARGETS.sectionAccuracy, actual: summary.sectionAccuracy, unit: "ratio", higherIsBetter: true },
    { id: "formationTop3", label: "Formation Top-3", target: QUALITY_GATE_TARGETS.formationTop3, actual: summary.formationTop3, unit: "ratio", higherIsBetter: true },
    { id: "transitionCorrelation", label: "Transition Correlation", target: QUALITY_GATE_TARGETS.transitionCorrelation, actual: summary.transitionCorrelation, unit: "ratio", higherIsBetter: true },
    { id: "sequenceCorrelation", label: "Sequence Correlation", target: QUALITY_GATE_TARGETS.sequenceCorrelation, actual: summary.sequenceCorrelation, unit: "ratio", higherIsBetter: true },
    { id: "unsafeRecommendation", label: "Unsafe Recommendation", target: QUALITY_GATE_TARGETS.unsafeRecommendation, actual: summary.unsafeRecommendationRate, unit: "ratio", higherIsBetter: false },
    { id: "humanCeilingRatio", label: "Human Ceiling Ratio", target: QUALITY_GATE_TARGETS.humanCeilingRatio, actual: ceilingRatio.overall, unit: "ratio", higherIsBetter: true },
  ];
  return rows.map((row) => ({
    ...row,
    verdict: verdict(row.actual, row.target, row.higherIsBetter),
  }));
}

export function gateById(rows: QualityGateRow[], id: QualityGateId): QualityGateRow | undefined {
  return rows.find((r) => r.id === id);
}
