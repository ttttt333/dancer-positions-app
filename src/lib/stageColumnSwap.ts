import type { DancerSpot } from "../types/choreography";

const MIN_COLUMN_SPLIT_GAP_PCT = 3;

function clampPct(v: number): number {
  return Math.max(0.25, Math.min(99.75, v));
}

export type SelectionColumn = {
  /** 0 = 下手側（左）から数えた列 */
  index: number;
  centerXPct: number;
  members: DancerSpot[];
};

type XSlot = {
  center: number;
  members: DancerSpot[];
};

function sortByStageRow(a: DancerSpot, b: DancerSpot): number {
  return a.yPct - b.yPct || a.xPct - b.xPct || a.id.localeCompare(b.id);
}

function columnCenter(members: DancerSpot[]): number {
  if (!members.length) return 0;
  return members.reduce((sum, m) => sum + m.xPct, 0) / members.length;
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

/** 近い X をまとめたスロット列（全員がいずれかのスロットに入る） */
function buildXSlots(subset: DancerSpot[], tolerance: number): XSlot[] {
  const sorted = [...subset].sort(
    (a, b) => a.xPct - b.xPct || a.yPct - b.yPct || a.id.localeCompare(b.id)
  );
  const slots: XSlot[] = [];
  for (const d of sorted) {
    const last = slots[slots.length - 1];
    if (last && d.xPct - last.center <= tolerance) {
      last.members.push(d);
      last.center = columnCenter(last.members);
    } else {
      slots.push({ center: d.xPct, members: [d] });
    }
  }
  return slots;
}

/** 隣接スロット間の小さい隙間を統合し、列グループにする */
function mergeSlotsIntoColumns(slots: XSlot[]): DancerSpot[][] {
  if (!slots.length) return [];
  if (slots.length === 1) return [slots[0]!.members];

  const gaps = slots.slice(1).map((slot, i) => ({
    afterIndex: i,
    gap: slot.center - slots[i]!.center,
  }));
  const sortedGaps = gaps.map((g) => g.gap).sort((a, b) => a - b);
  const withinGap = sortedGaps[Math.floor(sortedGaps.length * 0.33)] ?? sortedGaps[0]!;
  const mergeThreshold = Math.max(
    MIN_COLUMN_SPLIT_GAP_PCT,
    withinGap * 2 + 1
  );

  const columns: DancerSpot[][] = [];
  let current = [...slots[0]!.members];
  for (let i = 1; i < slots.length; i++) {
    const gap = slots[i]!.center - slots[i - 1]!.center;
    if (gap > mergeThreshold) {
      columns.push(current);
      current = [...slots[i]!.members];
    } else {
      current.push(...slots[i]!.members);
    }
  }
  columns.push(current);
  return columns;
}

/** 行ごとの列数の最頻値（同数なら少ない方） */
function modeColumnCount(counts: number[]): number {
  if (!counts.length) return 1;
  const freq = new Map<number, number>();
  for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1);
  let best = counts[0]!;
  let bestN = 0;
  for (const [value, n] of freq) {
    if (n > bestN || (n === bestN && value < best)) {
      best = value;
      bestN = n;
    }
  }
  return best;
}

function estimateColumnCount(subset: DancerSpot[]): number {
  if (subset.length < 2) return subset.length;

  const xTol = withinAxisTolerance(subset.map((d) => d.xPct));
  const yTol = withinAxisTolerance(subset.map((d) => d.yPct));
  const rows = bucketByAxis(subset, "yPct", yTol);
  const rowCounts = rows.map((row) => buildXSlots(row, xTol).length);
  const fromRows = modeColumnCount(rowCounts);

  const slots = buildXSlots(subset, xTol);
  const fromSlots = mergeSlotsIntoColumns(slots).length;

  return Math.max(1, Math.min(subset.length, Math.max(fromRows, fromSlots)));
}

