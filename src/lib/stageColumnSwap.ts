import type { DancerSpot } from "../types/choreography";

const MIN_COLUMN_SPLIT_GAP_PCT = 3;

function clampPct(v: number): number {
  return Math.max(0.25, Math.min(99.75, v));
}

export type SelectionColumn = {
  /** 0 = 1列目（手前側の段、または下手の縦列） */
  index: number;
  centerXPct: number;
  members: DancerSpot[];
};

type XSlot = {
  center: number;
  members: DancerSpot[];
};

type SwapAxis = "depth-rows" | "vertical-columns";

function sortByStageRow(a: DancerSpot, b: DancerSpot): number {
  return a.yPct - b.yPct || a.xPct - b.xPct || a.id.localeCompare(b.id);
}

function sortByStageX(a: DancerSpot, b: DancerSpot): number {
  return a.xPct - b.xPct || a.yPct - b.yPct || a.id.localeCompare(b.id);
}

function columnCenter(members: DancerSpot[]): number {
  if (!members.length) return 0;
  return members.reduce((sum, m) => sum + m.xPct, 0) / members.length;
}

function rowCenter(members: DancerSpot[]): number {
  if (!members.length) return 0;
  return members.reduce((sum, m) => sum + m.yPct, 0) / members.length;
}

/** 近い座標値どうしをまとめる許容差（%） */
function withinAxisTolerance(values: number[]): number {
  if (values.length < 2) return 3;
  const sorted = [...values].sort((a, b) => a - b);
  const diffs: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i]! - sorted[i - 1]!;
    if (d > 0.05) diffs.push(d);
  }
  if (!diffs.length) return 3;
  const sortedDiffs = [...diffs].sort((a, b) => a - b);
  const typical = sortedDiffs[Math.floor(sortedDiffs.length * 0.3)] ?? sortedDiffs[0]!;
  return Math.max(2, Math.min(10, typical * 1.35 + 0.5));
}

function bucketByAxis(
  dancers: DancerSpot[],
  axis: "xPct" | "yPct",
  tolerance: number
): DancerSpot[][] {
  const sorted = [...dancers].sort((a, b) => {
    const av = a[axis];
    const bv = b[axis];
    return av - bv || a.xPct - b.xPct || a.id.localeCompare(b.id);
  });
  const buckets: DancerSpot[][] = [];
  for (const d of sorted) {
    const last = buckets[buckets.length - 1];
    const anchor = last?.[0]?.[axis] ?? -Infinity;
    if (last && d[axis] - anchor <= tolerance) last.push(d);
    else buckets.push([d]);
  }
  return buckets;
}

type AxisSlot = {
  center: number;
  members: DancerSpot[];
};

function buildAxisSlots(
  subset: DancerSpot[],
  axis: "xPct" | "yPct",
  tolerance: number
): AxisSlot[] {
  const sorted = [...subset].sort((a, b) => {
    const av = a[axis];
    const bv = b[axis];
    return av - bv || a.xPct - b.xPct || a.id.localeCompare(b.id);
  });
  const slots: AxisSlot[] = [];
  for (const d of sorted) {
    const last = slots[slots.length - 1];
    const center = axis === "xPct" ? columnCenter : rowCenter;
    if (last && d[axis] - last.center <= tolerance) {
      last.members.push(d);
      last.center = center(last.members);
    } else {
      slots.push({ center: d[axis], members: [d] });
    }
  }
  return slots;
}

function buildXSlots(subset: DancerSpot[], tolerance: number): XSlot[] {
  return buildAxisSlots(subset, "xPct", tolerance);
}

function mergeAxisSlotsIntoGroups(slots: AxisSlot[]): DancerSpot[][] {
  if (!slots.length) return [];
  if (slots.length === 1) return [slots[0]!.members];

  const gaps = slots.slice(1).map((slot, i) => slot.center - slots[i]!.center);
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const withinGap = sortedGaps[Math.floor(sortedGaps.length * 0.33)] ?? sortedGaps[0]!;
  const mergeThreshold = Math.max(MIN_COLUMN_SPLIT_GAP_PCT, withinGap * 2 + 1);

  const groups: DancerSpot[][] = [];
  let current = [...slots[0]!.members];
  for (let i = 1; i < slots.length; i++) {
    const gap = slots[i]!.center - slots[i - 1]!.center;
    if (gap > mergeThreshold) {
      groups.push(current);
      current = [...slots[i]!.members];
    } else {
      current.push(...slots[i]!.members);
    }
  }
  groups.push(current);
  return groups;
}

