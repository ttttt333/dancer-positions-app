import type { StageConfig } from "../types/CueTypes";
import type { Formation, FormationType, Point } from "../types/FormationTypes";
import { stageToUnit } from "./FormationScaler";

export function formationSignature(
  type: FormationType,
  positions: Record<string, Point>
): string {
  const parts = Object.values(positions)
    .map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)
    .sort();
  return `${type}|${parts.join(";")}`;
}

export function normalizedSignature(
  type: FormationType,
  positions: Record<string, Point>,
  stage: StageConfig
): string {
  const unit: Record<string, Point> = {};
  for (const [id, point] of Object.entries(positions)) {
    const u = stageToUnit(point, stage);
    unit[id] = { x: Number(u.x.toFixed(4)), y: Number(u.y.toFixed(4)) };
  }
  const parts = Object.values(unit)
    .map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)
    .sort();
  return `${type}|${parts.join(";")}`;
}

export function symmetryScore(positions: Record<string, Point>, stage: StageConfig): number {
  const pts = Object.values(positions).map((p) => stageToUnit(p, stage));
  if (pts.length <= 1) return 100;
  let matched = 0;
  for (const p of pts) {
    const mirror = pts.some(
      (q) => Math.abs(q.x + p.x) < 0.08 && Math.abs(q.y - p.y) < 0.08
    );
    if (mirror) matched += 1;
  }
  return Math.round((matched / pts.length) * 100);
}

export function visualImpactScore(
  coverage: number,
  hierarchy: Record<string, number> | undefined,
  type: Formation["type"]
): number {
  const weights = hierarchy ? Object.values(hierarchy) : [];
  const peak = weights.length === 0 ? 1 : Math.max(...weights);
  const hierarchyBoost = Math.min(20, (peak - 1) * 40);
  const typeBoost =
    type === "WIDE_V" || type === "PYRAMID" || type === "CENTER_WINGS" ? 8 : 0;
  return Math.max(0, Math.min(100, coverage * 0.7 + hierarchyBoost + typeBoost));
}

export function spacingScore(
  positions: Record<string, Point>,
  minDist: number
): number {
  const pts = Object.values(positions);
  if (pts.length < 2) return 100;
  let min = Infinity;
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      const dx = pts[i]!.x - pts[j]!.x;
      const dy = pts[i]!.y - pts[j]!.y;
      min = Math.min(min, Math.hypot(dx, dy));
    }
  }
  if (!Number.isFinite(min)) return 0;
  if (min >= minDist * 1.4) return 100;
  if (min >= minDist) return 80;
  return Math.max(0, Math.round((min / minDist) * 70));
}

export function geometryDistance(
  a: Record<string, Point>,
  b: Record<string, Point>
): number {
  const pa = Object.values(a);
  const pb = Object.values(b);
  if (pa.length === 0 || pb.length === 0) return 1;
  let total = 0;
  for (const p of pa) {
    let best = Infinity;
    for (const q of pb) {
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < best) best = d;
    }
    total += best;
  }
  const scale = Math.max(
    1,
    ...pa.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)]),
    ...pb.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)])
  );
  return total / (pa.length * scale);
}
