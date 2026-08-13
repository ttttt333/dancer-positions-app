import type { FormationCandidateConfig } from "../types/FormationTypes";

export const DEFAULT_FORMATION_CANDIDATE_CONFIG: FormationCandidateConfig = {
  minCandidates: 5,
  maxCandidates: 15,
};

export const COMPLEXITY_BY_TYPE: Record<string, number> = {
  CENTER: 10,
  LINE: 20,
  DOUBLE_LINE: 25,
  V: 30,
  WIDE_V: 32,
  DIAGONAL: 35,
  DOUBLE_DIAGONAL: 40,
  TRIANGLE: 40,
  ARROW: 40,
  DIAMOND: 45,
  ARC: 50,
  GRID: 55,
  CLUSTER: 25,
  CENTER_WINGS: 60,
  SPLIT: 70,
  PYRAMID: 75,
  CUSTOM: 20,
};

export function resolveFormationCandidateConfig(
  partial?: Partial<FormationCandidateConfig>
): FormationCandidateConfig {
  if (!partial) return DEFAULT_FORMATION_CANDIDATE_CONFIG;
  return { ...DEFAULT_FORMATION_CANDIDATE_CONFIG, ...partial };
}
