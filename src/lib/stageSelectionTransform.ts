import type { DancerSpot } from "../types/choreography";
import {
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
} from "./dancerSpacing";
import { swapSelectionKamiteShimote } from "./stageColumnSwap";

export type SelectionAlignEdge =
  | "left"
  | "centerX"
  | "right"
  | "top"
  | "centerY"
  | "bottom";

export type SelectionDistributeAxis = "x" | "y";
export type SelectionFlipAxis = "x" | "y";

type SelectionBox = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cx: number;
  cy: number;
};

function clampStagePct(v: number): number {
  return Math.max(
    DANCER_STAGE_POSITION_PCT_LO,
    Math.min(DANCER_STAGE_POSITION_PCT_HI, v)
  );
}

function bboxOf(spots: readonly DancerSpot[]): SelectionBox | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const d of spots) {
    minX = Math.min(minX, d.xPct);
    maxX = Math.max(maxX, d.xPct);
    minY = Math.min(minY, d.yPct);
    maxY = Math.max(maxY, d.yPct);
  }
  if (!Number.isFinite(minX)) return null;
  return {
    minX,
    maxX,
    minY,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

function selectedSubset(
  dancers: readonly DancerSpot[],
  targetIds: readonly string[]
): { idSet: Set<string>; subset: DancerSpot[] } {
  const idSet = new Set(targetIds);
  return {
    idSet,
    subset: dancers.filter((d) => idSet.has(d.id)),
  };
}

/**
 * 選択範囲の bbox に揃える。他軸の座標は維持する。
 * 左/右/中央は xPct、上/下/中央は yPct（上 = y が小さい奥側）。
 */
export function alignSelectedDancers(
  dancers: DancerSpot[],
  targetIds: readonly string[],
  edge: SelectionAlignEdge
): DancerSpot[] {
  const { idSet, subset } = selectedSubset(dancers, targetIds);
  if (subset.length < 2) return dancers;
  const box = bboxOf(subset);
  if (!box) return dancers;

  let nextX: number | null = null;
  let nextY: number | null = null;
  if (edge === "left") nextX = box.minX;
  else if (edge === "centerX") nextX = box.cx;
  else if (edge === "right") nextX = box.maxX;
  else if (edge === "top") nextY = box.minY;
  else if (edge === "centerY") nextY = box.cy;
  else nextY = box.maxY;

  return dancers.map((d) => {
    if (!idSet.has(d.id)) return d;
    return {
      ...d,
      xPct: nextX == null ? d.xPct : clampStagePct(nextX),
      yPct: nextY == null ? d.yPct : clampStagePct(nextY),
    };
  });
}

/**
 * 端の2人は固定し、中間だけ等間隔にする。他軸は維持。
 */
export function distributeSelectedDancers(
  dancers: DancerSpot[],
  targetIds: readonly string[],
  axis: SelectionDistributeAxis
): DancerSpot[] {
  const { subset } = selectedSubset(dancers, targetIds);
  if (subset.length < 3) return dancers;

  const sorted = [...subset].sort((a, b) => {
    const da = axis === "x" ? a.xPct - b.xPct : a.yPct - b.yPct;
    if (Math.abs(da) > 1e-9) return da;
    const db = axis === "x" ? a.yPct - b.yPct : a.xPct - b.xPct;
    if (Math.abs(db) > 1e-9) return db;
    return a.id.localeCompare(b.id);
  });

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const lo = axis === "x" ? first.xPct : first.yPct;
  const hi = axis === "x" ? last.xPct : last.yPct;
  if (Math.abs(hi - lo) < 1e-9) return dancers;

  const n = sorted.length;
  const nextPos = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    nextPos.set(sorted[i]!.id, clampStagePct(lo + (hi - lo) * t));
  }

  return dancers.map((d) => {
    const v = nextPos.get(d.id);
    if (v == null) return d;
    return axis === "x" ? { ...d, xPct: v } : { ...d, yPct: v };
  });
}

/**
 * 選択範囲の中心を軸に反転。
 * 左右は既存の上手⇄下手（`swapSelectionKamiteShimote`）と同じ計算。
 */
export function flipSelectedDancers(
  dancers: DancerSpot[],
  targetIds: readonly string[],
  axis: SelectionFlipAxis
): DancerSpot[] {
  if (axis === "x") {
    return swapSelectionKamiteShimote(dancers, [...targetIds]);
  }

  const { idSet, subset } = selectedSubset(dancers, targetIds);
  if (subset.length < 2) return dancers;
  const box = bboxOf(subset);
  if (!box) return dancers;

  return dancers.map((d) => {
    if (!idSet.has(d.id)) return d;
    return { ...d, yPct: clampStagePct(2 * box.cy - d.yPct) };
  });
}
