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

export const GAP_APPROACH_OPTIONS: {
  id: GapApproachRoute;
  label: string;
}[] = [
  { id: "linear", label: "真っ直ぐ（線形・最短）" },
  {
    id: "kamite_half_via_audience",
    label: "上手（画面右・x大）にいたメンバーは客席側（手前）を経由",
  },
  {
    id: "shimote_half_via_audience",
    label: "下手（画面左・x小）にいたメンバーは客席側を経由",
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
    label: "手前側（客席寄り・y大）にいたメンバーは上手側（x大）を経由",
  },
  {
    id: "front_half_via_shimote",
    label: "手前側にいたメンバーは下手側（x小）を経由",
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
 * ギャップ区間での立ち位置補間（区間内ラベル・色などは従来どおり lerp / 閾値切替）。
 */
export function lerpDancersAcrossGap(
  from: DancerSpot[],
  to: DancerSpot[],
  alpha: number,
  route: GapApproachRoute | undefined
): DancerSpot[] {
  const r: GapApproachRoute = route ?? "linear";
  const xs = from.map((d) => d.xPct);
  const ys = from.map((d) => d.yPct);
  const medX = median(xs);
  const medY = median(ys);
  const sepPct = gapPassingSeparationPct(from, to);

  const n = Math.max(from.length, to.length);
  const out: DancerSpot[] = [];

  function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  for (let i = 0; i < n; i++) {
    const a = from[i];
    const b = to[i];
    if (a && b) {
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
      const markerBadge = alpha < 0.5 ? a.markerBadge : b.markerBadge;
      const markerBadgeSource =
        alpha < 0.5 ? a.markerBadgeSource : b.markerBadgeSource;

      const xy = pairXY(
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

      out.push({
        id: a.id,
        label: alpha < 0.5 ? a.label : b.label,
        xPct: xy.x,
        yPct: xy.y,
        colorIndex: alpha < 0.5 ? a.colorIndex : b.colorIndex,
        crewMemberId:
          alpha < 0.5 ? a.crewMemberId ?? undefined : b.crewMemberId ?? undefined,
        ...(note ? { note } : {}),
        ...(typeof sizePx === "number" ? { sizePx } : {}),
        ...(markerBadge !== undefined ? { markerBadge } : {}),
        ...(markerBadgeSource ? { markerBadgeSource } : {}),
      });
    } else if (a) {
      out.push({ ...a });
    } else if (b) {
      out.push({ ...b });
    }
  }
  return out;
}
