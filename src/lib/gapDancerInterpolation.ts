import type { DancerSpot, GapApproachRoute } from "../types/choreography";
import {
  DEFAULT_DANCER_MARKER_DIAMETER_PX,
  MARKER_DIAMETER_PX_MAX,
  MARKER_DIAMETER_PX_MIN,
} from "./projectDefaults";

const CLAMP_X_LO = 2;
const CLAMP_X_HI = 98;
const CLAMP_Y_LO = 2;
const CLAMP_Y_HI = 98;

/** 始点・終点がほぼ同じ（％座標のユークリッド距離）なら経路を使わず固定 */
const STATIONARY_EPS_PCT = 0.055;

/**
 * ギャップ経路の法線オフセット（％）。印直径から「接触しない最小寄り」を推定する。
 * ステージ実幅 px は再生時に未保持のため参照幅で % に換算。係数は小さめでスレスレ寄り。
 */
function gapPassingSeparationPct(from: DancerSpot[], to: DancerSpot[]): number {
  let maxD = DEFAULT_DANCER_MARKER_DIAMETER_PX;
  for (const d of from) {
    if (typeof d.sizePx === "number" && Number.isFinite(d.sizePx)) {
      maxD = Math.max(
        maxD,
        Math.min(
          MARKER_DIAMETER_PX_MAX,
          Math.max(MARKER_DIAMETER_PX_MIN, d.sizePx)
        )
      );
    }
  }
  for (const d of to) {
    if (typeof d.sizePx === "number" && Number.isFinite(d.sizePx)) {
      maxD = Math.max(
        maxD,
        Math.min(
          MARKER_DIAMETER_PX_MAX,
          Math.max(MARKER_DIAMETER_PX_MIN, d.sizePx)
        )
      );
    }
  }
  const stageRefWpx = 920;
  const diameterAsPct = (maxD / stageRefWpx) * 100;
  const pad = 0.12;
  const tight = 0.4 * diameterAsPct + pad;
  return Math.min(11, Math.max(2.22, tight));
}

export const VALID_GAP_APPROACH_ROUTES: readonly GapApproachRoute[] = [
  "linear",
  "kamite_half_via_audience",
  "shimote_half_via_audience",
  "kamite_half_via_upstage",
  "shimote_half_via_upstage",
  "front_half_via_kamite",
  "front_half_via_shimote",
  "detour_bulge",
] as const;

export function parseGapApproachRoute(raw: unknown): GapApproachRoute | undefined {
  if (typeof raw !== "string") return undefined;
  return (VALID_GAP_APPROACH_ROUTES as readonly string[]).includes(raw)
    ? (raw as GapApproachRoute)
    : undefined;
}

