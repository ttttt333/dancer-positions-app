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

function sortByStageRow(a: DancerSpot, b: DancerSpot): number {
  return a.yPct - b.yPct || a.xPct - b.xPct || a.id.localeCompare(b.id);
}

function columnCenter(members: DancerSpot[]): number {
  if (!members.length) return 0;
  return members.reduce((sum, m) => sum + m.xPct, 0) / members.length;
}

/**
 * 選択メンバーを X 座標で k 列に分割（全員がいずれかの列に必ず入る）。
 * 1 次元 k-means（X のみ）で下手→上手の順に並べる。
 */
export function partitionSelectionByX(
  subset: DancerSpot[],
  columnCount: number
): DancerSpot[][] {
  const k = Math.max(1, Math.min(columnCount, subset.length));
  if (k === 1) return [subset];

  const sorted = [...subset].sort(
    (a, b) => a.xPct - b.xPct || a.yPct - b.yPct || a.id.localeCompare(b.id)
  );

  let centers: number[] = Array.from({ length: k }, (_, i) => {
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
    .map((members) => ({
      members,
      cx: columnCenter(members),
    }))
    .sort((a, b) => a.cx - b.cx)
    .map((g) => g.members);
}

/** 列数の目安（3 列目ボタン表示用） */
export function estimateSelectionColumnCount(subset: DancerSpot[]): number {
  if (subset.length < 2) return subset.length;

  const sorted = [...subset].sort(
    (a, b) => a.xPct - b.xPct || a.yPct - b.yPct || a.id.localeCompare(b.id)
  );
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i]!.xPct - sorted[i - 1]!.xPct);
  }
  if (!gaps.length) return 1;

  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const typical = sortedGaps[Math.floor(sortedGaps.length * 0.35)] ?? 0;
  const threshold = Math.max(MIN_COLUMN_SPLIT_GAP_PCT, typical * 2.5 + 0.75);

  let cols = 1;
  for (const gap of gaps) {
    if (gap > threshold) cols++;
  }
  return Math.min(cols, subset.length);
}

/** 選択範囲内のダンサーを X 座標で列クラスタに分ける */
export function clusterSelectionColumns(
  dancers: DancerSpot[],
  targetIds: string[]
): SelectionColumn[] {
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (!subset.length) return [];

  const k = estimateSelectionColumnCount(subset);
  const groups = partitionSelectionByX(subset, k);

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
  if (subset.length < 2) return subset.length;
  return estimateSelectionColumnCount(subset);
}

/** 列の人数が違っても、奥→手前の並びで Y の並びを相手列に割り当てる */
function remapYValues(sourceYs: number[], targetCount: number): number[] {
  if (targetCount <= 0) return [];
  if (!sourceYs.length) return [];
  if (sourceYs.length === targetCount) return [...sourceYs];
  if (sourceYs.length === 1) return Array.from({ length: targetCount }, () => sourceYs[0]!);

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

function swapYBetweenColumnGroups(
  groupA: DancerSpot[],
  groupB: DancerSpot[]
): Map<string, number> {
  const sortedA = [...groupA].sort(sortByStageRow);
  const sortedB = [...groupB].sort(sortByStageRow);
  const ysA = sortedA.map((d) => d.yPct);
  const ysB = sortedB.map((d) => d.yPct);
  const newYsForA = remapYValues(ysB, sortedA.length);
  const newYsForB = remapYValues(ysA, sortedB.length);
  const yById = new Map<string, number>();

  sortedA.forEach((d, i) => yById.set(d.id, newYsForA[i]!));
  sortedB.forEach((d, i) => yById.set(d.id, newYsForB[i]!));

  return yById;
}

/**
 * 2 列の前後（Y）だけ入れ替え。X は変えない。
 * 対象列に含まれる全員の Y を、相手列の前後パターンと入れ替える。
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

  const columnCount = Math.max(colA, colB) + 1;
  const columns = partitionSelectionByX(subset, columnCount);
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