/** 推定列数で全員を列に割り当て（下手→上手） */
function assignToColumnCount(
  subset: DancerSpot[],
  columnCount: number
): DancerSpot[][] {
  const detected = detectSelectionColumnGroups(subset);
  if (detected.length === columnCount) return detected;

  const k = Math.max(1, Math.min(columnCount, subset.length));
  if (k === 1) return [subset];

  const sorted = [...subset].sort(
    (a, b) => a.xPct - b.xPct || a.yPct - b.yPct || a.id.localeCompare(b.id)
  );
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

/** 選択範囲の列グループを判定（全員を列に割当） */
export function detectSelectionColumnGroups(subset: DancerSpot[]): DancerSpot[][] {
  if (!subset.length) return [];
  if (subset.length === 1) return [subset];

  const xTol = withinAxisTolerance(subset.map((d) => d.xPct));
  const slots = buildXSlots(subset, xTol);
  const merged = mergeSlotsIntoColumns(slots);
  const estimated = estimateColumnCount(subset);

  if (merged.length === estimated) return merged;
  return assignToColumnCount(subset, estimated);
}

/** 選択範囲内のダンサーを X 座標で列クラスタに分ける */
export function clusterSelectionColumns(
  dancers: DancerSpot[],
  targetIds: string[]
): SelectionColumn[] {
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  const groups = detectSelectionColumnGroups(subset);

  return groups.map((members, index) => ({
    index,
    centerXPct: columnCenter(members),
    members,
  }));
}

export function countSelectionColumns(
  dancers: DancerSpot[],
  targetIds: string[]
): number {
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (!subset.length) return 0;
  return detectSelectionColumnGroups(subset).length;
}

/** 列ごとの人数サマリー（UI 表示用） */
export function formatSelectionColumnSummary(
  dancers: DancerSpot[],
  targetIds: string[]
): string {
  const columns = clusterSelectionColumns(dancers, targetIds);
  if (!columns.length) return "";
  return columns
    .map((col, i) => `${i + 1}列目${col.members.length}人`)
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

/** 行（Y）単位で列どうしの前後パターンを入れ替える */
function swapYBetweenColumnGroups(
  groupA: DancerSpot[],
  groupB: DancerSpot[]
): Map<string, number> {
  const combined = [...groupA, ...groupB];
  const yTol = withinAxisTolerance(combined.map((d) => d.yPct));
  const rowsA = bucketByAxis(groupA, "yPct", yTol);
  const rowsB = bucketByAxis(groupB, "yPct", yTol);
  const rowCount = Math.max(rowsA.length, rowsB.length);
  const yById = new Map<string, number>();

  for (let i = 0; i < rowCount; i++) {
    const aRow = [...(rowsA[i] ?? [])].sort(sortByStageRow);
    const bRow = [...(rowsB[i] ?? [])].sort(sortByStageRow);
    const ysA = aRow.map((d) => d.yPct);
    const ysB = bRow.map((d) => d.yPct);
    const newYsA = remapYValues(ysB, aRow.length);
    const newYsB = remapYValues(ysA, bRow.length);
    aRow.forEach((d, j) => yById.set(d.id, newYsA[j]!));
    bRow.forEach((d, j) => yById.set(d.id, newYsB[j]!));
  }

  for (const d of combined) {
    if (!yById.has(d.id)) yById.set(d.id, d.yPct);
  }

  return yById;
}

/**
 * 2 列の前後（Y）だけ入れ替え。X は変えない。
 * 判定した列の全員について、行単位で相手列の前後パターンと入れ替える。
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

  const neededColumns = Math.max(
    estimateColumnCount(subset),
    colA + 1,
    colB + 1
  );
  const columns = assignToColumnCount(subset, neededColumns);
  const groupA = columns[colA] ?? [];
  const groupB = columns[colB] ?? [];
  if (!groupA.length || !groupB.length) return dancers;

  const yById = swapYBetweenColumnGroups(groupA, groupB);

  return dancers.map((d) => {
    if (!idSet.has(d.id)) return d;
    const nextY = yById.get(d.id);
    if (nextY === undefined) return d;
    return { ...d, yPct: clampPct(nextY) };
  });
}

/**
 * 選択範囲の重心を軸に X を反転（上手 ⇄ 下手）。Y は変えない。
 */
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
  return assignToColumnCount(subset, columnCount);
}

/** @deprecated テスト互換 */
export function estimateSelectionColumnCount(subset: DancerSpot[]): number {
  return estimateColumnCount(subset);
}
