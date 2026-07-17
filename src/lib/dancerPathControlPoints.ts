import type { DancerSpot } from "../types/choreography";

/** 前後が同じ座標とみなす閾値（%） */
export const STATIONARY_EPS = 0.08;
/** 動かない動線の制御点をマーカー外へ出す距離（%） */
export const STATIONARY_CP_OFFSET_PCT = 9;
/** 制御点がマーカー／他制御点と離れていてほしい最短距離（%） */
export const CP_CLEARANCE_PCT = 8;
/** 動線の線上から最低限ずらす垂直オフセット（%） */
export const MOVING_CP_MIN_PERP_PCT = 6;

export type PathControlPoint = { cpX: number; cpY: number };

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function midpointCp(
  ax: number,
  ay: number,
  bx: number,
  by: number
): PathControlPoint {
  return { cpX: (ax + bx) / 2, cpY: (ay + by) / 2 };
}

export function isStationaryPath(
  ax: number,
  ay: number,
  bx: number,
  by: number
): boolean {
  return Math.hypot(bx - ax, by - ay) < STATIONARY_EPS;
}

function minDistToObstacles(
  p: { x: number; y: number },
  obstacles: readonly { x: number; y: number }[]
): number {
  let best = Infinity;
  for (const o of obstacles) {
    const d = Math.hypot(p.x - o.x, p.y - o.y);
    if (d < best) best = d;
  }
  return best;
}

function stationaryCpOffset(
  index: number,
  total: number,
  ax: number,
  ay: number
): PathControlPoint {
  const angle =
    ((index + 0.5) / Math.max(1, total)) * 2 * Math.PI - Math.PI / 2;
  return {
    cpX: clamp(ax + Math.cos(angle) * STATIONARY_CP_OFFSET_PCT, 0, 100),
    cpY: clamp(ay + Math.sin(angle) * STATIONARY_CP_OFFSET_PCT, 0, 100),
  };
}

/**
 * 移動動線の制御点候補。線分の中点から垂直にずらし、必要なら沿線方向にもずらす。
 * A/B 自身や他マーカーと重ならない位置を探す。
 */
export function placeMovingControlPoint(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  obstacles: readonly { x: number; y: number }[],
  clearance = CP_CLEARANCE_PCT
): PathControlPoint {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < STATIONARY_EPS) {
    return {
      cpX: clamp(mx, 0, 100),
      cpY: clamp(my - STATIONARY_CP_OFFSET_PCT, 0, 100),
    };
  }

  const tx = dx / len;
  const ty = dy / len;
  const nx = -ty;
  const ny = tx;

  /** 短い移動では中点が A/B に近すぎるので、垂直オフセットを大きくする */
  const half = len / 2;
  const minOffForAb =
    half >= clearance
      ? MOVING_CP_MIN_PERP_PCT
      : Math.sqrt(Math.max(0, clearance * clearance - half * half));
  const baseOff = Math.max(MOVING_CP_MIN_PERP_PCT, minOffForAb);

  const alongFracs = [0, 0.18, -0.18, 0.32, -0.32];
  const magSteps: number[] = [];
  for (let m = baseOff; m <= 28; m += 3.5) magSteps.push(m);

  let best: PathControlPoint | null = null;
  let bestScore = -1;

  for (const mag of magSteps) {
    for (const side of [1, -1] as const) {
      for (const alongFrac of alongFracs) {
        const along = alongFrac * len;
        const cand = {
          x: clamp(mx + nx * side * mag + tx * along, 0, 100),
          y: clamp(my + ny * side * mag + ty * along, 0, 100),
        };
        const score = minDistToObstacles(cand, obstacles);
        if (score >= clearance) {
          return { cpX: cand.x, cpY: cand.y };
        }
        if (score > bestScore) {
          bestScore = score;
          best = { cpX: cand.x, cpY: cand.y };
        }
      }
    }
  }

  return (
    best ?? {
      cpX: clamp(mx + nx * baseOff, 0, 100),
      cpY: clamp(my + ny * baseOff, 0, 100),
    }
  );
}

