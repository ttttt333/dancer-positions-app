/**
 * 客席視点からの被り回避 + 3D leveling（しゃがみ/立ち）
 */

import type { ClassProfile, MemberPosition, PoseLevel } from "./types";

const AUDIENCE: { x: number; y: number } = { x: 0, y: -8 };

function nearlyCollinear(
  front: MemberPosition,
  back: MemberPosition,
  cam = AUDIENCE,
  tol = 0.35
): boolean {
  // カメラから front への方向と、カメラから back への方向の横ずれ
  const vfx = front.x - cam.x;
  const vfy = front.y - cam.y;
  const vbx = back.x - cam.x;
  const vby = back.y - cam.y;
  const lf = Math.hypot(vfx, vfy) || 1;
  const lb = Math.hypot(vbx, vby) || 1;
  // 正規化方向差
  const dx = vfx / lf - vbx / lb;
  const dy = vfy / lf - vby / lb;
  return Math.hypot(dx, dy) < tol && back.y > front.y;
}

/**
 * 視線上の重なりを x オフセット、または poseLevel で解消。
 */
export function resolveOverlaps(
  positions: MemberPosition[],
  profile: ClassProfile,
  minDx = 0.55
): MemberPosition[] {
  const sorted = [...positions].sort((a, b) => a.y - b.y || a.x - b.x);
  const out = sorted.map((p) => ({ ...p }));

  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const front = out[i]!;
      const back = out[j]!;
      // front は客席に近い = y が小さい（ステージ手前が +y なので実際は y 大が手前）
      // 仕様: C=(0,-Yc) 客席。+y 手前なら客席は -y 側。手前は y 大。
      const nearer = front.y >= back.y ? front : back;
      const farther = front.y >= back.y ? back : front;
      if (!nearlyCollinear(nearer, farther)) continue;

      if (profile.use3DLeveling) {
        nearer.poseLevel = "crouch" as PoseLevel;
        farther.poseLevel = "stand" as PoseLevel;
      } else {
        // x 方向に押し出し
        const dir = farther.x >= nearer.x ? 1 : -1;
        farther.x += dir * minDx;
        if (Math.abs(farther.x) > 5.5) {
          farther.x = Math.sign(farther.x) * 5.5;
          nearer.x -= dir * minDx * 0.5;
        }
      }
    }
  }

  // 前列（客席寄り = y 大）: crouch / 後列（奥 = y 小）: stand
  if (profile.use3DLeveling && out.length >= 2) {
    const ys = out.map((p) => p.y).sort((a, b) => a - b);
    const mid = ys[Math.floor(ys.length / 2)]!;
    for (const p of out) {
      if (p.poseLevel === "sit") continue;
      p.poseLevel = p.y >= mid ? "crouch" : "stand";
    }
  }

  return out;
}