function mergeSlotsIntoColumns(slots: XSlot[]): DancerSpot[][] {
  return mergeAxisSlotsIntoGroups(slots);
}

/** X スロット間の大きな隙間から縦列数を数える */
function countColumnsFromSlotGaps(slots: XSlot[]): number {
  if (slots.length <= 1) return Math.max(1, slots.length);

  const gaps = slots.slice(1).map((slot, i) => slot.center - slots[i]!.center);
  const sorted = [...gaps].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;

  if (max / Math.max(min, 0.5) < 1.6) return slots.length;

  const threshold = Math.max(MIN_COLUMN_SPLIT_GAP_PCT, min * 1.8 + 1);
  return 1 + gaps.filter((gap) => gap > threshold).length;
}

function estimateVerticalColumnCount(subset: DancerSpot[]): number {
  const xTol = withinAxisTolerance(subset.map((d) => d.xPct));
  const slots = buildXSlots(subset, xTol);
  const fromGaps = countColumnsFromSlotGaps(slots);
  const fromMerged = mergeSlotsIntoColumns(slots).length;
  return Math.max(1, Math.min(subset.length, Math.max(fromGaps, fromMerged)));
}

function estimateDepthRowCount(subset: DancerSpot[]): number {
  return detectDepthRowGroups(subset).length;
}

function depthRowTolerance(subset: DancerSpot[]): number {
  const base = withinAxisTolerance(subset.map((d) => d.yPct));
  return Math.max(5, base);
}

function mergeDepthRowSlots(slots: AxisSlot[]): DancerSpot[][] {
  if (!slots.length) return [];
  if (slots.length === 1) return [slots[0]!.members];

  const gaps = slots.slice(1).map((slot, i) => slot.center - slots[i]!.center);
  const maxGap = Math.max(...gaps);
  const threshold = Math.max(MIN_COLUMN_SPLIT_GAP_PCT, maxGap * 0.45);

  const groups: DancerSpot[][] = [];
  let current = [...slots[0]!.members];
  for (let i = 1; i < slots.length; i++) {
    const gap = slots[i]!.center - slots[i - 1]!.center;
    if (gap > threshold) {
      groups.push(current);
      current = [...slots[i]!.members];
    } else {
      current.push(...slots[i]!.members);
    }
  }
  groups.push(current);
  return groups;
}

/** 前後の段（Y）を手前→奥の順に並べる。1列目 = 手前 */
function detectDepthRowGroups(subset: DancerSpot[]): DancerSpot[][] {
  const yTol = depthRowTolerance(subset);
  const slots = buildAxisSlots(subset, "yPct", yTol);
  const rows = mergeDepthRowSlots(slots);
  return [...rows].reverse();
}

/** 前後の段か、横位置の縦列か、どちらで入れ替えるか */
function chooseSwapAxis(subset: DancerSpot[]): SwapAxis {
  const colCount = estimateVerticalColumnCount(subset);
  const rowCount = estimateDepthRowCount(subset);

  // 前に広がるくさび形（奥 2 人・中 4 人・手前 5 人など）→ 段単位
  if (colCount > rowCount + 1) return "depth-rows";

  // 縦 2〜3 列 × 複数段の定番フォーメーション → 縦列単位
  if (colCount >= 2 && colCount >= rowCount - 1) return "vertical-columns";

  if (rowCount > colCount) return "depth-rows";
  return colCount >= 2 ? "vertical-columns" : "depth-rows";
}

