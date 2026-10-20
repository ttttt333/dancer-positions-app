/**
 * ドラッグ中のセンター／他ダンサー揃えガイド。
 * しきい値内に入ったときだけガイドを出し、座標もその線へ軽く吸い付かせる。
 */

/** ガイド表示＋吸い付きの距離（%）。広いと「ズレていても出る」感じになる */
export const ALIGNMENT_GUIDE_THRESHOLD_PCT = 0.4;

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
  thresholdPct: number = ALIGNMENT_GUIDE_THRESHOLD_PCT
): { guideX: number | null; guideY: number | null } {
  return {
    guideX: nearestGuide(xPct, [50, ...peerXPcts], thresholdPct),
    guideY: nearestGuide(yPct, [50, ...peerYPcts], thresholdPct),
  };
}

/**
 * ガイドが付いた軸はガイド座標へ吸い付かせる。
 * しきい値が狭いので、ぴったりの近くでのみ吸着する。
 */
export function resolveAlignmentGuidesWithSnap(
  xPct: number,
  yPct: number,
  peerXPcts: readonly number[],
  peerYPcts: readonly number[],
  thresholdPct: number = ALIGNMENT_GUIDE_THRESHOLD_PCT
): {
  xPct: number;
  yPct: number;
  guideX: number | null;
  guideY: number | null;
} {
  const { guideX, guideY } = resolveAlignmentGuides(
    xPct,
    yPct,
    peerXPcts,
    peerYPcts,
    thresholdPct
  );
  return {
    xPct: guideX != null ? guideX : xPct,
    yPct: guideY != null ? guideY : yPct,
    guideX,
    guideY,
  };
}
