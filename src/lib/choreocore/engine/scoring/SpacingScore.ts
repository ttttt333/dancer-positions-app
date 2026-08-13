import type { StageConfig } from "../types/CueTypes";
import type { Formation } from "../types/FormationTypes";
import { spacingScore as previewSpacing } from "../formation/FormationNormalizer";
import { clamp, finite } from "./scoreMath";

export function spacingScore(formation: Formation, stage: StageConfig): number {
  const pts = Object.values(formation.positions);
  if (pts.length < 2) return 100;
  const minBase = previewSpacing(formation.positions, stage.minDancerDistance);
  const nearest: number[] = [];
  for (let i = 0; i < pts.length; i += 1) {
    let best = Infinity;
    for (let j = 0; j < pts.length; j += 1) {
      if (i === j) continue;
      const d = Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y);
      if (d < best) best = d;
    }
    nearest.push(best);
  }
  const avg = nearest.reduce((s, d) => s + d, 0) / nearest.length;
  const variance =
    nearest.reduce((s, d) => s + (d - avg) ** 2, 0) / nearest.length;
  const std = Math.sqrt(variance);
  const uniformPenalty = std < stage.minDancerDistance * 0.08 ? 6 : 0;
  const wildPenalty = std > stage.minDancerDistance * 1.8 ? 10 : 0;
  const centerFocus =
    formation.type === "CENTER_WINGS" ||
    formation.type === "V" ||
    formation.type === "PYRAMID" ||
    formation.type === "CENTER";
  const focusRelief = centerFocus ? 6 : 0;
  return clamp(finite(minBase - uniformPenalty - wildPenalty + focusRelief), 0, 100);
}
