import { minCostBipartiteAssignment } from "../../../minCostAssignment";
import type { Point } from "../types/FormationTypes";
import type { AssignmentDancer, AssignmentTarget } from "../types/MovementTypes";

function hypotPoint(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export type AssignDancersOptions = {
  strategy?: "hungarian" | "greedy";
};

/**
 * Hungarian assignment with visualWeight / CENTER-MAIN preference.
 * Greedy remains available for comparison.
 */
export function assignDancersToTargets(
  dancers: AssignmentDancer[],
  targets: AssignmentTarget[],
  options: AssignDancersOptions = {}
): Record<string, Point> {
  const n = Math.min(dancers.length, targets.length);
  if (n === 0) return {};
  const ds = [...dancers].sort((a, b) => a.id.localeCompare(b.id));
  const ts = [...targets];

  if (options.strategy === "greedy") {
    return greedy(ds, ts);
  }

  const cost: number[][] = [];
  for (let i = 0; i < ds.length; i += 1) {
    const row: number[] = [];
    const d = ds[i]!;
    for (let j = 0; j < ts.length; j += 1) {
      const t = ts[j]!;
      let c = hypotPoint(d.from, t.to);
      const targetIsCenter =
        t.role === "CENTER" || (t.visualWeight ?? 1) >= 1.45;
      const dancerIsMain = d.role === "MAIN" || d.role === "CENTER";
      if (targetIsCenter && dancerIsMain) c -= 200;
      if (targetIsCenter && !dancerIsMain) c += 80;
      if (t.role && d.role && t.role !== d.role && t.role !== "DEFAULT") c += 12;
      c += Math.abs((d.visualWeight ?? 1) - (t.visualWeight ?? 1)) * 20;
      row.push(c);
    }
    cost.push(row);
  }
  const assignment = minCostBipartiteAssignment(cost);
  const positions: Record<string, Point> = {};
  const used = new Set<number>();
  for (let i = 0; i < assignment.length; i += 1) {
    const j = assignment[i]!;
    if (j < 0 || used.has(j) || !ts[j]) continue;
    used.add(j);
    positions[ds[i]!.id] = ts[j]!.to;
  }
  for (const d of ds) {
    if (positions[d.id]) continue;
    for (let j = 0; j < ts.length; j += 1) {
      if (used.has(j)) continue;
      used.add(j);
      positions[d.id] = ts[j]!.to;
      break;
    }
  }
  return positions;
}

function greedy(
  dancers: AssignmentDancer[],
  targets: AssignmentTarget[]
): Record<string, Point> {
  const used = new Set<number>();
  const positions: Record<string, Point> = {};
  const ordered = [...dancers].sort((a, b) => {
    const ra = a.role === "CENTER" || a.role === "MAIN" ? 0 : 1;
    const rb = b.role === "CENTER" || b.role === "MAIN" ? 0 : 1;
    return ra - rb || a.id.localeCompare(b.id);
  });
  for (const d of ordered) {
    let best = -1;
    let bestC = Infinity;
    for (let j = 0; j < targets.length; j += 1) {
      if (used.has(j)) continue;
      const t = targets[j]!;
      let c = hypotPoint(d.from, t.to);
      if ((t.visualWeight ?? 1) >= 1.45 && (d.role === "MAIN" || d.role === "CENTER")) {
        c -= 200;
      } else if ((t.visualWeight ?? 1) >= 1.45) {
        c += 80;
      }
      if (c < bestC) {
        bestC = c;
        best = j;
      }
    }
    if (best >= 0) {
      used.add(best);
      positions[d.id] = targets[best]!.to;
    }
  }
  return positions;
}
