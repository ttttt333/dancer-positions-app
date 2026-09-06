export interface MotionDynamicsResult {
  movingRatio: number;
  averageDistanceMeters: number;
  scoreAdjustment: number;
}

/**
 * 前の Cue からの移動参加率と群舞全体のダイナミクスを評価。
 * 「16人中2人しか動かない」局所移動を減点する。
 */
export function evaluateMotionDynamics(
  prevSpots: Array<{ xPct: number; yPct: number }>,
  candSpots: Array<{ xPct: number; yPct: number }>,
  stageSizeMeters = 10.0
): MotionDynamicsResult {
  if (
    !prevSpots ||
    prevSpots.length === 0 ||
    prevSpots.length !== candSpots.length
  ) {
    return { movingRatio: 1.0, averageDistanceMeters: 0, scoreAdjustment: 0 };
  }

  const total = candSpots.length;
  // 0.5m 以上の移動を「意味のある移動」と判定 (10m舞台なら 5%)
  const minMovePct = (0.5 / stageSizeMeters) * 100;

  let movingCount = 0;
  let totalDistMeters = 0;

  for (let i = 0; i < total; i += 1) {
    const dx = candSpots[i]!.xPct - prevSpots[i]!.xPct;
    const dy = candSpots[i]!.yPct - prevSpots[i]!.yPct;
    const distPct = Math.sqrt(dx * dx + dy * dy);
    const distMeters = (distPct / 100) * stageSizeMeters;

    totalDistMeters += distMeters;
    if (distPct >= minMovePct) {
      movingCount += 1;
    }
  }

  const movingRatio = movingCount / total;
  const avgDistMeters = totalDistMeters / total;

  let scoreAdjustment = 0;

  // 1. 移動参加率の判定 (大人数のうち一部しか動かない配置を排除)
  if (movingRatio < 0.35) {
    // 35% 未満しか動いていない場合は群舞の構成変化として不適切
    scoreAdjustment -= 0.35;
  } else if (movingRatio >= 0.7) {
    // 70% 以上が綺麗に連携移動している場合はボーナス
    scoreAdjustment += 0.15;
  }

  // 2. 移動量が全体的に短すぎて変化が分からない場合
  if (avgDistMeters < 0.3) {
    scoreAdjustment -= 0.2;
  }

  return {
    movingRatio: Number(movingRatio.toFixed(2)),
    averageDistanceMeters: Number(avgDistMeters.toFixed(2)),
    scoreAdjustment: Number(scoreAdjustment.toFixed(3)),
  };
}
