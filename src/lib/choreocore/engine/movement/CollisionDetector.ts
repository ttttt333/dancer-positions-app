import type { StageConfig } from "../types/CueTypes";
import type { Point } from "../types/FormationTypes";
import type { CollisionPair, CollisionResult } from "../types/MovementTypes";
import { usableStage } from "../formation/FormationScaler";
import { straightPath } from "./TravelDistance";

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function detectFormationCollisions(
  positions: Record<string, Point>,
  minDistance: number
): CollisionResult {
  const ids = Object.keys(positions).sort((a, b) => a.localeCompare(b));
  const pairs: CollisionPair[] = [];
  if (ids.length >= 21) {
    return detectStaticHashed(positions, ids, minDistance);
  }
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = positions[ids[i]!]!;
      const b = positions[ids[j]!]!;
      const d = dist(a, b);
      if (d < minDistance - 1e-6) {
        pairs.push({ dancerA: ids[i]!, dancerB: ids[j]!, minDistance: d });
      }
    }
  }
  return pack(pairs, minDistance);
}

function detectStaticHashed(
  positions: Record<string, Point>,
  ids: string[],
  minDistance: number
): CollisionResult {
  const cell = Math.max(minDistance, 1);
  const grid = new Map<string, string[]>();
  const key = (x: number, y: number) => `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
  for (const id of ids) {
    const p = positions[id]!;
    const k = key(p.x, p.y);
    const bucket = grid.get(k);
    if (bucket) bucket.push(id);
    else grid.set(k, [id]);
  }
  const pairs: CollisionPair[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const p = positions[id]!;
    const cx = Math.floor(p.x / cell);
    const cy = Math.floor(p.y / cell);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const bucket = grid.get(`${cx + dx}:${cy + dy}`);
        if (!bucket) continue;
        for (const other of bucket) {
          if (other <= id) continue;
          const token = `${id}|${other}`;
          if (seen.has(token)) continue;
          seen.add(token);
          const d = dist(p, positions[other]!);
          if (d < minDistance - 1e-6) {
            pairs.push({ dancerA: id, dancerB: other, minDistance: d });
          }
        }
      }
    }
  }
  return pack(pairs, minDistance);
}

function pack(pairs: CollisionPair[], minDistance: number): CollisionResult {
  const worst =
    pairs.length === 0
      ? minDistance
      : Math.min(...pairs.map((p) => p.minDistance));
  const risk =
    pairs.length === 0
      ? 0
      : Math.max(0, Math.min(100, (1 - worst / Math.max(minDistance, 1e-6)) * 100));
  return { hasCollision: pairs.length > 0, collisionPairs: pairs, risk };
}

function aabbOverlap(
  a0: Point,
  a1: Point,
  b0: Point,
  b1: Point,
  pad: number
): boolean {
  const aMinX = Math.min(a0.x, a1.x) - pad;
  const aMaxX = Math.max(a0.x, a1.x) + pad;
  const aMinY = Math.min(a0.y, a1.y) - pad;
  const aMaxY = Math.max(a0.y, a1.y) + pad;
  const bMinX = Math.min(b0.x, b1.x) - pad;
  const bMaxX = Math.max(b0.x, b1.x) + pad;
  const bMinY = Math.min(b0.y, b1.y) - pad;
  const bMaxY = Math.max(b0.y, b1.y) + pad;
  return aMinX <= bMaxX && aMaxX >= bMinX && aMinY <= bMaxY && aMaxY >= bMinY;
}

function orient(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSeg(a: Point, b: Point, c: Point): boolean {
  return (
    Math.min(a.x, b.x) - 1e-6 <= c.x &&
    c.x <= Math.max(a.x, b.x) + 1e-6 &&
    Math.min(a.y, b.y) - 1e-6 <= c.y &&
    c.y <= Math.max(a.y, b.y) + 1e-6
  );
}

export function segmentsIntersect(
  a0: Point,
  a1: Point,
  b0: Point,
  b1: Point
): { t: number; u: number } | null {
  const o1 = orient(a0, a1, b0);
  const o2 = orient(a0, a1, b1);
  const o3 = orient(b0, b1, a0);
  const o4 = orient(b0, b1, a1);
  const dxA = a1.x - a0.x;
  const dyA = a1.y - a0.y;
  const dxB = b1.x - b0.x;
  const dyB = b1.y - b0.y;
  const den = dxA * dyB - dyA * dxB;
  if (Math.abs(den) < 1e-9) {
    if (Math.abs(o1) < 1e-6 && onSeg(a0, a1, b0)) return { t: 0.5, u: 0.5 };
    return null;
  }
  if ((o1 > 0 && o2 > 0) || (o1 < 0 && o2 < 0) || (o3 > 0 && o4 > 0) || (o3 < 0 && o4 < 0)) {
    return null;
  }
  const t = ((b0.x - a0.x) * dyB - (b0.y - a0.y) * dxB) / den;
  const u = ((b0.x - a0.x) * dyA - (b0.y - a0.y) * dxA) / den;
  if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;
  return { t: Math.max(0, Math.min(1, t)), u: Math.max(0, Math.min(1, u)) };
}

export function detectMovementCollisions(
  from: Record<string, Point>,
  to: Record<string, Point>,
  minDistance: number,
  sampleCount: number
): CollisionResult & { sameTimeCrossing: boolean; pathCrossing: boolean } {
  const ids = Object.keys(to).sort((a, b) => a.localeCompare(b));
  const pairs: CollisionPair[] = [];
  let pathCrossing = false;
  let sameTimeCrossing = false;
  const n = Math.max(8, sampleCount);

  for (let i = 0; i < ids.length; i += 1) {
    const idA = ids[i]!;
    const a0 = from[idA] ?? to[idA]!;
    const a1 = to[idA]!;
    for (let j = i + 1; j < ids.length; j += 1) {
      const idB = ids[j]!;
      const b0 = from[idB] ?? to[idB]!;
      const b1 = to[idB]!;
      if (!aabbOverlap(a0, a1, b0, b1, minDistance)) continue;

      const hit = segmentsIntersect(a0, a1, b0, b1);
      if (hit) {
        pathCrossing = true;
        const dt = Math.abs(hit.t - hit.u);
        if (dt < 0.18) {
          sameTimeCrossing = true;
          pairs.push({
            dancerA: idA,
            dancerB: idB,
            minDistance: 0,
            collisionTime: (hit.t + hit.u) / 2,
          });
        } else {
          pairs.push({
            dancerA: idA,
            dancerB: idB,
            minDistance: minDistance * 0.8,
            collisionTime: hit.t,
          });
        }
      }

      let minD = Infinity;
      let minT = 0;
      for (let s = 0; s <= n; s += 1) {
        const t = s / n;
        const pa = straightPath.sample(a0, a1, t);
        const pb = straightPath.sample(b0, b1, t);
        const d = dist(pa, pb);
        if (d < minD) {
          minD = d;
          minT = t;
        }
      }
      if (minD < minDistance * 0.55) {
        pairs.push({
          dancerA: idA,
          dancerB: idB,
          minDistance: minD,
          collisionTime: minT,
        });
        if (minD < minDistance * 0.35) sameTimeCrossing = true;
      }
    }
  }

  const unique: CollisionPair[] = [];
  const seen = new Set<string>();
  for (const p of pairs) {
    const k = `${p.dancerA}|${p.dancerB}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(p);
  }
  const packed = pack(unique, minDistance);
  const extra = (pathCrossing ? 12 : 0) + (sameTimeCrossing ? 28 : 0);
  return {
    ...packed,
    risk: Math.min(100, packed.risk + extra),
    sameTimeCrossing,
    pathCrossing,
  };
}

