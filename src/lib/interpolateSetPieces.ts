import type { Cue, Formation, SetPiece } from "../types/choreography";
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

function roundPiece(p: SetPiece): SetPiece {
  return {
    ...p,
    xPct: Math.round(p.xPct * 100) / 100,
    yPct: Math.round(p.yPct * 100) / 100,
    wPct: Math.round(p.wPct * 100) / 100,
    hPct: Math.round(p.hPct * 100) / 100,
  };
}

/** インデックス対応で補間（同一スロット想定）。両方 interpolateInGaps のときのみ数値を lerp。 */
function lerpSetPiecesAtIndex(
  from: SetPiece[],
  to: SetPiece[],
  alpha: number
): SetPiece[] {
  const n = Math.max(from.length, to.length);
  const out: SetPiece[] = [];
  for (let i = 0; i < n; i++) {
    const a = from[i];
    const b = to[i];
    if (a && b && a.interpolateInGaps && b.interpolateInGaps) {
      out.push(
        roundPiece({
          ...a,
          id: alpha < 0.5 ? a.id : b.id,
          kind: alpha < 0.5 ? a.kind : b.kind,
          label: alpha < 0.5 ? a.label : b.label,
          fillColor: alpha < 0.5 ? a.fillColor : b.fillColor,
          xPct: lerp(a.xPct, b.xPct, alpha),
          yPct: lerp(a.yPct, b.yPct, alpha),
          wPct: lerp(a.wPct, b.wPct, alpha),
          hPct: lerp(a.hPct, b.hPct, alpha),
          interpolateInGaps: true,
        })
      );
    } else if (a && b) {
      out.push(alpha < 0.5 ? { ...a } : { ...b });
    } else if (a) {
      out.push({ ...a });
    } else if (b) {
      out.push({ ...b });
    }
  }
  return out;
}

/**
 * 再生時刻 t における大道具配置（区間内一定・ギャップのみ補間）。
 */
export function setPiecesAtTime(
  t: number,
  cues: Cue[],
  formations: Formation[],
  fallbackFormationId: string
): SetPiece[] {
  const sorted = sortCuesByStart(cues);
  const fb = formationById(formations, fallbackFormationId);

  if (sorted.length === 0) {
    return [...(fb?.setPieces ?? [])];
  }

  const first = sorted[0];
  if (t < first.tStartSec) {
    const f = formationById(formations, first.formationId);
    return [...(f?.setPieces ?? fb?.setPieces ?? [])];
  }

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    if (t >= cur.tStartSec && t <= cur.tEndSec) {
      const f = formationById(formations, cur.formationId);
      return [...(f?.setPieces ?? [])];
    }
    const next = sorted[i + 1];
    if (next && t > cur.tEndSec && t < next.tStartSec) {
      const f0 = formationById(formations, cur.formationId);
      const f1 = formationById(formations, next.formationId);
      const g0 = cur.tEndSec;
      const g1 = next.tStartSec;
      const span = g1 - g0;
      const alpha = span > 1e-6 ? (t - g0) / span : 1;
      const p0 = f0?.setPieces ?? [];
      const p1 = f1?.setPieces ?? [];
      const aSorted = [...p0].sort((x, y) => x.id.localeCompare(y.id));
      const bSorted = [...p1].sort((x, y) => x.id.localeCompare(y.id));
      return lerpSetPiecesAtIndex(aSorted, bSorted, alpha);
    }
  }

  const last = sorted[sorted.length - 1];
  if (t > last.tEndSec) {
    const f = formationById(formations, last.formationId);
    return [...(f?.setPieces ?? [])];
  }

  return [...(fb?.setPieces ?? [])];
}
