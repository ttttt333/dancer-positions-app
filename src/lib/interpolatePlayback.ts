import type { Cue, DancerSpot, Formation } from "../types/choreography";
import { sortCuesByStart } from "./cueInterval";

function formationById(
  formations: Formation[],
  id: string
): Formation | undefined {
  return formations.find((f) => f.id === id);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
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

function lerpFormations(
  from: DancerSpot[],
  to: DancerSpot[],
  alpha: number
): DancerSpot[] {
  const n = Math.max(from.length, to.length);
  const out: DancerSpot[] = [];
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
      const markerBadge =
        alpha < 0.5 ? a.markerBadge : b.markerBadge;
      const markerBadgeSource =
        alpha < 0.5 ? a.markerBadgeSource : b.markerBadgeSource;
      out.push({
        id: a.id,
        label: alpha < 0.5 ? a.label : b.label,
        xPct: lerp(a.xPct, b.xPct, alpha),
        yPct: lerp(a.yPct, b.yPct, alpha),
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

/**
 * 再生時刻 t（秒）→ ステージに描くダンサー配置。
 * 各区間 [tStart, tEnd] 内は一定。区間の隙間 (tEnd, next.tStart) のみ線形補間。
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
        lerpFormations(f0?.dancers ?? [], f1?.dancers ?? [], alpha)
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
