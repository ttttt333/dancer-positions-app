/**
 * 移動量の表示グレード。座標計算ではない。
 * `movementCostPct`（ステージ % のユークリッド距離）を見た目の 小/中/大 にする。
 * 閾値はここだけ変えられる。
 */
export type MovementGrade = "小" | "中" | "大";

export const MOVEMENT_GRADE_SMALL_MAX_PCT = 8;
export const MOVEMENT_GRADE_MEDIUM_MAX_PCT = 25;

export function classifyMovementCostPct(costPct: number): MovementGrade {
  if (costPct < MOVEMENT_GRADE_SMALL_MAX_PCT) return "小";
  if (costPct < MOVEMENT_GRADE_MEDIUM_MAX_PCT) return "中";
  return "大";
}
