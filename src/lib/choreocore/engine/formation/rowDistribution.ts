/**
 * 人数 N に応じた黄金行配分（Row Distribution）。
 * 千鳥・ピラミッド等の「ダンスとして映える列構成」を明示テーブルで持つ。
 *
 * 座標系（アプリ共通）:
 * - xPct: 0=上手寄り左、100=下手寄り右、50=センター
 * - yPct: 小=舞台裏（奥）、大=客席側（手前）
 * - rowCounts[0] = 最前列（客席側）、末尾 = 最奥列
 */

export type Point2DPct = {
  xPct: number;
  yPct: number;
};

/**
 * 千鳥（2列主体）: 前列 → 後列
 */
export const STAGGERED_ROW_MAP: Record<number, number[]> = {
  1: [1],
  2: [1, 1],
  3: [1, 2],
  4: [2, 2],
  5: [2, 3],
  6: [3, 3],
  7: [3, 4],
  8: [4, 4],
  9: [4, 5],
  10: [5, 5],
  11: [5, 6],
  12: [6, 6],
  14: [7, 7],
  16: [8, 8],
};

/**
 * ピラミッド・多層 V: 前列 → 後列（先端が客席側）
 */
export const PYRAMID_ROW_MAP: Record<number, number[]> = {
  1: [1],
  2: [1, 1],
  3: [1, 2],
  4: [1, 3],
  5: [1, 2, 2],
  6: [1, 2, 3],
  7: [1, 2, 4],
  8: [1, 3, 4],
  9: [1, 3, 5],
  10: [1, 4, 5],
  11: [1, 3, 3, 4],
  12: [1, 3, 4, 4],
  14: [1, 3, 5, 5],
  16: [1, 4, 5, 6],
};

/**
 * 未定義人数向けフォールバック。
 * counts[0]=最前列、余りは奥側へ足す。
 */
export function fallbackRowSplit(total: number, maxRows: number): number[] {
  if (total <= 0 || maxRows <= 0) return [];
  const rows = Math.min(maxRows, total);
  const base = Math.floor(total / rows);
  const rem = total - base * rows;
  const result = new Array<number>(rows).fill(base);
  for (let i = 0; i < rem; i += 1) {
    result[result.length - 1 - i]! += 1;
  }
  return result;
}

export function resolveRowSplit(
  map: Record<number, number[]>,
  dancerCount: number,
  fallbackRows: number
): number[] {
  if (dancerCount <= 0) return [];
  const hit = map[dancerCount];
  if (hit && hit.reduce((a, b) => a + b, 0) === dancerCount) {
    return [...hit];
  }
  return fallbackRowSplit(dancerCount, fallbackRows);
}

function evenXs(
  count: number,
  centerX: number,
  colGap: number,
  minX = 8,
  maxX = 92
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [centerX];
  const desired = colGap * (count - 1);
  const halfMax = Math.min(centerX - minX, maxX - centerX);
  const span = Math.min(desired, halfMax * 2);
  const step = span / (count - 1);
  const start = centerX - span / 2;
  return Array.from({ length: count }, (_, i) => start + i * step);
}

/**
 * 後列の隙間（中点）に前列を置く。人数が合わないときは中央揃え等間隔。
 */
function xsInGapsOf(backXs: number[], frontCount: number): number[] {
  if (frontCount <= 0) return [];
  if (frontCount === 1) return [50];
  if (backXs.length >= 2 && frontCount === backXs.length - 1) {
    const gaps: number[] = [];
    for (let i = 0; i < backXs.length - 1; i += 1) {
      gaps.push((backXs[i]! + backXs[i + 1]!) / 2);
    }
    return gaps;
  }
  return evenXs(frontCount, 50, 18);
}

/**
 * 明示行配分の千鳥座標。
 * 同人数2列は半ピッチずらし、2-3 / 3-4 などは奥の隙間に手前を置く。
 */
export function generateStructuredStaggered(
  dancerCount: number,
  options?: {
    rowYGapPct?: number;
    colXGapPct?: number;
    centerYPct?: number;
    frontYPct?: number;
    backYPct?: number;
  }
): Point2DPct[] {
  const rowSplit = resolveRowSplit(STAGGERED_ROW_MAP, dancerCount, 2);
  if (rowSplit.length === 0) return [];

  const colGap = options?.colXGapPct ?? 18;
  const rowCount = rowSplit.length;

  let ys: number[];
  if (rowCount === 2) {
    const frontY = options?.frontYPct ?? 60;
    const backY = options?.backYPct ?? 30;
    ys = [frontY, backY];
  } else {
    const rowYGap = options?.rowYGapPct ?? 15;
    const centerY = options?.centerYPct ?? 48;
    const totalYSpan = (rowCount - 1) * rowYGap;
    const frontY = centerY + totalYSpan / 2;
    ys = rowSplit.map((_, i) => frontY - i * rowYGap);
  }

  // 最奥から座標を確定し、手前は隙間 or 半ピッチ
  const pointsByRow: number[][] = new Array(rowCount);
  const backIdx = rowCount - 1;
  pointsByRow[backIdx] = evenXs(rowSplit[backIdx]!, 50, colGap);

  for (let r = backIdx - 1; r >= 0; r -= 1) {
    const cnt = rowSplit[r]!;
    const behind = pointsByRow[r + 1]!;
    if (cnt === behind.length) {
      // 半ピッチずらし。前列だけ再センタリングするとずれが消えるため、
      // 前後列をまとめてバウンディングボックス中心を 50 に揃える。
      const shifted = behind.map((x) => x + colGap / 2);
      const all = [...behind, ...shifted];
      const minX = Math.min(...all);
      const maxX = Math.max(...all);
      const shift = 50 - (minX + maxX) / 2;
      pointsByRow[r + 1] = behind.map((x) => x + shift);
      pointsByRow[r] = shifted.map((x) => x + shift);
    } else {
      pointsByRow[r] = xsInGapsOf(behind, cnt);
    }
  }

  const points: Point2DPct[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const y = ys[r]!;
    for (const x of pointsByRow[r]!) {
      points.push({
        xPct: Number(x.toFixed(2)),
        yPct: Number(y.toFixed(2)),
      });
    }
  }
  return points;
}

