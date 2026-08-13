import type { FormationCue } from "../types/CueTypes";
import type { Formation } from "../types/FormationTypes";
import { clamp, finite } from "./scoreMath";

export function complexityScore(formation: Formation, cue: FormationCue): number {
  const energy = cue.energyAfter;
  const complexity = clamp(finite(formation.complexity), 0, 100);
  const gap = Math.abs(energy - complexity);
  if (gap <= 12) return clamp(92 - gap * 0.4, 0, 100);
  if (energy < 30 && complexity > 70) return clamp(28 - (complexity - 70) * 0.3, 0, 50);
  if (energy > 80 && complexity < 25) return clamp(48 + complexity * 0.4, 0, 70);
  return clamp(100 - gap * 0.85, 0, 100);
}
