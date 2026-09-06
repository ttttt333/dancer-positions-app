/**
 * 前後コマの移動線分交差を検出し、2-opt 風のローカルスワップで修復する。
 * Python `repair_crossings` の TypeScript 移植。
 */

export type Position2D = {
  x: number;
  y: number;
};

/**
 * 3点の外積（CCW）符号付き面積の2倍相当。
 */
function ccw(a: Position2D, b: Position2D, c: Position2D): number {
  return (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
}

/**
 * 線分 (p1→p2) と (p3→p4) が厳密に交差しているか。
 */
export function segmentsCross(
  p1: Position2D,
  p2: Position2D,
  p3: Position2D,
  p4: Position2D
): boolean {
  const d1 = ccw(p3, p4, p1);
  const d2 = ccw(p3, p4, p2);
  const d3 = ccw(p1, p2, p3);
  const d4 = ccw(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function euclideanDistance(a: Position2D, b: Position2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export type PathGuardOptions = {
  /** 最大ループ回数（既定: 50） */
  maxIter?: number;
  /** スワップ時に許容するコスト増加倍率（既定: 1.15） */
  costTolerance?: number;
};

/**
 * 移動パスの交差を自動スワップ修復する。
 *
 * @param currentPositions 現在コマの座標（length N）
 * @param targetSpots 次コマの目標スポット（length N）
 * @param assignments current[i] → targetSpots[assignments[i]]
 * @returns 修復後の assignments
 */
export function repairPathCrossings(
  currentPositions: Position2D[],
  targetSpots: Position2D[],
  assignments: number[],
  options?: PathGuardOptions
): number[] {
  const maxIter = options?.maxIter ?? 50;
  const tolerance = options?.costTolerance ?? 1.15;
  const repaired = [...assignments];
  const n = repaired.length;
  if (n <= 1) return repaired;
  if (
    currentPositions.length !== n ||
    targetSpots.length !== n ||
    assignments.length !== n
  ) {
    return repaired;
  }

  for (let iter = 0; iter < maxIter; iter += 1) {
    let improved = false;
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const ai = repaired[i]!;
        const aj = repaired[j]!;
        const currI = currentPositions[i]!;
        const targAi = targetSpots[ai]!;
        const currJ = currentPositions[j]!;
        const targAj = targetSpots[aj]!;

        if (!segmentsCross(currI, targAi, currJ, targAj)) continue;

        const distBefore =
          euclideanDistance(currI, targAi) + euclideanDistance(currJ, targAj);
        const distAfter =
          euclideanDistance(currI, targAj) + euclideanDistance(currJ, targAi);

        if (distAfter <= distBefore * tolerance) {
          repaired[i] = aj;
          repaired[j] = ai;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  return repaired;
}

/**
 * 交差残件数（デバッグ／テスト用）。
 */
export function countPathCrossings(
  currentPositions: Position2D[],
  targetSpots: Position2D[],
  assignments: number[]
): number {
  const n = assignments.length;
  let count = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (
        segmentsCross(
          currentPositions[i]!,
          targetSpots[assignments[i]!]!,
          currentPositions[j]!,
          targetSpots[assignments[j]!]!
        )
      ) {
        count += 1;
      }
    }
  }
  return count;
}
