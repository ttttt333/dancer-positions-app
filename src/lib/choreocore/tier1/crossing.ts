/**
 * 動線交差検出（説明可能性のための PathCrossing[]）
 */

import { segmentsIntersect } from "./geometry";
import type { Formation, PathCrossing, Position } from "./types";

export function detectPathCrossings(
  prev: Formation,
  assignment: Map<string, Position>
): PathCrossing[] {
  const paths = prev.performers
    .map((p) => {
      const to = assignment.get(p.id);
      if (!to) return null;
      return { id: p.id, from: p.position, to };
    })
    .filter((p): p is { id: string; from: Position; to: Position } => p != null)
    .sort((a, b) => a.id.localeCompare(b.id));

  const crossings: PathCrossing[] = [];

  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      const A = paths[i]!;
      const B = paths[j]!;
      if (segmentsIntersect(A.from, A.to, B.from, B.to)) {
        crossings.push({
          performerAId: A.id,
          performerBId: B.id,
          approximateCoordinate: {
            x: (A.from.x + A.to.x + B.from.x + B.to.x) / 4,
            y: (A.from.y + A.to.y + B.from.y + B.to.y) / 4,
          },
        });
      }
    }
  }

  return crossings;
}
