/**
 * ドラッグ中のセンター／他ダンサー揃えガイド。
 * 近い候補があればガイド座標だけ返し、位置自体は動かさない。
 */

const DEFAULT_THRESHOLD_PCT = 1.2;

function nearestGuide(
  value: number,
  candidates: readonly number[],
  threshold: number
): number | null {
  let bestDist = threshold;
  let guide: number | null = null;
  for (const c of candidates) {
    const dist = Math.abs(value - c);
    if (dist < bestDist) {
      bestDist = dist;
      guide = c;
    }
  }
  return guide;
}

export function resolveAlignmentGuides(
  xPct: number,
  yPct: number,
  peerXPcts: readonly number[],
  peerYPcts: readonly number[],
  thresholdPct: number = DEFAULT_THRESHOLD_PCT
): { guideX: number | null; guideY: number | null } {
  return {
    guideX: nearestGuide(xPct, [50, ...peerXPcts], thresholdPct),
    guideY: nearestGuide(yPct, [50, ...peerYPcts], thresholdPct),
  };
}