/** キュー間の個人別ベジェ制御点（正規化・クラウド保存用） */
export function parseDancerCustomPaths(
  raw: unknown
): Record<string, { cpX: number; cpY: number }> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, { cpX: number; cpY: number }> = {};
  for (const [dancerId, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!dancerId || typeof v !== "object" || v == null) continue;
    const cp = v as { cpX?: unknown; cpY?: unknown };
    if (
      typeof cp.cpX !== "number" ||
      !Number.isFinite(cp.cpX) ||
      typeof cp.cpY !== "number" ||
      !Number.isFinite(cp.cpY)
    ) {
      continue;
    }
    out[dancerId] = {
      cpX: Math.max(CLAMP_X_LO, Math.min(CLAMP_X_HI, cp.cpX)),
      cpY: Math.max(CLAMP_Y_LO, Math.min(CLAMP_Y_HI, cp.cpY)),
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export const GAP_APPROACH_OPTIONS: {
  id: GapApproachRoute;
  label: string;
}[] = [
  { id: "linear", label: "真っ直ぐ（線形・最短）" },
  {
    id: "kamite_half_via_audience",
    label: "上手にいたメンバーは客席側を経由",
  },
  {
    id: "shimote_half_via_audience",
    label: "下手にいたメンバーは客席側を経由",
  },
  {
    id: "kamite_half_via_upstage",
    label: "上手にいたメンバーは奥を経由",
  },
  {
    id: "shimote_half_via_upstage",
    label: "下手にいたメンバーは奥を経由",
  },
  {
    id: "front_half_via_kamite",
    label: "手前側にいたメンバーは上手側を経由",
  },
  {
    id: "front_half_via_shimote",
    label: "手前側にいたメンバーは下手側を経由",
  },
  {
    id: "detour_bulge",
    label: "全員やや遠回り（中間を客席側へ膨らむ）",
  },
];

function clampXY(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(CLAMP_X_HI, Math.max(CLAMP_X_LO, x)),
    y: Math.min(CLAMP_Y_HI, Math.max(CLAMP_Y_LO, y)),
  };
}

function lerpN(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 折れ線 p0 → pm → p1 を α∈[0,1] で等速移動 */
function piecewise2(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  xm: number,
  ym: number,
  alpha: number
): { x: number; y: number } {
  if (alpha <= 0.5) {
    const t = alpha * 2;
    return { x: lerpN(x0, xm, t), y: lerpN(y0, ym, t) };
  }
  const t = (alpha - 0.5) * 2;
  return { x: lerpN(xm, x1, t), y: lerpN(ym, y1, t) };
}

function median(nums: number[]): number {
  if (nums.length === 0) return 50;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[m]!;
  return (s[m - 1]! + s[m]!) / 2;
}

function pairXY(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  alpha: number,
  route: GapApproachRoute,
  medX: number,
  medY: number,
  sepPct: number
): { x: number; y: number } {
  if (Math.hypot(ax - bx, ay - by) < STATIONARY_EPS_PCT) {
    return clampXY(lerpN(ax, bx, alpha), lerpN(ay, by, alpha));
  }

  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;

  if (route === "linear") {
    return clampXY(lerpN(ax, bx, alpha), lerpN(ay, by, alpha));
  }

  if (route === "detour_bulge") {
    const p = piecewise2(ax, ay, bx, by, mx, my + sepPct, alpha);
    return clampXY(p.x, p.y);
  }

  if (route === "kamite_half_via_audience") {
    if (ax >= medX) {
      const p = piecewise2(ax, ay, bx, by, mx, my + sepPct, alpha);
      return clampXY(p.x, p.y);
    }
    return clampXY(lerpN(ax, bx, alpha), lerpN(ay, by, alpha));
  }

  if (route === "shimote_half_via_audience") {
    if (ax < medX) {
      const p = piecewise2(ax, ay, bx, by, mx, my + sepPct, alpha);
      return clampXY(p.x, p.y);
    }
    return clampXY(lerpN(ax, bx, alpha), lerpN(ay, by, alpha));
  }

  if (route === "kamite_half_via_upstage") {
    if (ax >= medX) {
      const p = piecewise2(ax, ay, bx, by, mx, my - sepPct, alpha);
      return clampXY(p.x, p.y);
    }
    return clampXY(lerpN(ax, bx, alpha), lerpN(ay, by, alpha));
  }

  if (route === "shimote_half_via_upstage") {
    if (ax < medX) {
      const p = piecewise2(ax, ay, bx, by, mx, my - sepPct, alpha);
      return clampXY(p.x, p.y);
    }
    return clampXY(lerpN(ax, bx, alpha), lerpN(ay, by, alpha));
  }

  if (route === "front_half_via_kamite") {
    if (ay >= medY) {
      const p = piecewise2(ax, ay, bx, by, mx + sepPct, my, alpha);
      return clampXY(p.x, p.y);
    }
    return clampXY(lerpN(ax, bx, alpha), lerpN(ay, by, alpha));
  }

  if (route === "front_half_via_shimote") {
    if (ay >= medY) {
      const p = piecewise2(ax, ay, bx, by, mx - sepPct, my, alpha);
      return clampXY(p.x, p.y);
    }
    return clampXY(lerpN(ax, bx, alpha), lerpN(ay, by, alpha));
  }

  return clampXY(lerpN(ax, bx, alpha), lerpN(ay, by, alpha));
}

/**
 * 二次ベジェ補間（制御点1個）。
 * p0: 始点, cp: 制御点, p1: 終点, t: [0,1]
 */
function quadBezier(
  p0: { x: number; y: number },
  cp: { x: number; y: number },
  p1: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * cp.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * cp.y + t * t * p1.y,
  };
}

/**
 * ギャップ区間での立ち位置補間（区間内ラベル・色などは従来どおり lerp / 閾値切替）。
 * customPaths: ダンサーIDごとの個人軌道制御点。指定があるダンサーはベジェ補間を優先。
 *
 * 同じ id 同士を優先して結び、残りは最寄りの未使用スロットへ結ぶ。
 * （配列インデックスだけで結ぶと、雛形適用後に並びが変わったとき別人同士が補間され、
 * 移動の途中で急に別の場所へ入る見た目になる）
 */
export function lerpDancersAcrossGap(
  from: DancerSpot[],
  to: DancerSpot[],
  alpha: number,
  route: GapApproachRoute | undefined,
  customPaths?: Record<string, { cpX: number; cpY: number }>
): DancerSpot[] {
  const r: GapApproachRoute = route ?? "linear";
  const xs = from.map((d) => d.xPct);
  const ys = from.map((d) => d.yPct);
  const medX = median(xs);
  const medY = median(ys);
  const sepPct = gapPassingSeparationPct(from, to);

  function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  function lerpPair(a: DancerSpot, b: DancerSpot): DancerSpot {
    const note =
      alpha < 0.5
        ? a.note?.trim()
          ? a.note
          : undefined
        : b.note?.trim()
          ? b.note
          : undefined;
    const sizePx =
      a.sizePx != null && b.sizePx != null
        ? lerp(a.sizePx, b.sizePx, alpha)
        : alpha < 0.5
          ? a.sizePx
          : b.sizePx;
    const nameBelowFontPx =
      a.nameBelowFontPx != null && b.nameBelowFontPx != null
        ? Math.round(lerp(a.nameBelowFontPx, b.nameBelowFontPx, alpha))
        : alpha < 0.5
          ? a.nameBelowFontPx
          : b.nameBelowFontPx;
    const centerDistanceGap =
      a.markerBadgeSource === "centerDistance" ||
      b.markerBadgeSource === "centerDistance";

    const cp = customPaths?.[a.id];
    const xy = cp
      ? clampXY(
          quadBezier(
            { x: a.xPct, y: a.yPct },
            { x: cp.cpX, y: cp.cpY },
            { x: b.xPct, y: b.yPct },
            alpha
          ).x,
          quadBezier(
            { x: a.xPct, y: a.yPct },
            { x: cp.cpX, y: cp.cpY },
            { x: b.xPct, y: b.yPct },
            alpha
          ).y
        )
      : pairXY(
          a.xPct,
          a.yPct,
          b.xPct,
          b.yPct,
          alpha,
          r,
          medX,
          medY,
          sepPct
        );

    return {
      id: a.id,
      label: a.label,
      xPct: xy.x,
      yPct: xy.y,
      colorIndex: a.colorIndex,
      crewMemberId: a.crewMemberId ?? undefined,
      ...(note ? { note } : {}),
      ...(typeof sizePx === "number" ? { sizePx } : {}),
      ...(typeof nameBelowFontPx === "number" ? { nameBelowFontPx } : {}),
      ...(centerDistanceGap
        ? {
            markerBadgeSource: "centerDistance" as const,
            centerDistanceLabelXPct: a.xPct,
          }
        : {
            ...(a.markerBadge !== undefined
              ? { markerBadge: a.markerBadge }
              : {}),
            ...(a.markerBadgeSource
              ? { markerBadgeSource: a.markerBadgeSource }
              : {}),
          }),
    };
  }

  const toById = new Map(to.map((d) => [d.id, d] as const));
  const usedTo = new Set<string>();
  const out: DancerSpot[] = [];

  // 1) 同じ id を優先して結ぶ（前キューの並び順を維持）
  const fromUnmatched: DancerSpot[] = [];
  for (const a of from) {
    const b = toById.get(a.id);
    if (b) {
      usedTo.add(a.id);
      out.push(lerpPair(a, b));
    } else {
      fromUnmatched.push(a);
    }
  }

  const toUnmatched = to.filter((d) => !usedTo.has(d.id));

  // 2) id が無い組は最寄りで結ぶ（人数増減の余り）
  if (fromUnmatched.length > 0 && toUnmatched.length > 0) {
    type Pair = { fi: number; ti: number; dist: number };
    const pairs: Pair[] = [];
    for (let fi = 0; fi < fromUnmatched.length; fi++) {
      const a = fromUnmatched[fi]!;
      for (let ti = 0; ti < toUnmatched.length; ti++) {
        const b = toUnmatched[ti]!;
        const dx = a.xPct - b.xPct;
        const dy = a.yPct - b.yPct;
        pairs.push({ fi, ti, dist: dx * dx + dy * dy });
      }
    }
    pairs.sort((x, y) => x.dist - y.dist || x.fi - y.fi || x.ti - y.ti);
    const usedF = new Set<number>();
    const usedT = new Set<number>();
    for (const p of pairs) {
      if (usedF.has(p.fi) || usedT.has(p.ti)) continue;
      usedF.add(p.fi);
      usedT.add(p.ti);
      out.push(lerpPair(fromUnmatched[p.fi]!, toUnmatched[p.ti]!));
    }
    for (let fi = 0; fi < fromUnmatched.length; fi++) {
      if (!usedF.has(fi)) out.push({ ...fromUnmatched[fi]! });
    }
    for (let ti = 0; ti < toUnmatched.length; ti++) {
      if (!usedT.has(ti)) out.push({ ...toUnmatched[ti]! });
    }
  } else {
    for (const a of fromUnmatched) out.push({ ...a });
    for (const b of toUnmatched) out.push({ ...b });
  }

  return out;
}
