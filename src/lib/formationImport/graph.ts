import { hypot, medianNearestNeighborDistance } from "./geometry";
import type { FormationRelationship } from "./types";

type Node = { id: string; x: number; y: number };

export function buildFormationGraph(nodes: Node[]): FormationRelationship[] {
  if (nodes.length < 2) return [];
  const nn = medianNearestNeighborDistance(nodes);
  const sameTol = nn * 0.35;
  const out: FormationRelationship[] = [];

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = hypot(a, b);
      const horizontalRelation =
        Math.abs(dx) <= sameTol ? "same" : dx > 0 ? "right" : "left";
      const verticalRelation =
        Math.abs(dy) <= sameTol ? "same" : dy > 0 ? "front" : "back";
      const near = distance <= nn * 1.85;
      out.push({
        dancerA: a.id,
        dancerB: b.id,
        horizontalRelation,
        verticalRelation,
        distance,
        confidence: near ? 0.9 : 0.55,
      });
    }
  }
  return out;
}
