import {
  DEFAULT_CUE_SPAN_WITH_AUDIO_SEC,
  MIN_CUE_DURATION_SEC,
  resolveCueIntervalNonOverlap,
  sortCuesByStart,
  trimHiSecForCueTimeline,
} from "../core/timelineController";
import { cueActiveAtTime } from "./cueInterval";
import { MAX_DANCERS_PER_FORMATION } from "./dancerCountLimits";
import { modDancerColorIndex } from "./dancerColorPalette";
import {
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
} from "./dancerSpacing";
import { normalizeNameForMatch } from "./matchNameToRoster";
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

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.min(
    DANCER_STAGE_POSITION_PCT_HI,
    Math.max(DANCER_STAGE_POSITION_PCT_LO, n)
  );
}

function sourceDancersForPhotoCue(
  project: ChoreographyProjectJson,
  tStartSec: number
): DancerSpot[] {
  const cue =
    cueActiveAtTime(project.cues, tStartSec) ??
    project.cues.find((c) => c.formationId === project.activeFormationId) ??
    null;
  const fid = cue?.formationId ?? project.activeFormationId;
  return project.formations.find((f) => f.id === fid)?.dancers ?? [];
}

function uniqueCrewMemberIdForName(
  project: ChoreographyProjectJson,
  name: string
): string | undefined {
  const norm = normalizeNameForMatch(name);
  if (!norm) return undefined;
  const hits: string[] = [];
  for (const crew of project.crews ?? []) {
    for (const member of crew.members) {
      if (normalizeNameForMatch(member.label) === norm) {
        hits.push(member.id);
      }
    }
  }
  return hits.length === 1 ? hits[0] : undefined;
}

/**
 * 写真の名前を、いまのステージ上の人物 id に載せる。
 * 他キューとの同一性は dancer id（と既存の crewMemberId）で保つ。
 */
export function dancersFromParsedPositions(
  positions: ParsedPosition[],
  source: readonly DancerSpot[],
  project?: ChoreographyProjectJson
): DancerSpot[] {
  const capped = positions.slice(0, MAX_DANCERS_PER_FORMATION);
  const usedSourceIds = new Set<string>();

  const takeSource = (name: string): DancerSpot | undefined => {
    const norm = normalizeNameForMatch(name);
    if (!norm) return undefined;

    const exact = source.find(
      (d) =>
        !usedSourceIds.has(d.id) && normalizeNameForMatch(d.label) === norm
    );
    if (exact) return exact;

    if (norm.length < 2) return undefined;

    const prefixHits = source.filter((d) => {
      if (usedSourceIds.has(d.id)) return false;
      const n = normalizeNameForMatch(d.label);
      if (!n || n.length < 2) return false;
      return n.startsWith(norm) || norm.startsWith(n);
    });
    return prefixHits.length === 1 ? prefixHits[0] : undefined;
  };

  return capped.map((p, i) => {
    const src = takeSource(p.name);
    if (src) usedSourceIds.add(src.id);
    const xPct = clampPct(p.x);
    const yPct = clampPct(p.y);
    if (src) {
      return {
        ...src,
        label: p.name,
        xPct,
        yPct,
      };
    }
    const spot: DancerSpot = {
      id: crypto.randomUUID(),
      label: p.name,
      xPct,
      yPct,
      colorIndex: modDancerColorIndex(i),
    };
    const crewMemberId = project
      ? uniqueCrewMemberIdForName(project, p.name)
      : undefined;
    if (crewMemberId) spot.crewMemberId = crewMemberId;
    return spot;
  });
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
  const tStartSec = opts.tStartSec ?? 0;
  const dancers = dancersFromParsedPositions(
    opts.positions,
    sourceDancersForPhotoCue(project, tStartSec),
    project
  );
  if (dancers.length === 0) return null;

  const newCueId = crypto.randomUUID();
  const newFmId = crypto.randomUUID();
  const hi = trimHiSecForCueTimeline(
    project.trimEndSec,
    opts.durationSec ?? null
  );
  const lo = project.trimStartSec ?? 0;
  let t0 = Math.round(tStartSec * 100) / 100;
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
