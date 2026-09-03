import {
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
} from "../dancerSpacing";
import type { ParsedPosition } from "../parsePositionTypes";

const LO = DANCER_STAGE_POSITION_PCT_LO;
const HI = DANCER_STAGE_POSITION_PCT_HI;

export function clampPreviewPct(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.min(HI, Math.max(LO, Math.round(n * 100) / 100));
}

function centroid(positions: ParsedPosition[]): { x: number; y: number } {
  if (positions.length === 0) return { x: 50, y: 50 };
  const x =
    positions.reduce((s, p) => s + p.x, 0) / positions.length;
  const y =
    positions.reduce((s, p) => s + p.y, 0) / positions.length;
  return { x, y };
}

export type PreviewScaleAxis = "xy" | "x" | "y";

/** 重心まわりに拡大縮小。`x` は横幅だけ、`y` は前後の幅だけ。 */
export function scalePreviewPositions(
  positions: ParsedPosition[],
  factor: number,
  axis: PreviewScaleAxis = "xy"
): ParsedPosition[] {
  if (positions.length === 0 || !Number.isFinite(factor) || factor <= 0) {
    return positions;
  }
  const c = centroid(positions);
  const scaleX = axis === "y" ? 1 : factor;
  const scaleY = axis === "x" ? 1 : factor;
  return positions.map((p) => ({
    ...p,
    x: clampPreviewPct(c.x + (p.x - c.x) * scaleX),
    y: clampPreviewPct(c.y + (p.y - c.y) * scaleY),
  }));
}

export function nudgePreviewPositions(
  positions: ParsedPosition[],
  dx: number,
  dy: number
): ParsedPosition[] {
  return positions.map((p) => ({
    ...p,
    x: clampPreviewPct(p.x + dx),
    y: clampPreviewPct(p.y + dy),
  }));
}

export function flipPreviewPositions(
  positions: ParsedPosition[],
  axis: "x" | "y"
): ParsedPosition[] {
  if (positions.length < 2) return positions;
  const c = centroid(positions);
  return positions.map((p) =>
    axis === "x"
      ? { ...p, x: clampPreviewPct(2 * c.x - p.x) }
      : { ...p, y: clampPreviewPct(2 * c.y - p.y) }
  );
}

function rowKey(p: ParsedPosition, fallback: number): number {
  return p.lineIndex ?? fallback;
}

export function alignPreviewRowY(
  positions: ParsedPosition[]
): ParsedPosition[] {
  const groups = new Map<number, number[]>();
  positions.forEach((p, i) => {
    const key = rowKey(p, -1);
    const arr = groups.get(key) ?? [];
    arr.push(i);
    groups.set(key, arr);
  });
  const next = positions.map((p) => ({ ...p }));
  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue;
    const y =
      idxs.reduce((s, i) => s + positions[i]!.y, 0) / idxs.length;
    for (const i of idxs) {
      next[i] = { ...next[i]!, y: clampPreviewPct(y) };
    }
  }
  return next;
}

/** 行内の左右端は固定し、間を等間隔にする */
export function distributePreviewRowX(
  positions: ParsedPosition[]
): ParsedPosition[] {
  const groups = new Map<number, number[]>();
  positions.forEach((p, i) => {
    const key = rowKey(p, -1);
    const arr = groups.get(key) ?? [];
    arr.push(i);
    groups.set(key, arr);
  });
  const next = positions.map((p) => ({ ...p }));
  for (const idxs of groups.values()) {
    if (idxs.length < 3) continue;
    const sorted = [...idxs].sort((a, b) => next[a]!.x - next[b]!.x);
    const lo = next[sorted[0]!]!.x;
    const hi = next[sorted[sorted.length - 1]!]!.x;
    if (Math.abs(hi - lo) < 1e-6) continue;
    sorted.forEach((i, k) => {
      const t = k / (sorted.length - 1);
      next[i] = { ...next[i]!, x: clampPreviewPct(lo + (hi - lo) * t) };
    });
  }
  return next;
}

export function movePreviewPerson(
  positions: ParsedPosition[],
  index: number,
  x: number,
  y: number
): ParsedPosition[] {
  if (index < 0 || index >= positions.length) return positions;
  return positions.map((p, i) =>
    i === index ? { ...p, x: clampPreviewPct(x), y: clampPreviewPct(y) } : p
  );
}

export function renamePreviewPerson(
  positions: ParsedPosition[],
  index: number,
  name: string
): ParsedPosition[] {
  if (index < 0 || index >= positions.length) return positions;
  return positions.map((p, i) => (i === index ? { ...p, name } : p));
}

/** 配置プリセットを当てつつ、すでに直した名前は同じ順で残す */
export function mergePreviewNames(
  named: ParsedPosition[],
  coords: ParsedPosition[]
): ParsedPosition[] {
  return coords.map((p, i) => ({
    ...p,
    name: named[i]?.name ?? p.name,
  }));
}
