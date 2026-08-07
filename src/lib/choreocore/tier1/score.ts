/**
 * FormationScore — MOVE / SAFETY 正規化（0〜100）
 */

import {
  DEFAULT_FORMATION_WEIGHTS,
  type AssignmentResult,
  type FormationScore,
  type FormationWeights,
} from "./types";

/**
 * Score_move = max(0, 100 * (1 - averageDisplacement / maxFeasibleDistance))
 * Score_safety = max(0, 100 - C * 15)
 */
export function computeFormationScore(
  result: AssignmentResult,
  maxFeasibleDistance: number,
  weightOverrides?: Partial<FormationWeights>
): FormationScore {
  const moveRatio =
    maxFeasibleDistance > 0
      ? result.averageDisplacement / maxFeasibleDistance
      : 0;
  const moveScore = Math.max(0, 100 * (1 - moveRatio));
  const safetyScore = Math.max(0, 100 - result.crossings.length * 15);

  const weights: FormationWeights = {
    ...DEFAULT_FORMATION_WEIGHTS,
    ...weightOverrides,
    visual: 0,
    music: 0,
  };
  const wSum = Math.max(1e-9, weights.move + weights.safety);
  const total =
    (moveScore * weights.move + safetyScore * weights.safety) / wSum;

  return {
    total: Math.round(total),
    axes: {
      move: Math.round(moveScore),
      safety: Math.round(safetyScore),
      visual: null,
      music: null,
    },
    weights,
  };
}

export function explainFormationScore(score: FormationScore): string[] {
  const lines = [
    `総合 ${score.total}/100（移動 ${score.axes.move} ×${score.weights.move} + 安全 ${score.axes.safety} ×${score.weights.safety}）`,
  ];
  if (score.axes.visual == null) {
    lines.push("VISUAL / MUSIC は Tier2 プレースホルダー（未採点）");
  }
  return lines;
}
