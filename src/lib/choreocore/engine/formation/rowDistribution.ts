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
 * W字: ピラミッド同系の行配分（5→[1,2,2], 7→[1,2,4]）。
 * 見た目は先端＋翼の広がりで W / 扇の骨格になる。
 */
export const W_SHAPE_ROW_MAP: Record<number, number[]> = { ...PYRAMID_ROW_MAP };

/**
 * 楔・傘（逆V）: 手前が広く奥に先端。ピラミッド行配分の前後反転。
 */
export const WEDGE_ROW_MAP: Record<number, number[]> = Object.fromEntries(
  Object.entries(PYRAMID_ROW_MAP).map(([k, rows]) => [Number(k), [...rows].reverse()])
) as Record<number, number[]>;

/**
 * ひし形: 前後対称の層（中央が最厚、先端が客席側トップ）。
 */
export const DIAMOND_ROW_MAP: Record<number, number[]> = {
  1: [1],
  2: [1, 1],
  3: [1, 1, 1],
  4: [1, 2, 1],
  5: [1, 3, 1],
  6: [1, 2, 2, 1],
  7: [1, 2, 3, 1],
  8: [1, 3, 3, 1],
  9: [1, 2, 3, 2, 1],
  10: [1, 2, 4, 2, 1],
  11: [1, 2, 5, 2, 1],
  12: [1, 3, 4, 3, 1],
  14: [1, 3, 6, 3, 1],
  16: [1, 3, 4, 4, 3, 1],
};

/**
 * 扇・弓の2列: 千鳥と同配分（外弧=手前、内弧=奥）。
 */
export const ARC_ROW_MAP: Record<number, number[]> = { ...STAGGERED_ROW_MAP };

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

type LayeredOptions = {
  rowYGapPct?: number;
  colXGapPct?: number;
  centerYPct?: number;
  maxHalfWidthPct?: number;
};

/**
 * 奥から手前へ隙間配置する多層ジェネレータ（ピラミッド系共通）。
 * @param preferFrontWide 楔など手前広・奥狭。同人数隣接行では手前を広くする。
 */
