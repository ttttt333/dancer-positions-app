/**
 * 隊形の物理安全（最小距離）と、プロ向け左右対称クリーンアップ。
 */

import { STAGE_DEPTH_M, STAGE_WIDTH_M } from "../../types";

/** ダンサー間の物理的な最小距離（メートル） */
export const DANCER_MIN_DISTANCE = 0.8;

/** 中心とみなす許容（メートル） */
const CENTER_EPS_M = 0.12;

function pctDeltaToMeters(dxPct: number, dyPct: number): { dx: number; dy: number } {
  return {
    dx: (dxPct / 100) * STAGE_WIDTH_M,
    dy: (dyPct / 100) * STAGE_DEPTH_M,
  };
}

/** 雛形内で最も近い2人の距離（メートル） */
export function minPairDistanceMeters(
  spots: ReadonlyArray<{ xPct: number; yPct: number }>
): number {
  let min = Infinity;
  for (let i = 0; i < spots.length; i += 1) {
    const a = spots[i]!;
    for (let j = i + 1; j < spots.length; j += 1) {
      const b = spots[j]!;
      const { dx, dy } = pctDeltaToMeters(a.xPct - b.xPct, a.yPct - b.yPct);
      const d = Math.hypot(dx, dy);
      if (d < min) min = d;
    }
  }
  return Number.isFinite(min) ? min : Infinity;
}

/**
 * 縮小後も DANCER_MIN_DISTANCE を下回らないよう scale を下限クランプ。
 * 拡大（requestedScale >= 1）はそのまま通す。
 */
export function clampScaleForMinDistance(
  minTemplateDistance: number,
  requestedScale: number
): number {
  if (!Number.isFinite(requestedScale) || requestedScale <= 0) return 1;
  if (requestedScale >= 1) return requestedScale;
  if (!Number.isFinite(minTemplateDistance) || minTemplateDistance <= 1e-6) {
    return requestedScale;
  }
  const minAllowedScale = DANCER_MIN_DISTANCE / minTemplateDistance;
  return Math.max(requestedScale, minAllowedScale);
}

function scaleRawPct<T extends { xPct: number; yPct: number }>(
  spots: T[],
  factor: number
): T[] {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return spots.map((s) => ({
    ...s,
    xPct: Math.min(96, Math.max(4, 50 + (s.xPct - 50) * f)),
    yPct: Math.min(94, Math.max(6, 50 + (s.yPct - 50) * f)),
  }));
}

/**
 * 中心から拡縮。CONTRACT 等の縮小では最小距離バウンダリを適用し、最後に左右対称を強制する。
 */
export function scaleSpotsFromCenterSafe<T extends { xPct: number; yPct: number }>(
  spots: T[],
  requestedScale: number
): T[] {
  const minTemplateDistance = minPairDistanceMeters(spots);
  const scale = clampScaleForMinDistance(minTemplateDistance, requestedScale);
  return enforceSymmetryPct(scaleRawPct(spots, scale));
}

/**
 * 右側をマスターとして左側を鏡面コピー。センター近くは x=50% に固定。
 * ランダム揺らぎは入れない。
 */
export function enforceSymmetryPct<T extends { xPct: number; yPct: number }>(
  spots: T[]
): T[] {
  if (spots.length === 0) return spots;
  const CENTER = 50;
  const epsPct = (CENTER_EPS_M / STAGE_WIDTH_M) * 100;
  const out = spots.map((s) => ({ ...s }));

  let centerIdx = -1;
  let centerDist = Infinity;
  for (let i = 0; i < out.length; i += 1) {
    const d = Math.abs(out[i]!.xPct - CENTER);
    if (d <= epsPct && d < centerDist) {
      centerDist = d;
      centerIdx = i;
    }
  }
  if (centerIdx >= 0) {
    out[centerIdx]!.xPct = CENTER;
  }

  const rights = out
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => i !== centerIdx && s.xPct > CENTER + epsPct);
  const lefts = out
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => i !== centerIdx && s.xPct < CENTER - epsPct);

  rights.sort((a, b) => a.s.yPct - b.s.yPct || a.s.xPct - b.s.xPct);
  const usedLeft = new Set<number>();

  for (const r of rights) {
    const mx = r.s.xPct - CENTER;
    const targetX = CENTER - mx;
    let best = -1;
    let bestScore = Infinity;
    for (const l of lefts) {
      if (usedLeft.has(l.i)) continue;
      const score = Math.hypot(l.s.xPct - targetX, l.s.yPct - r.s.yPct);
      if (score < bestScore) {
        bestScore = score;
        best = l.i;
      }
    }
    if (best >= 0) {
      usedLeft.add(best);
      out[best]!.xPct = targetX;
      out[best]!.yPct = r.s.yPct;
    }
  }

  return out;
}

/**
 * メートル座標（原点=ステージ中央）版の左右対称ロック。
 */
export function enforceSymmetryMeters<T extends { x: number; y: number }>(
  points: T[]
): T[] {
  if (points.length === 0) return points;
  const out = points.map((p) => ({ ...p }));

  let centerIdx = -1;
  let centerDist = Infinity;
  for (let i = 0; i < out.length; i += 1) {
    const d = Math.abs(out[i]!.x);
    if (d <= CENTER_EPS_M && d < centerDist) {
      centerDist = d;
      centerIdx = i;
    }
  }
  if (centerIdx >= 0) {
    out[centerIdx]!.x = 0;
  }

  const rights = out
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => i !== centerIdx && p.x > CENTER_EPS_M);
  const lefts = out
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => i !== centerIdx && p.x < -CENTER_EPS_M);

  rights.sort((a, b) => a.p.y - b.p.y || a.p.x - b.p.x);
  const usedLeft = new Set<number>();

  for (const r of rights) {
    const targetX = -r.p.x;
    let best = -1;
    let bestScore = Infinity;
    for (const l of lefts) {
      if (usedLeft.has(l.i)) continue;
      const score = Math.hypot(l.p.x - targetX, l.p.y - r.p.y);
      if (score < bestScore) {
        bestScore = score;
        best = l.i;
      }
    }
    if (best >= 0) {
      usedLeft.add(best);
      out[best]!.x = targetX;
      out[best]!.y = r.p.y;
    }
  }

  return out;
}
