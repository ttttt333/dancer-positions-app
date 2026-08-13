import type { TransitionAnalysis } from "../types/MovementTypes";
import { clamp, mean } from "./scoreMath";

export function feasibilityScore(transition: TransitionAnalysis): number {
  if (!transition.movementPlan.feasible || transition.band === "D") return 0;
  const fromRisk = clamp(100 - transition.risk, 0, 100);
  if (transition.band === "A") return clamp(Math.max(95, fromRisk), 95, 100);
  if (transition.band === "B") return clamp(fromRisk, 80, 94);
  return clamp(fromRisk, 60, 79);
}

export function isHardRejected(transition: TransitionAnalysis): boolean {
  return !transition.movementPlan.feasible || transition.band === "D";
}

export function executionScoreFromBands(transitions: TransitionAnalysis[]): number {
  if (transitions.length === 0) return 100;
  const mapped = transitions.map((t) => {
    if (!t.movementPlan.feasible || t.band === "D") return 0;
    if (t.band === "A") return 100;
    if (t.band === "B") return 82;
    return 64;
  });
  return mean(mapped);
}