function generateLayeredFromMap(
  map: Record<number, number[]>,
  dancerCount: number,
  fallbackRows: number,
  options?: LayeredOptions & { preferFrontWide?: boolean }
): Point2DPct[] {
  const rowSplit = resolveRowSplit(map, dancerCount, fallbackRows);
  if (rowSplit.length === 0) return [];

  const preferFrontWide = options?.preferFrontWide ?? false;
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
      const narrowStep = Math.max(10, step * 0.7);
      const wideStep = narrowStep + 10;
      if (preferFrontWide) {
        pointsByRow[r] = evenXs(cnt, 50, wideStep, 50 - maxHalf, 50 + maxHalf);
        pointsByRow[r + 1] = evenXs(cnt, 50, narrowStep, 50 - maxHalf, 50 + maxHalf);
      } else {
        pointsByRow[r] = evenXs(cnt, 50, narrowStep, 50 - maxHalf, 50 + maxHalf);
        pointsByRow[r + 1] = evenXs(cnt, 50, wideStep, 50 - maxHalf, 50 + maxHalf);
      }
      continue;
    }

    // 手前の方が多い → 手前を広く
    if (cnt > behind.length) {
      const wideStep = step + 8;
      pointsByRow[r] = evenXs(cnt, 50, wideStep, 50 - maxHalf, 50 + maxHalf);
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
 * 明示行配分のピラミッド（先端=最前列=客席側）。
 */
export function generateStructuredPyramid(
  dancerCount: number,
  options?: LayeredOptions
): Point2DPct[] {
  return generateLayeredFromMap(PYRAMID_ROW_MAP, dancerCount, 3, options);
}

/**
 * W字: ピラミッド同系の行配分で先端＋多層翼。
 */
export function generateStructuredWShape(
  dancerCount: number,
  options?: LayeredOptions
): Point2DPct[] {
  return generateLayeredFromMap(W_SHAPE_ROW_MAP, dancerCount, 3, {
    rowYGapPct: 13,
    colXGapPct: 17,
    ...options,
  });
}

/**
 * 楔・傘: 手前広・奥先端（行配分はピラミッドの反転）。
 */
export function generateStructuredWedge(
  dancerCount: number,
  options?: LayeredOptions
): Point2DPct[] {
  return generateLayeredFromMap(WEDGE_ROW_MAP, dancerCount, 3, {
    rowYGapPct: 13,
    centerYPct: 50,
    preferFrontWide: true,
    ...options,
  });
}

/**
 * ひし形: 前後対称層。センター縦軸のトップ（客席側先端）を強調。
 */
export function generateStructuredDiamond(
  dancerCount: number,
  options?: LayeredOptions
): Point2DPct[] {
  return generateLayeredFromMap(DIAMOND_ROW_MAP, dancerCount, 5, {
    rowYGapPct: 12,
    colXGapPct: 15,
    maxHalfWidthPct: 32,
    ...options,
  });
}

/**
 * 扇・弓形: 2列時は外弧（手前）と内弧（奥）を放射状に半ピッチずらす。
 * 1列相当の人数では単一弧。
 */
export function generateStructuredArc(
  dancerCount: number,
  options?: {
    a0?: number;
    a1?: number;
    cxPct?: number;
    cyPct?: number;
    outerR?: number;
    innerR?: number;
    /** true なら奥向き半円（上向き開口） */
    openBack?: boolean;
  }
): Point2DPct[] {
  if (dancerCount <= 0) return [];
  if (dancerCount === 1) {
    return [{ xPct: 50, yPct: options?.cyPct ?? 52 }];
  }

  const a0 = options?.a0 ?? Math.PI * 0.2;
  const a1 = options?.a1 ?? Math.PI * 0.8;
  const cx = options?.cxPct ?? 50;
  const cy = options?.cyPct ?? 52;
  const openBack = options?.openBack ?? false;

  const rowSplit = resolveRowSplit(ARC_ROW_MAP, dancerCount, 2);
  const useTwoArcs = rowSplit.length >= 2 && dancerCount >= 4;

  const placeOnArc = (
    count: number,
    radius: number,
    angleOffset: number
  ): Point2DPct[] => {
    if (count <= 0) return [];
    if (count === 1) {
      const a = (a0 + a1) / 2 + angleOffset;
      const ySign = openBack ? 1 : -1;
      return [
        {
          xPct: Number((cx + radius * Math.cos(a)).toFixed(2)),
          yPct: Number((cy + ySign * radius * Math.sin(a)).toFixed(2)),
        },
      ];
    }
    const out: Point2DPct[] = [];
    for (let i = 0; i < count; i += 1) {
      const u = i / (count - 1);
      const a = a0 + (a1 - a0) * u + angleOffset;
      const ySign = openBack ? 1 : -1;
      out.push({
        xPct: Number((cx + radius * Math.cos(a)).toFixed(2)),
        yPct: Number((cy + ySign * radius * Math.sin(a)).toFixed(2)),
      });
    }
    return out;
  };

  if (!useTwoArcs) {
    const r = options?.outerR ?? 26 + Math.min(8, dancerCount * 0.35);
    return placeOnArc(dancerCount, r, 0);
  }

  const frontCount = rowSplit[0]!;
  const backCount = rowSplit.slice(1).reduce((a, b) => a + b, 0);
  // 残りが複数行マップでも弧は内外2本に畳む
  const outerN = frontCount;
  const innerN = dancerCount - outerN;
  void backCount;

  const outerR = options?.outerR ?? 28 + Math.min(6, dancerCount * 0.25);
  const innerR = options?.innerR ?? Math.max(14, outerR - 12);

  // 外弧を基準に、内弧は半スロットずらして隙間から見える
  const slot = (a1 - a0) / Math.max(outerN - 1, 1);
  const innerOffset = innerN === outerN ? slot / 2 : 0;

  const outer = placeOnArc(outerN, outerR, 0);
  let inner: Point2DPct[];
  if (innerN === outerN - 1 && outerN >= 2) {
    // 外弧の隣接点の中間角へ
    inner = [];
    for (let i = 0; i < innerN; i += 1) {
      const u0 = i / Math.max(outerN - 1, 1);
      const u1 = (i + 1) / Math.max(outerN - 1, 1);
      const a = a0 + (a1 - a0) * ((u0 + u1) / 2);
      const ySign = openBack ? 1 : -1;
      inner.push({
        xPct: Number((cx + innerR * Math.cos(a)).toFixed(2)),
        yPct: Number((cy + ySign * innerR * Math.sin(a)).toFixed(2)),
      });
    }
  } else {
    inner = placeOnArc(innerN, innerR, innerOffset);
  }

  return [...outer, ...inner];
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
