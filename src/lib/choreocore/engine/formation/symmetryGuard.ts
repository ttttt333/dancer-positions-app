export interface Point2DPct {
  xPct: number;
  yPct: number;
}

const SYMMETRIC_CATEGORIES = new Set([
  "V_SHAPE",
  "PYRAMID",
  "DIAMOND",
  "ARC",
  "WEDGE",
  "W_SHAPE",
  "STAGGERED",
]);

/**
 * 対称系プリセットにおける厳格な線対称強制と歪み判定。
 */
export function enforceAndEvaluateSymmetry(
  positions: Point2DPct[],
  category: string
): { enforcedPositions: Point2DPct[]; scoreAdjustment: number } {
  if (!SYMMETRIC_CATEGORIES.has(category) || positions.length === 0) {
    return { enforcedPositions: positions, scoreAdjustment: 0 };
  }

  const result = positions.map((p) => ({ ...p }));
  let totalAsymmetryDiffPct = 0;

  // Y座標（行）ごとにグループ化して左右ペアを照合
  const sortedByY = [...result].sort((a, b) => a.yPct - b.yPct);
  const rows: Point2DPct[][] = [];
  let currentRow: Point2DPct[] = [];

  for (const p of sortedByY) {
    if (
      currentRow.length === 0 ||
      Math.abs(p.yPct - currentRow[0]!.yPct) < 3.0
    ) {
      currentRow.push(p);
    } else {
      rows.push(currentRow);
      currentRow = [p];
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  for (const row of rows) {
    const lefts = row
      .filter((p) => p.xPct < 49.5)
      .sort((a, b) => b.xPct - a.xPct);
    const rights = row
      .filter((p) => p.xPct > 50.5)
      .sort((a, b) => a.xPct - b.xPct);

    const pairCount = Math.min(lefts.length, rights.length);
    for (let i = 0; i < pairCount; i += 1) {
      const left = lefts[i]!;
      const right = rights[i]!;
      const dxLeft = 50.0 - left.xPct;
      const dxRight = right.xPct - 50.0;

      totalAsymmetryDiffPct += Math.abs(dxLeft - dxRight);

      // 完全鏡像 (50.0 ± avgDx) へ補正
      const avgDx = (dxLeft + dxRight) / 2;
      left.xPct = Number((50.0 - avgDx).toFixed(2));
      right.xPct = Number((50.0 + avgDx).toFixed(2));
    }

    // 行内の左右人数不均衡 (例: 左に3人、右に1人) のペナルティ
    if (lefts.length !== rights.length && row.length > 1) {
      totalAsymmetryDiffPct += Math.abs(lefts.length - rights.length) * 8.0;
    }
  }

  let scoreAdjustment = 0;
  if (totalAsymmetryDiffPct > 4.0) {
    scoreAdjustment = -Math.min(0.3, (totalAsymmetryDiffPct - 4.0) * 0.03);
  } else {
    scoreAdjustment = 0.1; // 高精度シンメトリーへのボーナス
  }

  return {
    enforcedPositions: result,
    scoreAdjustment: Number(scoreAdjustment.toFixed(3)),
  };
}

export function isSymmetricFormationCategory(category: string): boolean {
  return SYMMETRIC_CATEGORIES.has(category);
}
