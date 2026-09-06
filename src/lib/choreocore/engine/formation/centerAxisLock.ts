import { GOLDEN_GEOMETRY } from "./goldenParameters";

export interface Point2DPct {
  xPct: number;
  yPct: number;
}

export interface CenterLockOptions {
  /** センター軸を厳密に 50.0% にクランプするか（閾値を無視して最近傍を固定） */
  strictCenterSnap?: boolean;
  /** センターとみなす距離の閾値 (%) */
  centerTolerancePct?: number;
}

/**
 * 奇数人数のセンター固定および偶数人数の中央ペア左右対称補正。
 * 他フィールド（id / label 等）は保持する。
 */
export function enforceCenterAxisLock<T extends Point2DPct>(
  positions: T[],
  options?: CenterLockOptions
): T[] {
  const n = positions.length;
  if (n === 0) return positions;

  const tolerance =
    options?.centerTolerancePct ?? GOLDEN_GEOMETRY.CENTER_AXIS_TOLERANCE;
  const strict = options?.strictCenterSnap ?? false;
  const locked = positions.map((p) => ({ ...p }));

  if (n % 2 === 1) {
    // 奇数人数: Center ダンサー (X が 50% に最も近い点) を X=50.0% に固定
    let centerIndex = 0;
    let minDiff = Math.abs(locked[0]!.xPct - 50.0);

    for (let i = 1; i < n; i += 1) {
      const diff = Math.abs(locked[i]!.xPct - 50.0);
      if (diff < minDiff) {
        minDiff = diff;
        centerIndex = i;
      }
    }

    if (strict || minDiff <= tolerance) {
      locked[centerIndex]!.xPct = 50.0;
    }
  } else {
    // 偶数人数: X=50% を挟む中央ペアを探し、完全線対称へ補正
    const sortedByDist = locked
      .map((p, idx) => ({ idx, dist: Math.abs(p.xPct - 50.0) }))
      .sort((a, b) => a.dist - b.dist);

    if (sortedByDist.length >= 2) {
      const idx1 = sortedByDist[0]!.idx;
      const idx2 = sortedByDist[1]!.idx;
      const p1 = locked[idx1]!;
      const p2 = locked[idx2]!;

      // 同じ行（Y 座標が近い）中央ペアの場合
      if (Math.abs(p1.yPct - p2.yPct) < 3.0) {
        const avgDx =
          (Math.abs(p1.xPct - 50.0) + Math.abs(p2.xPct - 50.0)) / 2;
        if (p1.xPct < 50.0) {
          locked[idx1]!.xPct = Number((50.0 - avgDx).toFixed(2));
          locked[idx2]!.xPct = Number((50.0 + avgDx).toFixed(2));
        } else {
          locked[idx1]!.xPct = Number((50.0 + avgDx).toFixed(2));
          locked[idx2]!.xPct = Number((50.0 - avgDx).toFixed(2));
        }
      }
    }
  }

  return locked;
}
