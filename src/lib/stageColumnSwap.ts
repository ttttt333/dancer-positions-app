import type { DancerSpot } from "../types/choreography";

/** 同一列とみなす X の差（%） */
const COLUMN_X_TOLERANCE_PCT = 5;

/** 同一行とみなす Y の差（%） */
const ROW_Y_TOLERANCE_PCT = 6;

function clampPct(v: number): number {
  return Math.max(0.25, Math.min(99.75, v));
}

export type SelectionColumn = {
  /** 0 = 下手側（左）から数えた列 */
  index: number;
  centerXPct: number;
  members: DancerSpot[];
};

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
  const groups: DancerSpot[][] = [];

  for (const d of sorted) {
    const last = groups[groups.length - 1];
    if (!last?.length) {
      groups.push([d]);
      continue;
    }
    const lastCenter =
      last.reduce((sum, m) => sum + m.xPct, 0) / last.length;
    if (Math.abs(d.xPct - lastCenter) <= COLUMN_X_TOLERANCE_PCT) {
      last.push(d);
    } else {
      groups.push([d]);
    }
  }

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
 * 行は Y 座標が近いペアで対応づける。
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

  const yById = new Map<string, number>();
  const usedB = new Set<string>();

  for (const a of groupA) {
    const candidates = groupB
      .filter((b) => !usedB.has(b.id))
      .sort(
        (x, y) => Math.abs(x.yPct - a.yPct) - Math.abs(y.yPct - a.yPct)
      );
    const partner = candidates[0];
    if (!partner) continue;
    usedB.add(partner.id);
    yById.set(a.id, partner.yPct);
    yById.set(partner.id, a.yPct);
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