export function pathLeavesStage(
  from: Point,
  to: Point,
  stage: StageConfig,
  samples: number
): { outside: boolean; marginBreach: boolean } {
  const area = usableStage(stage);
  let outside = false;
  let marginBreach = false;
  const n = Math.max(4, samples);
  for (let s = 0; s <= n; s += 1) {
    const p = straightPath.sample(from, to, s / n);
    if (p.x < 0 || p.x > stage.width || p.y < 0 || p.y > stage.depth) outside = true;
    if (p.x < area.minX || p.x > area.maxX || p.y < area.minY || p.y > area.maxY) {
      marginBreach = true;
    }
  }
  return { outside, marginBreach };
}

export function convergenceRisk(
  from: Record<string, Point>,
  to: Record<string, Point>,
  stage: StageConfig
): number {
  const ids = Object.keys(to);
  if (ids.length < 3) return 0;
  const cx = stage.width / 2;
  const cy = stage.depth / 2;
  let approaching = 0;
  for (const id of ids) {
    const a = from[id] ?? to[id]!;
    const b = to[id]!;
    const before = Math.hypot(a.x - cx, a.y - cy);
    const after = Math.hypot(b.x - cx, b.y - cy);
    if (after + 8 < before) approaching += 1;
  }
  const ratio = approaching / ids.length;
  if (ratio < 0.45) return Math.round(ratio * 20);
  return Math.round(35 + ratio * 50);
}