/**
 * 明示行配分のピラミッド（先端=最前列=客席側）。
 * 奥列から確定し、手前は奥の隙間へ置く（千鳥と同じ被り防止）。
 * 同人数の隣接行のみ、奥を広げて視線をずらす。
 */
export function generateStructuredPyramid(
  dancerCount: number,
  options?: {
    rowYGapPct?: number;
    colXGapPct?: number;
    centerYPct?: number;
    maxHalfWidthPct?: number;
  }
): Point2DPct[] {
  const rowSplit = resolveRowSplit(PYRAMID_ROW_MAP, dancerCount, 3);
  if (rowSplit.length === 0) return [];

  const colGap = options?.colXGapPct ?? 16;
  const maxHalf = options?.maxHalfWidthPct ?? 34;
  const rowCount = rowSplit.length;
  const rowYGap = options?.rowYGapPct ?? 14;
  const centerY = options?.centerYPct ?? 48;
  const totalYSpan = (rowCount - 1) * rowYGap;
  const frontY = centerY + totalYSpan / 2;

  const maxCnt = Math.max(...rowSplit);
  const stepCap = maxCnt > 1 ? (maxHalf * 2) / (maxCnt - 1) : colGap;
  const step = Math.min(colGap, stepCap);

  const pointsByRow: number[][] = new Array(rowCount);
  const backIdx = rowCount - 1;
  pointsByRow[backIdx] = evenXs(
    rowSplit[backIdx]!,
    50,
    step,
    50 - maxHalf,
    50 + maxHalf
  );

  for (let r = backIdx - 1; r >= 0; r -= 1) {
    const cnt = rowSplit[r]!;
    const behind = pointsByRow[r + 1]!;

    if (cnt === 1) {
      pointsByRow[r] = [50];
      continue;
    }

    if (cnt === behind.length) {
      // 同人数: 手前を狭く・奥を広げ、|Δx| が十分開くようにする
      const narrowStep = Math.max(10, step * 0.7);
      const wideStep = narrowStep + 10;
      pointsByRow[r] = evenXs(cnt, 50, narrowStep, 50 - maxHalf, 50 + maxHalf);
      pointsByRow[r + 1] = evenXs(cnt, 50, wideStep, 50 - maxHalf, 50 + maxHalf);
      continue;
    }

    if (cnt === behind.length - 1) {
      pointsByRow[r] = xsInGapsOf(behind, cnt);
      continue;
    }

    if (cnt < behind.length - 1) {
      const gaps: number[] = [];
      for (let i = 0; i < behind.length - 1; i += 1) {
        gaps.push((behind[i]! + behind[i + 1]!) / 2);
      }
      const start = Math.max(0, Math.floor((gaps.length - cnt) / 2));
      pointsByRow[r] = gaps.slice(start, start + cnt);
      continue;
    }

    // 手前の方が多い（通常は起きない）: 中央揃え
    pointsByRow[r] = evenXs(cnt, 50, step, 50 - maxHalf, 50 + maxHalf);
  }

  const points: Point2DPct[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const y = frontY - r * rowYGap;
    for (const x of pointsByRow[r]!) {
      points.push({
        xPct: Number(x.toFixed(2)),
        yPct: Number(y.toFixed(2)),
      });
    }
  }
  return points;
}

/**
 * 前後被りの簡易検出: 奥の人が手前の人と |Δx| が閾値未満かつ同列付近。
 * テスト用。0 なら客席視線上の被りなし（閾値内）。
 */
export function countNearOcclusions(
  points: Point2DPct[],
  xTolPct = 3.5
): number {
  if (points.length < 2) return 0;
  const sorted = [...points].sort((a, b) => b.yPct - a.yPct);
  let count = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const front = sorted[i]!;
    for (let j = i + 1; j < sorted.length; j += 1) {
      const back = sorted[j]!;
      if (front.yPct - back.yPct < 5) continue; // ほぼ同じ列
      if (Math.abs(front.xPct - back.xPct) < xTolPct) count += 1;
    }
  }
  return count;
}
