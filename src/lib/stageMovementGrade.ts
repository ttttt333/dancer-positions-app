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

/**
 * A→B の変化の大きさ（事実）。良し悪しではない。
 * maxMovePct は既存 movementCostPct。閾値は classifyMovementCostPct と同じ。
 */
export function describePrevCueChangeFact(opts: {
  movedCount: number;
  maxMovePct: number;
}): string {
  if (opts.movedCount <= 0) return "位置はほぼそのまま";
  const grade = classifyMovementCostPct(opts.maxMovePct);
  if (grade === "大") return "この変化は大きい";
  if (grade === "中") return "この変化は中くらい";
  return "この変化は小さい";
}
