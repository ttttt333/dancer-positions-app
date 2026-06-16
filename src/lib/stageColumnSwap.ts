import type { DancerSpot } from "../types/choreography";

const MIN_COLUMN_SPLIT_GAP_PCT = 3;
const MAX_COLUMN_SPLIT_GAP_PCT = 14;

function clampPct(v: number): number {
  return Math.max(0.25, Math.min(99.75, v));
}

export type SelectionColumn = {
  /** 0 = 下手側（左）から数えた列 */
  index: number;
  centerXPct: number;
  members: DancerSpot[];
};

/** 隣接 X の差から列の区切り閾値を推定 */
function columnSplitGap(sortedByX: DancerSpot[]): number {
  if (sortedByX.length < 2) return MIN_COLUMN_SPLIT_GAP_PCT;

  const gaps: number[] = [];
  for (let i = 1; i < sortedByX.length; i++) {
    gaps.push(sortedByX[i]!.xPct - sortedByX[i - 1]!.xPct);
  }
  gaps.sort((a, b) => a - b);

  const lo = gaps[Math.floor(gaps.length * 0.25)] ?? gaps[0]!;
  const hi = gaps[Math.floor(gaps.length * 0.75)] ?? gaps[gaps.length - 1]!;
  const threshold = (lo + hi) / 2;

  return Math.max(
    MIN_COLUMN_SPLIT_GAP_PCT,
    Math.min(MAX_COLUMN_SPLIT_GAP_PCT, threshold)
  );
}

/** 選択範囲内のダンサーを X 座標で列クラスタに分ける */
export function clusterSelectionColumns(
  dancers: DancerSpot[],
  targetIds: string[]
): SelectionColumn[] {
  const idSet = new Set(targetIds);
  const subset = dancers.filter((d) => idSet.has(d.id));
  if (!subset.length) return [];

  const sorted = [...subset].sort(
    (a, b) => a.xPct - b.xPct || a.yPct - b.yPct || a.id.localeCompare(b.id)
  );
  const splitGap = columnSplitGap(sorted);
  const groups: DancerSpot[][] = [];
  let current: DancerSpot[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const d = sorted[i]!;
    if (d.xPct - prev.xPct > splitGap) {
      groups.push(current);
      current = [d];
    } else {
      current.push(d);
    }
  }
  groups.push(current);

  return groups.map((members, index) => ({
    index,
    centerXPct:
      members.reduce((sum, m) => sum + m.xPct, 0) / members.length,
    members,
  }));
}

export function countSelectionColumns(
  dancers: DancerSpot[],
  targetIds: string[]
): number {
  return clusterSelectionColumns(dancers, targetIds).length;
}

/**
 * 2 列の前後（Y）だけ入れ替え。X は変えない。
 * 各列を奥→手前（Y 昇順）に並べ、同じ行インデックス同士で Y を交換する。
 */
export function swapSelectionColumnsDepth(
  dancers: DancerSpot[],
  targetIds: string[],
  colA: number,
  colB: number
): DancerSpot[] {
  if (colA === colB) return dancers;

  const columns = clusterSelectionColumns(dancers, targetIds);
  const groupA = columns[colA]?.members ?? [];
  const groupB = columns[colB]?.members ?? [];
  if (!groupA.length || !groupB.length) return dancers;

  const sortByRow = (a: DancerSpot, b: DancerSpot) =>
    a.yPct - b.yPct || a.xPct - b.xPct || a.id.localeCompare(b.id);

  const sortedA = [...groupA].sort(sortByRow);
  const sortedB = [...groupB].sort(sortByRow);
  const yById = new Map<string, number>();
  const pairCount = Math.min(sortedA.length, sortedB.length);

  for (let i = 0; i < pairCount; i++) {
    const a = sortedA[i]!;
    const b = sortedB[i]!;
    yById.set(a.id, b.yPct);
    yById.set(b.id, a.yPct);
  }

  const idSet = new Set(targetIds);
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
