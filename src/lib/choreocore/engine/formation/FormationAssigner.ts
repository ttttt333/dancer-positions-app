import type { FormationSlot, Point } from "../types/FormationTypes";

function dist2(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Greedy nearest assignment. Center / MAIN / high visualWeight slots are
 * claimed first. Swap-in for Hungarian in Phase 5.
 */
export function assignSlots(
  slots: FormationSlot[],
  stagePoints: Point[],
  dancerIds: string[]
): Record<string, Point> {
  const ids = [...dancerIds].sort((a, b) => a.localeCompare(b));
  const n = Math.min(slots.length, stagePoints.length, ids.length);
  const order = slots
    .map((slot, index) => ({ slot, index }))
    .sort((a, b) => {
      const roleRank = (role: FormationSlot["role"]) =>
        role === "CENTER" ? 0 : role === "MAIN" ? 1 : role === "WING" ? 2 : 3;
      return (
        roleRank(a.slot.role) - roleRank(b.slot.role) ||
        b.slot.visualWeight - a.slot.visualWeight ||
        a.index - b.index
      );
    });
  const positions: Record<string, Point> = {};
  for (let k = 0; k < n; k += 1) {
    const slotIndex = order[k]?.index ?? k;
    const point = stagePoints[slotIndex];
    if (!point) continue;
    positions[ids[k]!] = point;
  }
  for (let i = 0; i < n; i += 1) {
    if (positions[ids[i]!]) continue;
    for (let j = 0; j < n; j += 1) {
      const taken = Object.values(positions).some(
        (p) => p.x === stagePoints[j]!.x && p.y === stagePoints[j]!.y
      );
      if (!taken) {
        positions[ids[i]!] = stagePoints[j]!;
        break;
      }
    }
  }
  return positions;
}

/**
 * Prefer nearest current position when currentFormation exists.
 */
export function assignFromCurrent(
  stagePoints: Point[],
  current: Record<string, Point>,
  dancerIds: string[],
  slotWeights: number[]
): Record<string, Point> {
  const ids = [...dancerIds].sort((a, b) => a.localeCompare(b));
  const targets = stagePoints.map((p, i) => ({ p, i, w: slotWeights[i] ?? 1 }));
  targets.sort((a, b) => b.w - a.w || a.i - b.i);
  const usedTarget = new Set<number>();
  const usedId = new Set<string>();
  const positions: Record<string, Point> = {};

  const byPriority = [...ids].sort((a, b) => {
    const pa = current[a];
    const pb = current[b];
    if (!pa && !pb) return a.localeCompare(b);
    if (!pa) return 1;
    if (!pb) return -1;
    return a.localeCompare(b);
  });

  for (const id of byPriority) {
    const from = current[id];
    let best = -1;
    let bestD = Infinity;
    for (const t of targets) {
      if (usedTarget.has(t.i)) continue;
      const d = from ? dist2(from, t.p) : t.i;
      if (d < bestD) {
        bestD = d;
        best = t.i;
      }
    }
    if (best < 0) continue;
    usedTarget.add(best);
    usedId.add(id);
    positions[id] = stagePoints[best]!;
  }

  for (const id of ids) {
    if (usedId.has(id)) continue;
    for (let i = 0; i < stagePoints.length; i += 1) {
      if (usedTarget.has(i)) continue;
      usedTarget.add(i);
      positions[id] = stagePoints[i]!;
      break;
    }
  }
  return positions;
}

export function defaultDancerIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `d${i}`);
}
