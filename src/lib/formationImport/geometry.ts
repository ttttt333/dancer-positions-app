import type { ImageFrontDirection, PersonDetection } from "./types";

export type Point = { x: number; y: number };

export type BoundingBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function hypot(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

export function formationBoundingBox(points: Point[]): BoundingBox {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  return { minX, minY, maxX, maxY };
}

export function medianNearestNeighborDistance(points: Point[]): number {
  if (points.length < 2) return 1;
  const nearest: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    let best = Infinity;
    for (let j = 0; j < points.length; j += 1) {
      if (i === j) continue;
      best = Math.min(best, hypot(points[i]!, points[j]!));
    }
    if (Number.isFinite(best)) nearest.push(best);
  }
  return Math.max(median(nearest), 1e-6);
}

/**
 * 画像座標を「+x 客席から見て上手側、+y 客席方向」へ揃える。
 * デフォルト（bottom）は画像上＝舞台奥なのでそのまま。
 */
export function toCanonicalImagePoint(
  p: Point,
  direction: ImageFrontDirection,
  imageWidth: number,
  imageHeight: number
): Point {
  const w = imageWidth > 0 ? imageWidth : 1;
  const h = imageHeight > 0 ? imageHeight : 1;
  switch (direction) {
    case "bottom":
      return { x: p.x, y: p.y };
    case "top":
      return { x: w - p.x, y: h - p.y };
    case "right":
      return { x: p.y, y: w - p.x };
    case "left":
      return { x: h - p.y, y: p.x };
    default:
      return { x: p.x, y: p.y };
  }
}

export function detectionsToCanonical(
  detections: PersonDetection[],
  direction: ImageFrontDirection,
  imageWidth: number,
  imageHeight: number
): PersonDetection[] {
  return detections.map((d) => ({
    ...d,
    marker: toCanonicalImagePoint(d.marker, direction, imageWidth, imageHeight),
    label: d.label
      ? toCanonicalImagePoint(d.label, direction, imageWidth, imageHeight)
      : d.label,
  }));
}

export function normalizeInBox(p: Point, box: BoundingBox): Point {
  const w = box.maxX - box.minX || 1;
  const h = box.maxY - box.minY || 1;
  return {
    x: (p.x - box.minX) / w,
    y: (p.y - box.minY) / h,
  };
}
