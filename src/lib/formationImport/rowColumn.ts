import { hypot, median, medianNearestNeighborDistance, type Point } from "./geometry";

export type RowCluster<T extends { id: string; marker: Point }> = {
  row: number;
  members: T[];
};

/**
 * Y の隙間で行を切る。閾値は固定 px ではなく最近傍距離の中央値。
 * 既存の clusterPositionsByRow（6% 固定）は使わない。
 */
export function detectRows<T extends { id: string; marker: Point }>(
  items: T[],
  rowCounts?: number[]
): RowCluster<T>[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ row: 0, members: [items[0]!] }];
  }

  const fromCounts = rowsFromWrittenCounts(items, rowCounts);
  if (fromCounts) return fromCounts;

  const points = items.map((it) => it.marker);
  const nn = medianNearestNeighborDistance(points);
  const sorted = [...items].sort(
    (a, b) => a.marker.y - b.marker.y || a.marker.x - b.marker.x
  );

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    gaps.push(sorted[i]!.marker.y - sorted[i - 1]!.marker.y);
  }
  const medianGap = median(gaps);
  const rowTolerance = Math.max(nn * 0.35, medianGap * 1.65, nn * 0.18);

  const rows: T[][] = [[sorted[0]!]];
  for (let i = 1; i < sorted.length; i += 1) {
    if (gaps[i - 1]! > rowTolerance) {
      rows.push([sorted[i]!]);
    } else {
      rows[rows.length - 1]!.push(sorted[i]!);
    }
  }

  return rows.map((members, row) => ({
    row,
    members: [...members].sort((a, b) => a.marker.x - b.marker.x),
  }));
}

/** 写真右端の 1,3,4,3 のように、書いてある人数で上から行を切る */
export function rowsFromWrittenCounts<T extends { id: string; marker: Point }>(
  items: T[],
  rowCounts?: number[]
): RowCluster<T>[] | null {
  if (!rowCounts?.length) return null;
  const counts = rowCounts.filter((n) => Number.isFinite(n) && n > 0);
  const total = counts.reduce((s, n) => s + n, 0);
  if (total !== items.length) return null;

  const sorted = [...items].sort(
    (a, b) => a.marker.y - b.marker.y || a.marker.x - b.marker.x
  );
  const rows: RowCluster<T>[] = [];
  let i = 0;
  counts.forEach((count, row) => {
    const members = sorted
      .slice(i, i + count)
      .sort((a, b) => a.marker.x - b.marker.x);
    i += count;
    rows.push({ row, members });
  });
  return rows;
}

export function assignColumns<T extends { id: string; marker: Point }>(
  rows: RowCluster<T>[]
): Map<string, { row: number; column: number }> {
  const out = new Map<string, { row: number; column: number }>();
  for (const cluster of rows) {
    cluster.members.forEach((m, column) => {
      out.set(m.id, { row: cluster.row, column });
    });
  }
  return out;
}

export function inferPattern(rowLengths: number[]): import("./types").FormationPattern {
  if (rowLengths.length <= 1) {
    return rowLengths[0] === 1 ? "FREE_FORM" : "LINE";
  }
  const allEqual = rowLengths.every((n) => n === rowLengths[0]);
  if (allEqual) return rowLengths.length === 1 ? "LINE" : "GRID";

  const first = rowLengths[0] ?? 0;
  const last = rowLengths[rowLengths.length - 1] ?? 0;
  const mid = rowLengths.slice(1, -1);
  const increasing = rowLengths.every(
    (n, i) => i === 0 || n >= rowLengths[i - 1]!
  );
  const decreasing = rowLengths.every(
    (n, i) => i === 0 || n <= rowLengths[i - 1]!
  );

  if (first === 1 && increasing && last > 1) return "TRIANGLE";
  if (last === 1 && decreasing && first > 1) return "INVERTED_V";
  if (first === 1 && last === 1 && mid.some((n) => n > first)) return "DIAMOND";
  if (first < last && !allEqual) return "PYRAMID";
  if (!allEqual) return "STAGGERED";
  return "FREE_FORM";
}

export function pairwiseDistanceError(
  raw: Point[],
  mapped: Point[]
): number {
  if (raw.length < 2 || raw.length !== mapped.length) return 1;
  const rawD: number[] = [];
  const mapD: number[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    for (let j = i + 1; j < raw.length; j += 1) {
      rawD.push(hypot(raw[i]!, raw[j]!));
      mapD.push(hypot(mapped[i]!, mapped[j]!));
    }
  }
  const rawMed = median(rawD) || 1;
  const mapMed = median(mapD) || 1;
  let acc = 0;
  for (let i = 0; i < rawD.length; i += 1) {
    const a = rawD[i]! / rawMed;
    const b = mapD[i]! / mapMed;
    acc += Math.abs(a - b);
  }
  return acc / rawD.length;
}
