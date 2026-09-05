import type { ChoreographicIntentType } from "../intent/ChoreographicIntentTypes";
import type { StageConfig } from "../types/CueTypes";
import type { Formation, Point } from "../types/FormationTypes";
import { FORMATION_FAMILY } from "../types/ScoringTypes";
import { clamp, finite } from "../scoring/scoreMath";
import { stageCoverage, usableStage } from "./FormationScaler";
import {
  CONTEXT_CONTRAST,
  EDGE_BAND_RATIO,
  TARGET_COVERAGE_DELTA_AT_FULL,
  TARGET_SHAPE_CONTRAST_AT_FULL,
} from "./intentFormationConfig";
import type { FormationShapeMetrics } from "./intentFormationTypes";

export function centroidOf(positions: Record<string, Point>): Point {
  const pts = Object.values(positions);
  if (pts.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

export function measureFormationShape(
  formation: Formation,
  stage: StageConfig
): FormationShapeMetrics {
  const area = usableStage(stage);
  const coverage = finite(formation.stageCoverage, stageCoverage(formation.positions, stage));
  const c = centroidOf(formation.positions);
  const shiftX = area.width <= 0 ? 0 : (c.x - area.cx) / area.width;
  const shiftY = area.depth <= 0 ? 0 : (c.y - area.cy) / area.depth;
  const maxR = Math.hypot(area.width, area.depth) / 2;
  const dist = Math.hypot(c.x - area.cx, c.y - area.cy);
  const pts = Object.values(formation.positions);
  const band = EDGE_BAND_RATIO * Math.min(area.width, area.depth);
  let nearEdge = 0;
  for (const p of pts) {
    const dx = Math.min(p.x - area.minX, area.maxX - p.x);
    const dy = Math.min(p.y - area.minY, area.maxY - p.y);
    if (Math.min(dx, dy) <= band) nearEdge += 1;
  }
  const xs = pts.map((p) => p.x).sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 1; i < xs.length; i += 1) {
    maxGap = Math.max(maxGap, xs[i]! - xs[i - 1]!);
  }
  return {
    type: formation.type,
    family: FORMATION_FAMILY[formation.type],
    stageCoverage: clamp(coverage, 0, 100),
    compactness: clamp(100 - coverage, 0, 100),
    symmetry: clamp(finite(formation.symmetry), 0, 100),
    complexity: clamp(finite(formation.complexity), 0, 100),
    centerShift: clamp(Math.hypot(shiftX, shiftY) * 100, 0, 100),
    centerStrength: clamp(100 - (dist / Math.max(1, maxR)) * 100, 0, 100),
    edgeUtilization: pts.length === 0 ? 0 : (nearEdge / pts.length) * 100,
    groupSeparation:
      area.width <= 0 ? 0 : clamp((maxGap / area.width) * 100, 0, 100),
    centroid: c,
  };
}

export function shapeContrastScore(
  current: FormationShapeMetrics,
  candidate: FormationShapeMetrics
): number {
  const familyDiff = current.family === candidate.family ? 18 : 70;
  const typeDiff = current.type === candidate.type ? 8 : 40;
  const coverageDiff = Math.abs(candidate.stageCoverage - current.stageCoverage);
  const densityDiff = Math.abs(candidate.compactness - current.compactness);
  const symmetryDiff = Math.abs(candidate.symmetry - current.symmetry);
  return clamp(
    familyDiff * 0.35 +
      typeDiff * 0.15 +
      coverageDiff * 0.25 +
      densityDiff * 0.15 +
      symmetryDiff * 0.1,
    0,
    100
  );
}

export function signedCoverageChange(
  current: FormationShapeMetrics,
  candidate: FormationShapeMetrics
): number {
  return candidate.stageCoverage - current.stageCoverage;
}

export function targetCoverageDelta(
  intent: ChoreographicIntentType,
  intensity: number
): number {
  const full = TARGET_COVERAGE_DELTA_AT_FULL[intent];
  return full * clamp(intensity, 0, 1);
}

export function targetShapeContrast(
  intent: ChoreographicIntentType,
  intensity: number
): number {
  const full = TARGET_SHAPE_CONTRAST_AT_FULL[intent];
  return full * clamp(intensity, 0, 1);
}

export function intentContextAdjustment(
  previousIntent: ChoreographicIntentType | null | undefined,
  currentIntent: ChoreographicIntentType,
  nextIntent: ChoreographicIntentType | null | undefined,
  shapeContrast: number
): number {
  let adj = 0;
  const opposite = (a: ChoreographicIntentType, b: ChoreographicIntentType) =>
    (a === "CONTRACT" && b === "EXPAND") ||
    (a === "EXPAND" && b === "CONTRACT") ||
    (a === "HIDE" && b === "REVEAL") ||
    (a === "REVEAL" && b === "HIDE") ||
    (a === "SPLIT" && b === "MERGE") ||
    (a === "MERGE" && b === "SPLIT") ||
    (a === "HOLD" && b === "HIT") ||
    (a === "HOLD" && b === "MAJOR_CHANGE");

  if (previousIntent && opposite(previousIntent, currentIntent)) {
    adj += (shapeContrast / 100) * CONTEXT_CONTRAST.oppositePairBonus;
  }
  if (previousIntent === currentIntent && currentIntent === "EXPAND") {
    adj -= CONTEXT_CONTRAST.repeatIntentDampening * (shapeContrast / 100);
  }
  if (nextIntent === currentIntent && currentIntent === "EXPAND") {
    adj -= CONTEXT_CONTRAST.repeatIntentDampening * 0.5;
  }
  return adj;
}

export function fitToTarget(actual: number, target: number, scale: number): number {
  return clamp(100 - Math.abs(actual - target) * scale, 0, 100);
}
