/**
 * 幾何ユーティリティ（線分交差・距離）
 */

import type { Position } from "./types";

export function euclideanDistance(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function orient(a: Position, b: Position, c: Position): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Position, b: Position, c: Position): boolean {
  return (
    Math.min(a.x, b.x) <= c.x + 1e-9 &&
    c.x <= Math.max(a.x, b.x) + 1e-9 &&
    Math.min(a.y, b.y) <= c.y + 1e-9 &&
    c.y <= Math.max(a.y, b.y) + 1e-9
  );
}

/**
 * 線分 ab と cd が（端点共有を除き）交差するか。
 */
export function segmentsIntersect(
  a: Position,
  b: Position,
  c: Position,
  d: Position
): boolean {
  // 同一端点は交差とみなさない（スロット共有の誤検知防止）
  const sameEndpoint =
    (Math.abs(a.x - c.x) < 1e-9 && Math.abs(a.y - c.y) < 1e-9) ||
    (Math.abs(a.x - d.x) < 1e-9 && Math.abs(a.y - d.y) < 1e-9) ||
    (Math.abs(b.x - c.x) < 1e-9 && Math.abs(b.y - c.y) < 1e-9) ||
    (Math.abs(b.x - d.x) < 1e-9 && Math.abs(b.y - d.y) < 1e-9);
  if (sameEndpoint) return false;

  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);

  if (o1 * o2 < 0 && o3 * o4 < 0) return true;

  if (Math.abs(o1) < 1e-9 && onSegment(a, b, c)) return true;
  if (Math.abs(o2) < 1e-9 && onSegment(a, b, d)) return true;
  if (Math.abs(o3) < 1e-9 && onSegment(c, d, a)) return true;
  if (Math.abs(o4) < 1e-9 && onSegment(c, d, b)) return true;
  return false;
}
