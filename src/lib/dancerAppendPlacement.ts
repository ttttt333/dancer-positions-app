import type { DancerSpot } from "../types/choreography";

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * 既存の立ち位置を動かさず、追加 1 人を置く座標（％）。
 * 候補点のうち、最も既存印から離れた位置を選ぶ（重なりにくくする）。
 */
export function pickSpotForAppendedDancer(
  existing: DancerSpot[]
): { xPct: number; yPct: number } {
  if (existing.length === 0) {
    return { xPct: 50, yPct: 58 };
  }
  const candidates: [number, number][] = [];
  for (let x = 12; x <= 88; x += 10) {
    for (let y = 14; y <= 82; y += 10) {
      candidates.push([x, y]);
    }
  }
  candidates.push(
    [8, 72],
    [92, 72],
    [8, 24],
    [92, 24],
    [50, 18],
    [50, 78]
  );

  let bestX = 82;
  let bestY = 68;
  let bestScore = -1;
  for (const [x0, y0] of candidates) {
    const x = clamp(x0, 8, 92);
    const y = clamp(y0, 10, 88);
    const minDist = Math.min(
      ...existing.map((d) => {
        const dx = d.xPct - x;
        const dy = d.yPct - y;
        return Math.hypot(dx, dy);
      })
    );
    if (minDist > bestScore) {
      bestScore = minDist;
      bestX = x;
      bestY = y;
    }
  }
  return { xPct: bestX, yPct: bestY };
}
