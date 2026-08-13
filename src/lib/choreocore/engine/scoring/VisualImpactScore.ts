import type { FormationCue } from "../types/CueTypes";
import type { Formation, FormationCandidate, FormationType } from "../types/FormationTypes";
import { clamp, finite } from "./scoreMath";
import { energyBandTargetCoverage } from "./MusicFitScore";

const HIERARCHY: Partial<Record<FormationType, number>> = {
  CENTER_WINGS: 92,
  V: 88,
  WIDE_V: 90,
  PYRAMID: 91,
  ARROW: 86,
  TRIANGLE: 78,
  DIAMOND: 76,
  CENTER: 82,
  ARC: 74,
  SPLIT: 72,
  DIAGONAL: 73,
  DOUBLE_DIAGONAL: 70,
  CLUSTER: 58,
  GRID: 42,
  LINE: 48,
  DOUBLE_LINE: 50,
};

export function visualHierarchyScore(type: FormationType): number {
  return HIERARCHY[type] ?? 60;
}

export function visualImpactScore(options: {
  candidate: FormationCandidate;
  cue: FormationCue;
}): number {
  const { candidate, cue } = options;
  const formation: Formation = candidate.formation;
  const coverage = formation.stageCoverage;
  const hierarchy = visualHierarchyScore(formation.type);
  const stored = formation.visualImpact;
  const compactWanted =
    cue.action === "CONTRACT" || cue.action === "CLUSTER" || cue.action === "CENTER";
  const coverageFit = compactWanted
    ? clamp(100 - coverage * 0.9, 0, 100)
    : cue.magnitude === "MAX"
      ? clamp(coverage * 1.05, 0, 100)
      : clamp(100 - Math.abs(coverage - energyBandTargetCoverage(cue.energyAfter)) * 0.8, 0, 100);

  const score = stored * 0.35 + coverageFit * 0.35 + hierarchy * 0.3;
  return clamp(finite(score), 0, 100);
}
