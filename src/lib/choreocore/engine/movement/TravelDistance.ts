import type { Point } from "../types/FormationTypes";
import type { StageConfig } from "../types/CueTypes";
import { usableStage } from "../formation/FormationScaler";

export function calculateTravelDistance(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function normalizeDistance(distance: number, stage: StageConfig): number {
  const width = usableStage(stage).width;
  if (width <= 0) return 0;
  return distance / width;
}

export const straightPath = {
  sample(from: Point, to: Point, t: number): Point {
    const u = t < 0 ? 0 : t > 1 ? 1 : t;
    return {
      x: from.x + (to.x - from.x) * u,
      y: from.y + (to.y - from.y) * u,
    };
  },
};
