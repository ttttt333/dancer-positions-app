import type { StageConfig } from "../types/CueTypes";
import type { Formation, Point } from "../types/FormationTypes";
import { usableStage } from "./FormationScaler";

export function enforceMinDistance(
  positions: Record<string, Point>,
  minDist: number,
  stage: StageConfig
): Record<string, Point> {
  const area = usableStage(stage);
  const ids = Object.keys(positions).sort((a, b) => a.localeCompare(b));
  const pts = ids.map((id) => ({ ...positions[id]! }));
  const min2 = minDist * minDist;
  for (let iter = 0; iter < 20; iter += 1) {
    let moved = false;
    for (let i = 0; i < pts.length; i += 1) {
      for (let j = i + 1; j < pts.length; j += 1) {
        const a = pts[i]!;
        const b = pts[j]!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 === 0) {
          a.x = Math.min(area.maxX, a.x + minDist * 0.5);
          b.x = Math.max(area.minX, b.x - minDist * 0.5);
          moved = true;
          continue;
        }
        if (d2 >= min2) continue;
        const d = Math.sqrt(d2);
        const push = (minDist - d) / 2 + 0.05;
        const ux = dx / d;
        const uy = dy / d;
        a.x = Math.min(area.maxX, Math.max(area.minX, a.x + ux * push));
        a.y = Math.min(area.maxY, Math.max(area.minY, a.y + uy * push));
        b.x = Math.min(area.maxX, Math.max(area.minX, b.x - ux * push));
        b.y = Math.min(area.maxY, Math.max(area.minY, b.y - uy * push));
        moved = true;
      }
    }
    if (!moved) break;
  }
  const out: Record<string, Point> = {};
  ids.forEach((id, i) => {
    out[id] = pts[i]!;
  });
  return out;
}

const DUP_EPS = 1e-4;

export function validateFormation(
  formation: Formation,
  dancerCount: number,
  stage: StageConfig
): string[] {
  const reasons: string[] = [];
  const ids = Object.keys(formation.positions);
  if (ids.length !== dancerCount) {
    reasons.push("DANCER_COUNT_MISMATCH");
  }
  const area = usableStage(stage);
  const seen: Point[] = [];
  for (const id of ids) {
    const p = formation.positions[id]!;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      reasons.push("INVALID_COORDINATE");
      continue;
    }
    if (p.x < area.minX - 1e-6 || p.x > area.maxX + 1e-6 || p.y < area.minY - 1e-6 || p.y > area.maxY + 1e-6) {
      reasons.push("OUTSIDE_SAFE_MARGIN");
    }
    if (seen.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < DUP_EPS)) {
      reasons.push("DUPLICATE_POINT");
    }
    seen.push(p);
  }

  const minDist = stage.minDancerDistance;
  if (minDist > 0 && seen.length >= 2) {
    for (let i = 0; i < seen.length; i += 1) {
      for (let j = i + 1; j < seen.length; j += 1) {
        if (Math.hypot(seen[i]!.x - seen[j]!.x, seen[i]!.y - seen[j]!.y) < minDist - 1e-6) {
          reasons.push("MIN_SPACING");
          i = seen.length;
          break;
        }
      }
    }
  }

  return [...new Set(reasons)];
}