function isNearPoint(
  cp: PathControlPoint,
  x: number,
  y: number,
  eps = STATIONARY_EPS
): boolean {
  return Math.hypot(cp.cpX - x, cp.cpY - y) < eps;
}

/**
 * エディタ表示用の初期制御点をまとめて作る。
 * - 保存済みのカスタム点はそのまま
 * - 未設定は前後マーカー・他制御点と重ならない位置へ配置
 * （未ドラッグのまま保存してもカスタム軌道にはしない＝直線補間のまま）
 */
export function buildInitialControlPoints(
  prevFormation: DancerSpot[],
  nextFormation: DancerSpot[],
  existingPaths?: Record<string, PathControlPoint>
): Record<string, PathControlPoint> {
  const nextById = new Map(nextFormation.map((d) => [d.id, d]));
  const pairs = prevFormation
    .map((a) => {
      const b = nextById.get(a.id);
      return b ? { a, b } : null;
    })
    .filter((p): p is { a: DancerSpot; b: DancerSpot } => p != null)
    .sort((p, q) => {
      const pmy = (p.a.yPct + p.b.yPct) / 2;
      const qmy = (q.a.yPct + q.b.yPct) / 2;
      if (Math.abs(pmy - qmy) > 0.01) return pmy - qmy;
      const pmx = (p.a.xPct + p.b.xPct) / 2;
      const qmx = (q.a.xPct + q.b.xPct) / 2;
      return pmx - qmx;
    });

  const markerObstacles: { x: number; y: number }[] = [];
  for (const { a, b } of pairs) {
    markerObstacles.push({ x: a.xPct, y: a.yPct }, { x: b.xPct, y: b.yPct });
  }

  const result: Record<string, PathControlPoint> = {};
  const placed: { x: number; y: number }[] = [];

  /** 1st pass: 明示保存されたカスタム点を固定 */
  for (const { a, b } of pairs) {
    const existing = existingPaths?.[a.id];
    if (!existing) continue;
    const mid = midpointCp(a.xPct, a.yPct, b.xPct, b.yPct);
    /** 旧デフォルト（中点）は「未カスタム」扱いして再配置する */
    if (isNearPoint(existing, mid.cpX, mid.cpY)) continue;
    result[a.id] = existing;
    placed.push({ x: existing.cpX, y: existing.cpY });
  }

  /** 静止組をスポットごとにまとめて扇形配置 */
  const stationaryGroups = new Map<string, string[]>();
  for (const { a, b } of pairs) {
    if (result[a.id]) continue;
    if (!isStationaryPath(a.xPct, a.yPct, b.xPct, b.yPct)) continue;
    const key = `${a.xPct.toFixed(2)},${a.yPct.toFixed(2)}`;
    const list = stationaryGroups.get(key) ?? [];
    list.push(a.id);
    stationaryGroups.set(key, list);
  }

  for (const { a, b } of pairs) {
    if (result[a.id]) continue;
    if (!isStationaryPath(a.xPct, a.yPct, b.xPct, b.yPct)) continue;
    const key = `${a.xPct.toFixed(2)},${a.yPct.toFixed(2)}`;
    const group = stationaryGroups.get(key) ?? [a.id];
    const index = Math.max(0, group.indexOf(a.id));
    let cp = stationaryCpOffset(index, group.length, a.xPct, a.yPct);
    const obstacles = [...markerObstacles, ...placed];
    if (
      minDistToObstacles({ x: cp.cpX, y: cp.cpY }, obstacles) < CP_CLEARANCE_PCT
    ) {
      cp = placeMovingControlPoint(
        a.xPct,
        a.yPct - 0.01,
        b.xPct,
        b.yPct + 0.01,
        obstacles
      );
    }
    result[a.id] = cp;
    placed.push({ x: cp.cpX, y: cp.cpY });
  }

  /** 移動組: 垂直オフ + 衝突回避 */
  for (const { a, b } of pairs) {
    if (result[a.id]) continue;
    const obstacles = [...markerObstacles, ...placed];
    const cp = placeMovingControlPoint(
      a.xPct,
      a.yPct,
      b.xPct,
      b.yPct,
      obstacles
    );
    result[a.id] = cp;
    placed.push({ x: cp.cpX, y: cp.cpY });
  }

  return result;
}
