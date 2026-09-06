/**
 * 陣形の等間隔度（tidiness）評価。
 * Python `tidiness_score` の TypeScript 移植。
 */

import type { Position2D } from "./dancerPathGuard";

export type TidinessScoreResult = {
  /** 最近傍距離の変動係数 CV (σ/μ)。小さいほど等間隔 */
  spacingCv: number;
  /** 整い方総合スコア (0.0 - 1.0) */
  tidinessScore: number;
};

/**
 * 最近傍距離のばらつきから等間隔度を評価する。
 */
export function evaluateTidiness(positions: Position2D[]): TidinessScoreResult {
  const n = positions.length;
  if (n < 2) {
    return { spacingCv: 0, tidinessScore: 1 };
  }

  const nearestDistances: number[] = [];
  for (let i = 0; i < n; i += 1) {
    let minD = Infinity;
    const a = positions[i]!;
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      const b = positions[j]!;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < minD) minD = d;
    }
    if (Number.isFinite(minD)) nearestDistances.push(minD);
  }

  if (nearestDistances.length === 0) {
    return { spacingCv: 0, tidinessScore: 0 };
  }

  const mean =
    nearestDistances.reduce((acc, v) => acc + v, 0) / nearestDistances.length;
  if (mean < 1e-6) return { spacingCv: 0, tidinessScore: 0 };

  const variance =
    nearestDistances.reduce((acc, v) => acc + (v - mean) ** 2, 0) /
    nearestDistances.length;
  const stdDev = Math.sqrt(variance);
  const spacingCv = stdDev / mean;
  const tidinessScore = Math.max(0, Math.min(1, 1 - spacingCv));

  return {
    spacingCv: Number(spacingCv.toFixed(3)),
    tidinessScore: Number(tidinessScore.toFixed(3)),
  };
}
