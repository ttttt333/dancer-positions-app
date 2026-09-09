import type {
  Cue,
  DancerSpot,
  Formation,
  GapApproachRoute,
} from "../types/choreography";
import { sortCuesByStart } from "../core/timelineController";
import { lerpDancersAcrossGap } from "./gapDancerInterpolation";
import { resolveTransitionWindow } from "./formation/interpolation";

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
  bpm: number | null;
  beforeFirst: DancerSpot[];
  afterLast: DancerSpot[];
  holds: HoldSeg[];
  gaps: GapSeg[];
};

let cache: InterpCache | null = null;

export type DancersAtTimeOptions = {
  /** 暗黙遷移の秒数計算に使う BPM（未指定時 120） */
  bpm?: number | null;
};

function buildCache(
  cues: Cue[],
  formations: Formation[],
  fallbackFormationId: string,
  bpm: number | null
): InterpCache {
  const sorted = sortCuesByStart(cues);
  const fb = formationById(formations, fallbackFormationId);
  const holds: HoldSeg[] = [];
  const gaps: GapSeg[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const next = sorted[i + 1];
    const f = formationById(formations, cur.formationId);
    const dancers = roundSpots(f?.dancers ?? []);

    if (!next) {
      holds.push({
        t0: cur.tStartSec,
        t1: cur.tEndSec,
        dancers,
      });
      continue;
    }

    const win = resolveTransitionWindow({
      prevStartSec: cur.tStartSec,
      prevEndSec: cur.tEndSec,
      nextStartSec: next.tStartSec,
      moveInSec: next.moveInSec,
      bpm,
    });

    holds.push({
      t0: cur.tStartSec,
      t1: win.holdEndSec,
      dancers,
    });

    const f0 = formationById(formations, cur.formationId);
    const f1 = formationById(formations, next.formationId);
    if (win.arrivalSec > win.holdEndSec + 1e-4) {
      gaps.push({
        g0: win.holdEndSec,
        g1: win.arrivalSec,
        from: f0?.dancers ?? [],
        to: f1?.dancers ?? [],
        route: next.gapApproachFromPrev,
        customPaths: next.dancerCustomPaths,
      });
    } else {
      // 窓が潰れた場合は gaps[i] を空けるためプレースホルダ無し（holds と index 対応は gaps[i] optional）
      gaps.push({
        g0: win.holdEndSec,
        g1: win.holdEndSec,
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
    bpm,
    beforeFirst,
    afterLast,
    holds,
    gaps,
  };
}

function getCache(
  cues: Cue[],
  formations: Formation[],
  fallbackFormationId: string,
  bpm: number | null
): InterpCache {
  if (
    cache &&
    cache.cuesRef === cues &&
    cache.formationsRef === formations &&
    cache.fallbackId === fallbackFormationId &&
    cache.bpm === bpm
  ) {
    return cache;
  }
  cache = buildCache(cues, formations, fallbackFormationId, bpm);
  return cache;
}

/** テスト・ホットリロード用にキャッシュを捨てる */
export function clearDancersAtTimeCache(): void {
  cache = null;
}

/**
 * 再生時刻 t（秒）→ ステージに描くダンサー配置。
 * - キュー内ホールドは静止
 * - 明示ギャップ、または隣接キューの暗黙遷移（ホールド末尾を削った移動）で補間
 * キュー配列参照が同じあいだはキャッシュし、RAF ごとの再計算をギャップ補間だけに抑える。
 */
export function dancersAtTime(
  t: number,
  cues: Cue[],
  formations: Formation[],
  fallbackFormationId: string,
  opts?: DancersAtTimeOptions
): DancerSpot[] {
  const bpm =
    opts?.bpm != null && Number.isFinite(opts.bpm) && opts.bpm! > 0
      ? opts.bpm!
      : null;
  const c = getCache(cues, formations, fallbackFormationId, bpm);

  if (c.holds.length === 0) {
    return c.beforeFirst;
  }

  if (t < c.holds[0]!.t0) {
    return c.beforeFirst;
  }

  for (let i = 0; i < c.holds.length; i++) {
    const hold = c.holds[i]!;
    if (t >= hold.t0 && t <= hold.t1) {
      return hold.dancers;
    }
    const gap = c.gaps[i];
    if (gap && gap.g1 > gap.g0 + 1e-6 && t > gap.g0 && t < gap.g1) {
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

  if (t > c.holds[c.holds.length - 1]!.t1) {
    return c.afterLast;
  }

  return c.beforeFirst;
}
