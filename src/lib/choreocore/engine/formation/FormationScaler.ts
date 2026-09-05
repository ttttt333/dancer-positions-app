import type { FormationChangeMagnitude, FormationCueAction, StageConfig } from "../types/CueTypes";
import type { FormationSlot, Point } from "../types/FormationTypes";
import { FormationGenerationError } from "../types/FormationTypes";

export function usableStage(stage: StageConfig): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  depth: number;
  cx: number;
  cy: number;
} {
  const minX = stage.safeMargin;
  const maxX = stage.width - stage.safeMargin;
  const minY = stage.safeMargin;
  const maxY = stage.depth - stage.safeMargin;
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    depth: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

export function validateStageConfig(stage: StageConfig): void {
  if (!Number.isFinite(stage.width) || !Number.isFinite(stage.depth)) {
    throw new FormationGenerationError("INVALID_STAGE", "Stage size must be finite");
  }
  if (stage.width <= 0 || stage.depth <= 0) {
    throw new FormationGenerationError("INVALID_STAGE", "Stage width and depth must be positive");
  }
  if (stage.safeMargin < 0) {
    throw new FormationGenerationError("INVALID_STAGE", "safeMargin must be >= 0");
  }
  if (stage.safeMargin * 2 >= stage.width || stage.safeMargin * 2 >= stage.depth) {
    throw new FormationGenerationError(
      "INVALID_STAGE",
      "safeMargin leaves no usable stage area"
    );
  }
}

export function spreadForCue(
  action: FormationCueAction,
  magnitude: FormationChangeMagnitude
): number {
  const expand: Record<FormationChangeMagnitude, number> = {
    NONE: 0.4,
    SMALL: 0.52,
    MEDIUM: 0.72,
    LARGE: 0.9,
    MAX: 1,
  };
  const contract: Record<FormationChangeMagnitude, number> = {
    NONE: 0.52,
    SMALL: 0.44,
    MEDIUM: 0.38,
    LARGE: 0.34,
    /** 0.22 は密集しすぎるため下限を引き上げ（最終は scale 側でも 0.8m クランプ） */
    MAX: 0.3,
  };
  if (action === "CONTRACT" || action === "CLUSTER") return contract[magnitude];
  if (action === "HOLD" || action === "MICRO_SHIFT") {
    return magnitude === "NONE" ? 0.42 : Math.min(0.58, expand[magnitude]);
  }
  return expand[magnitude];
}

export function unitToStage(slot: FormationSlot, stage: StageConfig): Point {
  const area = usableStage(stage);
  const x = area.cx + slot.x * (area.width / 2);
  const y = area.cy + slot.y * (area.depth / 2);
  return {
    x: Math.min(area.maxX, Math.max(area.minX, x)),
    y: Math.min(area.maxY, Math.max(area.minY, y)),
  };
}

export function stageToUnit(point: Point, stage: StageConfig): Point {
  const area = usableStage(stage);
  const x = area.width === 0 ? 0 : (point.x - area.cx) / (area.width / 2);
  const y = area.depth === 0 ? 0 : (point.y - area.cy) / (area.depth / 2);
  return { x, y };
}

export function slotsToStage(
  slots: FormationSlot[],
  stage: StageConfig
): Point[] {
  return slots.map((s) => unitToStage(s, stage));
}

export function stageCoverage(
  points: Point[] | Record<string, Point>,
  stage: StageConfig
): number {
  const list = Array.isArray(points) ? points : Object.values(points);
  if (list.length === 0) return 0;
  const area = usableStage(stage);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of list) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const widthCov = area.width <= 0 ? 0 : (maxX - minX) / area.width;
  const depthCov = area.depth <= 0 ? 0 : (maxY - minY) / area.depth;
  return Math.max(0, Math.min(100, ((widthCov + depthCov) / 2) * 100));
}
