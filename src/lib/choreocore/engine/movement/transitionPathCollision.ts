import type { Point } from "../types/FormationTypes";
import { segmentsIntersect } from "./CollisionDetector";
import { clamp, finite } from "../scoring/scoreMath";
import { TRANSITION_HARD, TRANSITION_SAMPLE } from "./transitionIntelligenceConfig";
import type { DancerTransitionPath } from "./transitionIntelligenceTypes";

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function bounds(points: Point[], pad: number): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return {
    minX: minX - pad,
    maxX: maxX + pad,
    minY: minY - pad,
    maxY: maxY + pad,
  };
}

function overlap(
  a: ReturnType<typeof bounds>,
  b: ReturnType<typeof bounds>
): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

export type TemporalPathCollision = {
  collisionRisk: number;
  crossingRisk: number;
  hardCollision: boolean;
  pathCrossing: boolean;
  sameTimeCrossing: boolean;
  closestApproach: number;
  closestApproachTime: number;
};

/**
 * 時間軸上の衝突。start/end の静的判定ではなく A(t) vs B(t)。
 * 粗い AABB → 近いペアだけ細かくサンプリング。
 */
export function detectTemporalPathCollisions(
  paths: DancerTransitionPath[],
  minDistance: number
): TemporalPathCollision {
  const sorted = [...paths].sort((a, b) => a.dancerId.localeCompare(b.dancerId));
  let closest = Infinity;
  let closestT = 0;
  let pathCrossing = false;
  let sameTimeCrossing = false;
  let hard = false;
  const coarse = TRANSITION_SAMPLE.coarse;
  const fine = TRANSITION_SAMPLE.fine;

  for (let i = 0; i < sorted.length; i += 1) {
    const a = sorted[i]!;
    const ab = bounds(a.samples, minDistance);
    for (let j = i + 1; j < sorted.length; j += 1) {
      const b = sorted[j]!;
      if (!overlap(ab, bounds(b.samples, minDistance))) continue;

      let pairMin = Infinity;
      let pairT = 0;
      for (let s = 0; s <= coarse; s += 1) {
        const t = s / coarse;
        const ia = Math.round(t * (a.samples.length - 1));
        const ib = Math.round(t * (b.samples.length - 1));
        const d = dist(a.samples[ia]!, b.samples[ib]!);
        if (d < pairMin) {
          pairMin = d;
          pairT = t;
        }
      }
      if (pairMin < minDistance * 1.4) {
        const lo = Math.max(0, pairT - 0.2);
        const hi = Math.min(1, pairT + 0.2);
        for (let s = 0; s <= fine; s += 1) {
          const t = lo + ((hi - lo) * s) / fine;
          const ia = Math.round(t * (a.samples.length - 1));
          const ib = Math.round(t * (b.samples.length - 1));
          const d = dist(a.samples[ia]!, b.samples[ib]!);
          if (d < pairMin) {
            pairMin = d;
            pairT = t;
          }
        }
      }
      if (pairMin < closest) {
        closest = pairMin;
        closestT = pairT;
      }
      if (pairMin < minDistance * TRANSITION_HARD.hardCollisionFraction) {
        hard = true;
      }

      const n = Math.min(a.samples.length, b.samples.length);
      for (let k = 1; k < n; k += 1) {
        const hit = segmentsIntersect(
          a.samples[k - 1]!,
          a.samples[k]!,
          b.samples[k - 1]!,
          b.samples[k]!
        );
        if (!hit) continue;
        pathCrossing = true;
        if (Math.abs(hit.t - hit.u) < TRANSITION_HARD.sameTimeCrossingWindow) {
          sameTimeCrossing = true;
        }
      }
    }
  }

  if (!Number.isFinite(closest)) closest = minDistance;
  const proximity =
    closest >= minDistance
      ? 0
      : clamp((1 - closest / Math.max(minDistance, 1e-6)) * 100, 0, 100);
  const crossingRisk = clamp(
    (pathCrossing ? 28 : 0) + (sameTimeCrossing ? 36 : 0),
    0,
    100
  );
  return {
    collisionRisk: clamp(proximity + (sameTimeCrossing ? 18 : 0), 0, 100),
    crossingRisk,
    hardCollision: hard,
    pathCrossing,
    sameTimeCrossing,
    closestApproach: finite(closest, minDistance),
    closestApproachTime: finite(closestT),
  };
}
