import type { LayerScores } from "../types/RealWorldTypes";
import type { AdvisorLayerWeights, FixDifficulty, ImpactLabel } from "../types/AdvisorTypes";
import { DEFAULT_ADVISOR_WEIGHTS } from "../types/AdvisorTypes";
import { clamp } from "../evaluation/EvaluationMetrics";

export function errorSeverity(layerScore: number): number {
  return clamp((100 - layerScore) / 100, 0, 1);
}

export function impactLabel(downstream: number): ImpactLabel {
  if (downstream >= 0.9) return "VERY_HIGH";
  if (downstream >= 0.7) return "HIGH";
  if (downstream >= 0.5) return "MEDIUM";
  return "LOW";
}

export function fixDifficulty(fixability: number): FixDifficulty {
  if (fixability >= 0.75) return "LOW";
  if (fixability >= 0.5) return "MEDIUM";
  return "HIGH";
}

export function layerPriorityScore(
  layerScore: number,
  frequency: number,
  layer: keyof LayerScores,
  weights: AdvisorLayerWeights = DEFAULT_ADVISOR_WEIGHTS
): number {
  const severity = errorSeverity(layerScore);
  const downstream = weights.downstream[layer];
  const fixability = weights.fixability[layer];
  return severity * clamp(frequency, 0, 1) * downstream * fixability;
}

export const LAYER_ORDER: Array<keyof LayerScores> = [
  "phase1Audio",
  "phase2Structure",
  "phase3Cue",
  "phase4Formation",
  "phase5Movement",
  "phase6Sequence",
];
