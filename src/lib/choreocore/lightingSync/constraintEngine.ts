/**
 * ClassProfile 制約エンジン — 移動距離超過の警告 / 補正ポインタ
 */

import type {
  ClassProfile,
  ConstraintWarning,
  MemberPosition,
} from "./types";

function dist(a: MemberPosition, b: MemberPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 前フレーム→次フレームの移動が制約を超える場合に警告と補正ヒントを返す。
 * 補正: 制限距離まで線形に縮めるポインタ。
 */
export function evaluateMoveConstraints(
  prev: MemberPosition[],
  next: MemberPosition[],
  profile: ClassProfile,
  availableCounts: number
): {
  warnings: ConstraintWarning[];
  corrected: MemberPosition[];
} {
  const maxDist = Math.max(
    0.2,
    profile.maxMoveDistancePerCount * Math.max(1, availableCounts)
  );
  const byPrev = new Map(prev.map((p) => [p.memberId, p] as const));
  const warnings: ConstraintWarning[] = [];
  const corrected: MemberPosition[] = [];
  const pointers: Array<{ memberId: string; x: number; y: number }> = [];

  for (const n of next) {
    const p = byPrev.get(n.memberId);
    if (!p) {
      corrected.push({ ...n });
      continue;
    }
    const d = dist(p, n);
    if (d <= maxDist + 1e-6) {
      corrected.push({ ...n });
      continue;
    }
    // 補正: p から n 方向に maxDist だけ進む
    const t = maxDist / d;
    const cx = p.x + (n.x - p.x) * t;
    const cy = p.y + (n.y - p.y) * t;
    pointers.push({ memberId: n.memberId, x: cx, y: cy });
    corrected.push({
      ...n,
      x: cx,
      y: cy,
    });
    warnings.push({
      code: "MOVE_LIMIT",
      message: `${n.memberId}: 移動 ${d.toFixed(2)}m > 上限 ${maxDist.toFixed(2)}m（${availableCounts}カウント）`,
      memberIds: [n.memberId],
      correctionPointers: [{ memberId: n.memberId, x: cx, y: cy }],
    });
  }

  if (!profile.allowCrossMovement) {
    // 簡易交差: 2人の移動線分が交差したら警告（補正はしない／クロス禁止クラス）
    for (let i = 0; i < prev.length; i++) {
      for (let j = i + 1; j < prev.length; j++) {
        const a0 = prev[i]!;
        const b0 = prev[j]!;
        const a1 = corrected.find((c) => c.memberId === a0.memberId);
        const b1 = corrected.find((c) => c.memberId === b0.memberId);
        if (!a1 || !b1) continue;
        if (segmentsCross(a0, a1, b0, b1)) {
          warnings.push({
            code: "CROSS_FORBIDDEN",
            message: `交差移動が検出: ${a0.memberId} × ${b0.memberId}（クラス設定で禁止）`,
            memberIds: [a0.memberId, b0.memberId],
          });
        }
      }
    }
  }

  if (pointers.length > 0) {
    // 集約ポインタ警告も1件
    warnings.push({
      code: "MOVE_LIMIT",
      message: `${pointers.length}名の移動を上限内に補正しました`,
      correctionPointers: pointers,
    });
  }

  return { warnings, corrected };
}

function orient(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function segmentsCross(
  a0: MemberPosition,
  a1: MemberPosition,
  b0: MemberPosition,
  b1: MemberPosition
): boolean {
  const o1 = orient(a0.x, a0.y, a1.x, a1.y, b0.x, b0.y);
  const o2 = orient(a0.x, a0.y, a1.x, a1.y, b1.x, b1.y);
  const o3 = orient(b0.x, b0.y, b1.x, b1.y, a0.x, a0.y);
  const o4 = orient(b0.x, b0.y, b1.x, b1.y, a1.x, a1.y);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/**
 * FCP 間隔が minCountsBetweenChanges 未満なら警告。
 */
export function evaluateGapConstraint(
  countA: number,
  countB: number,
  profile: ClassProfile
): ConstraintWarning | null {
  const gap = Math.abs(countB - countA);
  if (gap >= profile.minCountsBetweenChanges) return null;
  return {
    code: "MIN_GAP",
    message: `変更間隔 ${gap}カウント < 最低 ${profile.minCountsBetweenChanges}カウント`,
  };
}
