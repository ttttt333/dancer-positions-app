import type { Cue, DancerSpot, Formation } from "../types/choreography";
import { sortCuesByStart } from "../core/timelineController";
import { lerpDancersAcrossGap } from "./gapDancerInterpolation";

function formationById(
  formations: Formation[],
  id: string
): Formation | undefined {
  return formations.find((f) => f.id === id);
}

/** 再生時のサブピクセル振れを抑える（% は小数2桁まで） */
function roundSpots(spots: DancerSpot[]): DancerSpot[] {
  return spots.map((d) => ({
    ...d,
    xPct: Math.round(d.xPct * 100) / 100,
    yPct: Math.round(d.yPct * 100) / 100,
    ...(typeof d.sizePx === "number" ? { sizePx: d.sizePx } : {}),
  }));
}

/**
 * 再生時刻 t（秒）→ ステージに描くダンサー配置。
 * 各区間 [tStart, tEnd] 内は一定。区間の隙間 (tEnd, next.tStart) は `next.gapApproachFromPrev` に応じて補間。
 */
export function dancersAtTime(
  t: number,
  cues: Cue[],
  formations: Formation[],
  fallbackFormationId: string
): DancerSpot[] {
  const sorted = sortCuesByStart(cues);
  const fb = formationById(formations, fallbackFormationId);

  if (sorted.length === 0) {
    return roundSpots(fb?.dancers ?? []);
  }

  const first = sorted[0];
  if (t < first.tStartSec) {
    const f = formationById(formations, first.formationId);
    return roundSpots(f?.dancers ?? fb?.dancers ?? []);
  }

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    if (t >= cur.tStartSec && t <= cur.tEndSec) {
      const f = formationById(formations, cur.formationId);
      return roundSpots(f?.dancers ?? []);
    }
    const next = sorted[i + 1];
    if (next && t > cur.tEndSec && t < next.tStartSec) {
      const f0 = formationById(formations, cur.formationId);
      const f1 = formationById(formations, next.formationId);
      const g0 = cur.tEndSec;
      const g1 = next.tStartSec;
      const span = g1 - g0;
      const alpha = span > 1e-6 ? (t - g0) / span : 1;
      return roundSpots(
        lerpDancersAcrossGap(
          f0?.dancers ?? [],
          f1?.dancers ?? [],
          alpha,
          next.gapApproachFromPrev
        )
      );
    }
  }

  const last = sorted[sorted.length - 1];
  if (t > last.tEndSec) {
    const f = formationById(formations, last.formationId);
    return roundSpots(f?.dancers ?? fb?.dancers ?? []);
  }

  return roundSpots(fb?.dancers ?? []);
}
