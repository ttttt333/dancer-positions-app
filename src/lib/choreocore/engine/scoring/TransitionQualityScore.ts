import type { TransitionAnalysis } from "../types/MovementTypes";
import { clamp, finite } from "./scoreMath";

export function transitionQualityScore(transition: TransitionAnalysis): number {
  if (!transition.movementPlan.feasible || transition.band === "D") {
    return clamp(transition.transitionScore * 0.4, 0, 35);
  }
  const crossing = transition.warnings.includes("SAME_TIME_CROSSING")
    ? 18
    : transition.warnings.includes("PATH_CROSSING")
      ? 8
      : 0;
  const conv = transition.warnings.includes("CONVERGENCE") ? 6 : 0;
  const distPenalty = clamp(transition.movementPlan.averageDistance / 12, 0, 20);
  const score =
    transition.transitionScore * 0.7 +
    clamp(100 - transition.risk, 0, 100) * 0.3 -
    crossing -
    conv -
    distPenalty * 0.25;
  return clamp(finite(score), 0, 100);
}
