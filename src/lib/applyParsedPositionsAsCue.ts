import {
  DEFAULT_CUE_SPAN_WITH_AUDIO_SEC,
  MIN_CUE_DURATION_SEC,
  resolveCueIntervalNonOverlap,
  sortCuesByStart,
  trimHiSecForCueTimeline,
} from "../core/timelineController";
import { modDancerColorIndex } from "../lib/dancerColorPalette";
import type {
  ChoreographyProjectJson,
  Cue,
  DancerSpot,
} from "../types/choreography";
import type { ParsedPosition } from "./parsePositionTypes";

export type ApplyParsedPositionsOptions = {
  positions: ParsedPosition[];
  /** キュー開始秒（省略時は 0） */
  tStartSec?: number;
  /** フォーメーション名（省略時は「写真から取込」） */
  formationName?: string;
  durationSec?: number | null;
};

export type ApplyParsedPositionsResult = {
  cueId: string;
  formationId: string;
  tStartSec: number;
};

function dancersFromParsedPositions(positions: ParsedPosition[]): DancerSpot[] {
  return positions.map((p, i) => ({
    id: crypto.randomUUID(),
    label: p.name,
    xPct: p.x,
    yPct: p.y,
    colorIndex: modDancerColorIndex(i),
  }));
}

/**
 * 写真解析結果から新しいフォーメーションとキューを 1 件追加する。
 * `setProject` の updater 内で呼ぶ想定。
 */
export function applyParsedPositionsAsCue(
  project: ChoreographyProjectJson,
  opts: ApplyParsedPositionsOptions
): { project: ChoreographyProjectJson; result: ApplyParsedPositionsResult } | null {
  if (project.cues.length >= 100) return null;
  const dancers = dancersFromParsedPositions(opts.positions);
  if (dancers.length === 0) return null;

  const newCueId = crypto.randomUUID();
  const newFmId = crypto.randomUUID();
  const hi = trimHiSecForCueTimeline(
    project.trimEndSec,
    opts.durationSec ?? null
  );
  const lo = project.trimStartSec ?? 0;
  let t0 = Math.round((opts.tStartSec ?? 0) * 100) / 100;
  t0 = Math.max(lo, Math.min(hi - 0.02, t0));
  let t1 = Math.min(
    hi,
    Math.round((t0 + DEFAULT_CUE_SPAN_WITH_AUDIO_SEC) * 100) / 100
  );
  if (t1 <= t0) t1 = Math.round((t0 + 0.5) * 100) / 100;

  const resolved = resolveCueIntervalNonOverlap(
    project.cues,
    newCueId,
    t0,
    t1,
    lo,
    hi
  );
  t0 = resolved.tStartSec;
  t1 = resolved.tEndSec;
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) {
    t0 = lo;
    t1 = Math.min(hi, Math.round((lo + MIN_CUE_DURATION_SEC) * 100) / 100);
  }

  const cue: Cue = {
    id: newCueId,
    tStartSec: t0,
    tEndSec: t1,
    formationId: newFmId,
  };

  const formation = {
    id: newFmId,
    name: opts.formationName?.trim() || "写真から取込",
    dancers,
    confirmedDancerCount: dancers.length,
    setPieces: [],
  };

  return {
    project: {
      ...project,
      formations: [...project.formations, formation],
      cues: sortCuesByStart([...project.cues, cue]),
      activeFormationId: newFmId,
    },
    result: {
      cueId: newCueId,
      formationId: newFmId,
      tStartSec: t0,
    },
  };
}
