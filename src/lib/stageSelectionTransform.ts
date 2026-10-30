import type { DancerSpot } from "../types/choreography";
import {
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
  FORMATION_REFERENCE_STEP_PCT,
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
/** row = 横一列（Y を揃える）。col = 縦一列（X を揃える）。 */
export type SelectionLineAxis = "row" | "col";

/** これ未満の幅は「重なっている」とみなし、均等時だけ基準間隔で開く */
const COLLAPSED_LINE_SPAN = 1e-4;

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

function compareAlongLine(
  a: DancerSpot,
  b: DancerSpot,
  axis: SelectionLineAxis
): number {
  const primary = axis === "row" ? a.xPct - b.xPct : a.yPct - b.yPct;
  if (Math.abs(primary) > 1e-9) return primary;
  const secondary = axis === "row" ? a.yPct - b.yPct : a.xPct - b.xPct;
  if (Math.abs(secondary) > 1e-9) return secondary;
  return a.id.localeCompare(b.id);
}

/** 重なりを基準間隔で開いたとき、ステージ外にはみ出さない幅 */
function expandedLineSpan(center: number, count: number): { lo: number; hi: number } {
  if (count < 2) return { lo: center, hi: center };
  const maxSpan = DANCER_STAGE_POSITION_PCT_HI - DANCER_STAGE_POSITION_PCT_LO;
  const span = Math.min(FORMATION_REFERENCE_STEP_PCT * (count - 1), maxSpan);
  let lo = center - span / 2;
  let hi = center + span / 2;
  if (lo < DANCER_STAGE_POSITION_PCT_LO) {
    const shift = DANCER_STAGE_POSITION_PCT_LO - lo;
    lo += shift;
    hi += shift;
  }
  if (hi > DANCER_STAGE_POSITION_PCT_HI) {
    const shift = hi - DANCER_STAGE_POSITION_PCT_HI;
    lo -= shift;
    hi -= shift;
  }
  return {
    lo: Math.max(DANCER_STAGE_POSITION_PCT_LO, lo),
    hi: Math.min(DANCER_STAGE_POSITION_PCT_HI, hi),
  };
}

/**
 * 選択した人を1本の直線にそろえる。人の順番と、線に沿った位置は変えない。
 * 横一列は高さ（Y）を選択範囲の上下中央へ。縦一列は左右（X）を左右中央へ。
 */
export function straightenSelectionLine(
  dancers: DancerSpot[],
  targetIds: readonly string[],
  axis: SelectionLineAxis
): DancerSpot[] {
  return alignSelectedDancers(
    dancers,
    targetIds,
    axis === "row" ? "centerY" : "centerX"
  );
}

/**
 * 選択した人を1本の等間隔の直線にする。
 * 横は左から、縦は奥（Y が小さい）からの順番を維持する。
 * 線の両端は今の位置のまま。幅がほぼ 0 のときだけ基準間隔で開く。
 */
export function evenSelectionLine(
  dancers: DancerSpot[],
  targetIds: readonly string[],
  axis: SelectionLineAxis
): DancerSpot[] {
  const { subset } = selectedSubset(dancers, targetIds);
  if (subset.length < 2) return dancers;
  const box = bboxOf(subset);
  if (!box) return dancers;

  const sorted = [...subset].sort((a, b) => compareAlongLine(a, b, axis));
  const alongLo = axis === "row" ? box.minX : box.minY;
  const alongHi = axis === "row" ? box.maxX : box.maxY;
  const center = axis === "row" ? box.cx : box.cy;
  const span =
    Math.abs(alongHi - alongLo) < COLLAPSED_LINE_SPAN
      ? expandedLineSpan(center, sorted.length)
      : { lo: alongLo, hi: alongHi };
  const cross = clampStagePct(axis === "row" ? box.cy : box.cx);
  const n = sorted.length;
  const nextAlong = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    nextAlong.set(sorted[i]!.id, clampStagePct(span.lo + (span.hi - span.lo) * t));
  }

  return dancers.map((d) => {
    const along = nextAlong.get(d.id);
    if (along == null) return d;
    return axis === "row"
      ? { ...d, xPct: along, yPct: cross }
      : { ...d, xPct: cross, yPct: along };
  });
}
