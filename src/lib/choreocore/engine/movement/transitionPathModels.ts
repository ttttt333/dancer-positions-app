import type { StageConfig } from "../types/CueTypes";
import type { Point } from "../types/FormationTypes";
import { usableStage } from "../formation/FormationScaler";
import { calculateTravelDistance, straightPath } from "./TravelDistance";
import { clamp, finite } from "../scoring/scoreMath";
import {
  TRANSITION_PATH_GEOMETRY,
  TRANSITION_SAMPLE,
} from "./transitionIntelligenceConfig";
import type { TransitionPathKind } from "./transitionIntelligenceTypes";

export type PathSampleOptions = {
  kind: TransitionPathKind;
  sign: 1 | -1;
  offsetScale: number;
};

function lerp(a: Point, b: Point, t: number): Point {
  const u = clamp(t, 0, 1);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

function quad(a: Point, c: Point, b: Point, t: number): Point {
  const u = clamp(t, 0, 1);
  const s = 1 - u;
  return {
    x: s * s * a.x + 2 * s * u * c.x + u * u * b.x,
    y: s * s * a.y + 2 * s * u * c.y + u * u * b.y,
  };
}

function cubic(a: Point, c1: Point, c2: Point, b: Point, t: number): Point {
  const u = clamp(t, 0, 1);
  const s = 1 - u;
  return {
    x: s * s * s * a.x + 3 * s * s * u * c1.x + 3 * s * u * u * c2.x + u * u * u * b.x,
    y: s * s * s * a.y + 3 * s * s * u * c1.y + 3 * s * u * u * c2.y + u * u * u * b.y,
  };
}

function chordInfo(from: Point, to: Point): {
  mid: Point;
  len: number;
  nx: number;
  ny: number;
} {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    return { mid: { ...from }, len: 0, nx: 0, ny: 1 };
  }
  return {
    mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
    len,
    nx: -dy / len,
    ny: dx / len,
  };
}

function offsetPoint(
  from: Point,
  to: Point,
  stage: StageConfig,
  ratio: number,
  maxRatio: number,
  sign: 1 | -1,
  scale: number
): Point {
  const { mid, len, nx, ny } = chordInfo(from, to);
  const area = usableStage(stage);
  const cap = Math.min(area.width, area.depth) * maxRatio;
  const mag = clamp(len * ratio * scale, 0, cap) * sign;
  return { x: mid.x + nx * mag, y: mid.y + ny * mag };
}

export function sampleTransitionPath(
  from: Point,
  to: Point,
  t: number,
  stage: StageConfig,
  options: PathSampleOptions
): Point {
  if (options.kind === "STRAIGHT" || calculateTravelDistance(from, to) < TRANSITION_PATH_GEOMETRY.minChordForCurve) {
    return straightPath.sample(from, to, t);
  }
  if (options.kind === "ARC") {
    const ctrl = offsetPoint(
      from,
      to,
      stage,
      TRANSITION_PATH_GEOMETRY.arcOffsetRatio,
      TRANSITION_PATH_GEOMETRY.arcOffsetMaxRatio,
      options.sign,
      options.offsetScale
    );
    return quad(from, ctrl, to, t);
  }
  if (options.kind === "CURVE") {
    const { len, nx, ny } = chordInfo(from, to);
    const area = usableStage(stage);
    const mag =
      clamp(
        len * TRANSITION_PATH_GEOMETRY.curveOffsetRatio * options.offsetScale,
        0,
        Math.min(area.width, area.depth) * TRANSITION_PATH_GEOMETRY.arcOffsetMaxRatio
      ) * options.sign;
    const p1 = lerp(from, to, 0.33);
    const p2 = lerp(from, to, 0.67);
    return cubic(
      from,
      { x: p1.x + nx * mag, y: p1.y + ny * mag },
      { x: p2.x - nx * mag * 0.45, y: p2.y - ny * mag * 0.45 },
      to,
      t
    );
  }
  const ctrl = offsetPoint(
    from,
    to,
    stage,
    TRANSITION_PATH_GEOMETRY.safeOffsetRatio,
    TRANSITION_PATH_GEOMETRY.safeOffsetMaxRatio,
    options.sign,
    options.offsetScale
  );
  return quad(from, ctrl, to, t);
}

export function samplePathPolyline(
  from: Point,
  to: Point,
  stage: StageConfig,
  options: PathSampleOptions,
  count?: number
): Point[] {
  const n = Math.max(4, count ?? TRANSITION_SAMPLE.pathLength);
  const pts: Point[] = [];
  for (let i = 0; i <= n; i += 1) {
    pts.push(sampleTransitionPath(from, to, i / n, stage, options));
  }
  return pts;
}

export function polylineLength(points: Point[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i += 1) {
    sum += calculateTravelDistance(points[i - 1]!, points[i]!);
  }
  return finite(sum);
}

export function headingTurnMetrics(points: Point[]): { turnRadians: number; turnCount: number } {
  let turn = 0;
  let count = 0;
  let prev: number | null = null;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.hypot(dx, dy) < 1e-6) continue;
    const h = Math.atan2(dy, dx);
    if (prev !== null) {
      let d = h - prev;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const abs = Math.abs(d);
      turn += abs;
      if (abs > 0.35) count += 1;
    }
    prev = h;
  }
  return { turnRadians: finite(turn), turnCount: count };
}

export function pathLeavesStageAlong(
  points: Point[],
  stage: StageConfig
): { outside: boolean; marginBreach: boolean } {
  const area = usableStage(stage);
  let outside = false;
  let marginBreach = false;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      return { outside: true, marginBreach: true };
    }
    if (p.x < 0 || p.x > stage.width || p.y < 0 || p.y > stage.depth) outside = true;
    if (p.x < area.minX || p.x > area.maxX || p.y < area.minY || p.y > area.maxY) {
      marginBreach = true;
    }
  }
  return { outside, marginBreach };
}

export function defaultPathOptions(kind: TransitionPathKind, sign: 1 | -1 = 1): PathSampleOptions {
  return { kind, sign, offsetScale: 1 };
}