function partitionByXKMeans(
  subset: DancerSpot[],
  columnCount: number
): DancerSpot[][] {
  const k = Math.max(1, Math.min(columnCount, subset.length));
  if (k === 1) return [subset];

  const sorted = [...subset].sort(sortByStageX);
  let centers = Array.from({ length: k }, (_, i) => {
    const idx = Math.round((i * (sorted.length - 1)) / Math.max(1, k - 1));
    return sorted[idx]!.xPct;
  });

  let groups: DancerSpot[][] = Array.from({ length: k }, () => []);

  for (let iter = 0; iter < 24; iter++) {
    groups = Array.from({ length: k }, () => []);
    for (const d of subset) {
      let best = 0;
      let bestDist = Math.abs(d.xPct - centers[0]!);
      for (let c = 1; c < k; c++) {
        const dist = Math.abs(d.xPct - centers[c]!);
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
      groups[best]!.push(d);
    }

    let changed = false;
    for (let c = 0; c < k; c++) {
      const members = groups[c]!;
      if (!members.length) {
        const idx = Math.min(
          sorted.length - 1,
          Math.round((c * (sorted.length - 1)) / Math.max(1, k - 1))
        );
        centers[c] = sorted[idx]!.xPct;
        changed = true;
        continue;
      }
      const next = columnCenter(members);
      if (Math.abs(next - centers[c]!) > 1e-6) changed = true;
      centers[c] = next;
    }
    if (!changed) break;
  }

  return groups
    .filter((members) => members.length > 0)
    .map((members) => ({ members, cx: columnCenter(members) }))
    .sort((a, b) => a.cx - b.cx)
    .map((g) => g.members);
}

function detectVerticalColumnGroups(subset: DancerSpot[]): DancerSpot[][] {
  const xTol = withinAxisTolerance(subset.map((d) => d.xPct));
  const slots = buildXSlots(subset, xTol);
  const merged = mergeSlotsIntoColumns(slots);
  const estimated = estimateVerticalColumnCount(subset);

  if (merged.length === estimated) return merged;
  const kmeans = partitionByXKMeans(subset, estimated);
  if (kmeans.length === estimated) return kmeans;
  return merged.length >= kmeans.length ? merged : kmeans;
}

function detectSwapGroups(subset: DancerSpot[], axis: SwapAxis): DancerSpot[][] {
  return axis === "depth-rows"
    ? detectDepthRowGroups(subset)
    : detectVerticalColumnGroups(subset);
}

function resolveSwapGroups(
  subset: DancerSpot[],
  axis: SwapAxis,
  minGroups: number
): DancerSpot[][] {
  const detected = detectSwapGroups(subset, axis);
  if (detected.length >= minGroups) return detected;

  if (axis === "vertical-columns") {
    return partitionByXKMeans(subset, minGroups);
  }

  const yTol = withinAxisTolerance(subset.map((d) => d.yPct));
  const rows = bucketByAxis(subset, "yPct", yTol);
  if (rows.length >= minGroups) return [...rows].reverse();
  return detected;
}

/** 選択範囲の列／段グループを判定 */
export function detectSelectionColumnGroups(subset: DancerSpot[]): DancerSpot[][] {
  if (!subset.length) return [];
  if (subset.length === 1) return [subset];
  const axis = chooseSwapAxis(subset);
  return detectSwapGroups(subset, axis);
}

export function getSelectionSwapAxis(
  dancers: DancerSpot[],
  targetIds: string[]
): SwapAxis {
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (subset.length < 2) return "vertical-columns";
  return chooseSwapAxis(subset);
}

export function clusterSelectionColumns(
  dancers: DancerSpot[],
  targetIds: string[]
): SelectionColumn[] {
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  const axis = chooseSwapAxis(subset);
  const groups = detectSwapGroups(subset, axis);

  return groups.map((members, index) => ({
    index,
    centerXPct:
      axis === "depth-rows" ? rowCenter(members) : columnCenter(members),
    members,
  }));
}

export function countSelectionColumns(
  dancers: DancerSpot[],
  targetIds: string[]
): number {
  return clusterSelectionColumns(dancers, targetIds).length;
}

export function formatSelectionColumnSummary(
  dancers: DancerSpot[],
  targetIds: string[],
  axis?: SwapAxis
): string {
  const columns = clusterSelectionColumns(dancers, targetIds);
  if (!columns.length) return "";
  const resolvedAxis =
    axis ?? getSelectionSwapAxis(dancers, targetIds);
  const unit = resolvedAxis === "depth-rows" ? "段" : "列";
  return columns
    .map((col, i) => `${i + 1}${unit}目${col.members.length}人`)
    .join("・");
}

function remapYValues(sourceYs: number[], targetCount: number): number[] {
  if (targetCount <= 0) return [];
  if (!sourceYs.length) return [];
  if (sourceYs.length === targetCount) return [...sourceYs];
  if (sourceYs.length === 1) {
    return Array.from({ length: targetCount }, () => sourceYs[0]!);
  }

  const result: number[] = [];
  for (let i = 0; i < targetCount; i++) {
    const t = targetCount === 1 ? 0 : i / (targetCount - 1);
    const pos = t * (sourceYs.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(sourceYs.length - 1, Math.ceil(pos));
    const frac = pos - lo;
    result.push(sourceYs[lo]! * (1 - frac) + sourceYs[hi]! * frac);
  }
  return result;
}

/** 2 グループの Y 座標を、横位置（X）の並びで対応づけて入れ替える */
function swapYBetweenGroups(groupA: DancerSpot[], groupB: DancerSpot[]): Map<string, number> {
  const sortedA = [...groupA].sort(sortByStageX);
  const sortedB = [...groupB].sort(sortByStageX);
  const ysA = sortedA.map((d) => d.yPct);
  const ysB = sortedB.map((d) => d.yPct);
  const newYsA = remapYValues(ysB, sortedA.length);
  const newYsB = remapYValues(ysA, sortedB.length);
  const yById = new Map<string, number>();

  sortedA.forEach((d, i) => yById.set(d.id, newYsA[i]!));
  sortedB.forEach((d, i) => yById.set(d.id, newYsB[i]!));

  for (const d of [...groupA, ...groupB]) {
    if (!yById.has(d.id)) yById.set(d.id, d.yPct);
  }

  return yById;
}

/**
 * 2 列／段の前後（Y）だけ入れ替え。X は変えない。
 */
export function swapSelectionColumnsDepth(
  dancers: DancerSpot[],
  targetIds: string[],
  colA: number,
  colB: number
): DancerSpot[] {
  if (colA === colB) return dancers;

  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (subset.length < 2) return dancers;

  const axis = chooseSwapAxis(subset);
  const groups = resolveSwapGroups(
    subset,
    axis,
    Math.max(colA, colB) + 1
  );
  const groupA = groups[colA] ?? [];
  const groupB = groups[colB] ?? [];
  if (!groupA.length || !groupB.length) return dancers;

  const yById = swapYBetweenGroups(groupA, groupB);

  return dancers.map((d) => {
    if (!idSet.has(d.id)) return d;
    const nextY = yById.get(d.id);
    if (nextY === undefined) return d;
    return { ...d, yPct: clampPct(nextY) };
  });
}

export function swapSelectionKamiteShimote(
  dancers: DancerSpot[],
  targetIds: string[]
): DancerSpot[] {
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (subset.length < 2) return dancers;

  let minX = Infinity;
  let maxX = -Infinity;
  for (const d of subset) {
    minX = Math.min(minX, d.xPct);
    maxX = Math.max(maxX, d.xPct);
  }
  if (!Number.isFinite(minX)) return dancers;
  const cx = (minX + maxX) / 2;

  return dancers.map((d) => {
    if (!idSet.has(d.id)) return d;
    return { ...d, xPct: clampPct(2 * cx - d.xPct) };
  });
}

/** @deprecated テスト互換 */
export function partitionSelectionByX(
  subset: DancerSpot[],
  columnCount: number
): DancerSpot[][] {
  return partitionByXKMeans(subset, columnCount);
}

/** @deprecated テスト互換 */
export function estimateSelectionColumnCount(subset: DancerSpot[]): number {
  return estimateVerticalColumnCount(subset);
}
