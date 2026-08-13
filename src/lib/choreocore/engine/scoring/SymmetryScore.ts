import type { FormationStyle } from "../types/CueTypes";
import type { Formation } from "../types/FormationTypes";
import { clamp, finite } from "./scoreMath";

export function symmetryScore(formation: Formation, style: FormationStyle): number {
  const raw = clamp(finite(formation.symmetry), 0, 100);
  if (style === "CLEAN") return raw;
  if (style === "ARTISTIC") return clamp(70 + (50 - Math.abs(raw - 50)) * 0.2, 0, 100);
  if (style === "STREET") return clamp(100 - raw * 0.25, 40, 90);
  if (style === "DYNAMIC") return clamp(55 + (raw - 50) * 0.4, 0, 100);
  return raw;
}
