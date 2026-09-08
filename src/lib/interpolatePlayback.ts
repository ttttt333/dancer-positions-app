import type {
  Cue,
  DancerSpot,
  Formation,
  GapApproachRoute,
} from "../types/choreography";
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
    ...(typeof d.nameBelowFontPx === "number"
      ? { nameBelowFontPx: d.nameBelowFontPx }
      : {}),
  }));
}

type HoldSeg = { t0: number; t1: number; dancers: DancerSpot[] };
type GapSeg = {
  g0: number;
  g1: number;
  from: DancerSpot[];
  to: DancerSpot[];
  route: GapApproachRoute | undefined;
  customPaths: Cue["dancerCustomPaths"];
};

type InterpCache = {
  cuesRef: Cue[];
  formationsRef: Formation[];
  fallbackId: string;
  beforeFirst: DancerSpot[];
  afterLast: DancerSpot[];
  holds: HoldSeg[];
  gaps: GapSeg[];
};

let cache: InterpCache | null = null;

function buildCache(
  cues: Cue[],
  formations: Formation[],
  fallbackFormationId: string
): InterpCache {
  const sorted = sortCuesByStart(cues);
  const fb = formationById(formations, fallbackFormationId);
  const holds: HoldSeg[] = [];
  const gaps: GapSeg[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const f = formationById(formations, cur.formationId);
    holds.push({
      t0: cur.tStartSec,
      t1: cur.tEndSec,
      dancers: roundSpots(f?.dancers ?? []),
    });
    const next = sorted[i + 1];
    if (next && next.tStartSec > cur.tEndSec) {
      const f0 = formationById(formations, cur.formationId);
      const f1 = formationById(formations, next.formationId);
      gaps.push({
        g0: cur.tEndSec,
        g1: next.tStartSec,
        from: f0?.dancers ?? [],
        to: f1?.dancers ?? [],
        route: next.gapApproachFromPrev,
        customPaths: next.dancerCustomPaths,
      });
    }
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const beforeFirst = roundSpots(
    (first
      ? formationById(formations, first.formationId)?.dancers
      : undefined) ??
      fb?.dancers ??
      []
  );
  const afterLast = roundSpots(
    (last
      ? formationById(formations, last.formationId)?.dancers
      : undefined) ??
      fb?.dancers ??
      []
  );

  return {
    cuesRef: cues,
    formationsRef: formations,
    fallbackId: fallbackFormationId,
    beforeFirst,
    afterLast,
    holds,
    gaps,
  };
}

function getCache(
  cues: Cue[],
  formations: Formation[],
  fallbackFormationId: string
): InterpCache {
  if (
    cache &&
    cache.cuesRef === cues &&
    cache.formationsRef === formations &&
    cache.fallbackId === fallbackFormationId
  ) {
    return cache;
  }
  cache = buildCache(cues, formations, fallbackFormationId);
  return cache;
}

/** テスト・ホットリロード用にキャッシュを捨てる */
export function clearDancersAtTimeCache(): void {
  cache = null;
}

/**
 * 再生時刻 t（秒）→ ステージに描くダンサー配置。
 * キュー配列参照が同じあいだはソート／hold 配置をキャッシュし、
 * RAF ごとの再計算をギャップ補間だけに抑える（中低価格帯スマホ向け）。
 */
export function dancersAtTime(
  t: number,
  cues: Cue[],
  formations: Formation[],
  fallbackFormationId: string
): DancerSpot[] {
  const c = getCache(cues, formations, fallbackFormationId);

  if (c.holds.length === 0) {
    return c.beforeFirst;
  }

  if (t < c.holds[0].t0) {
    return c.beforeFirst;
  }

  for (let i = 0; i < c.holds.length; i++) {
    const hold = c.holds[i];
    if (t >= hold.t0 && t <= hold.t1) {
      return hold.dancers;
    }
    const gap = c.gaps[i];
    if (gap && t > gap.g0 && t < gap.g1) {
      const span = gap.g1 - gap.g0;
      const alpha = span > 1e-6 ? (t - gap.g0) / span : 1;
      return roundSpots(
        lerpDancersAcrossGap(
          gap.from,
          gap.to,
          alpha,
          gap.route,
          gap.customPaths
        )
      );
    }
  }

  if (t > c.holds[c.holds.length - 1].t1) {
    return c.afterLast;
  }

  return c.beforeFirst;
}
