/**
 * AI フォーメーション提案をプロジェクトへ取り込む。
 * 採用キューだけを対象にし、上書き／追加を切り替える。
 */

import type {
  ChoreographyProjectJson,
  Cue,
  Formation,
} from "../types/choreography";
import {
  MIN_CUE_DURATION_SEC,
  PLACEHOLDER_TIMELINE_CAP_SEC,
  resolveCueIntervalNonOverlap,
  sortCuesByStart,
} from "./cueInterval";

export type AiSuggestApplyMode = "replace" | "append";

export type AiSuggestAcceptedSlice = {
  formations: Formation[];
  cues: Cue[];
};

/** キューと、それが指すフォーメーションを開始時刻順に組む */
export function pairSuggestionCues(
  formations: readonly Formation[],
  cues: readonly Cue[]
): Array<{ cue: Cue; formation: Formation }> {
  const byId = new Map(formations.map((f) => [f.id, f] as const));
  const out: Array<{ cue: Cue; formation: Formation }> = [];
  for (const cue of sortCuesByStart([...cues])) {
    const formation = byId.get(cue.formationId);
    if (formation) out.push({ cue, formation });
  }
  return out;
}

/** 採用したキューと、それらが参照するフォーメーションだけ残す */
export function filterAcceptedSuggestion(
  formations: readonly Formation[],
  cues: readonly Cue[],
  acceptedCueIds: ReadonlySet<string>
): AiSuggestAcceptedSlice {
  const cuesOut = sortCuesByStart(cues.filter((c) => acceptedCueIds.has(c.id)));
  const keepFormIds = new Set(cuesOut.map((c) => c.formationId));
  const formationsOut = formations.filter((f) => keepFormIds.has(f.id));
  return { formations: formationsOut, cues: cuesOut };
}

function stitchOverlappingEnds(cues: Cue[]): Cue[] {
  const sorted = sortCuesByStart(cues.map((c) => ({ ...c })));
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i]!;
    const next = sorted[i + 1]!;
    if (cur.tEndSec > next.tStartSec) {
      cur.tEndSec = Math.max(cur.tStartSec + 0.5, next.tStartSec);
    }
  }
  return sorted.filter((c) => c.tEndSec > c.tStartSec + 1e-6);
}

function timelineCap(
  prev: ChoreographyProjectJson,
  extraCues: readonly Cue[],
  durationSec?: number
): number {
  const fromCues = Math.max(
    0,
    ...prev.cues.map((c) => c.tEndSec),
    ...extraCues.map((c) => c.tEndSec)
  );
  const fromDuration =
    typeof durationSec === "number" && Number.isFinite(durationSec)
      ? durationSec
      : 0;
  const fromTrim =
    typeof prev.trimEndSec === "number" && Number.isFinite(prev.trimEndSec)
      ? prev.trimEndSec
      : 0;
  return Math.max(
    fromCues,
    fromDuration,
    fromTrim,
    prev.trimStartSec + MIN_CUE_DURATION_SEC,
    PLACEHOLDER_TIMELINE_CAP_SEC
  );
}

/** 既存キューは動かさず、新規キューだけ空き区間へ収めて追加する */
export function appendCuesWithoutOverlap(
  existing: readonly Cue[],
  incoming: readonly Cue[],
  trimLo: number,
  trimHi: number
): Cue[] {
  let cues = existing.map((c) => ({ ...c }));
  const existingIds = new Set(cues.map((c) => c.id));
  for (const raw of sortCuesByStart([...incoming])) {
    if (existingIds.has(raw.id)) continue;
    const fitted = resolveCueIntervalNonOverlap(
      cues,
      raw.id,
      raw.tStartSec,
      raw.tEndSec,
      trimLo,
      trimHi
    );
    if (fitted.tEndSec - fitted.tStartSec < MIN_CUE_DURATION_SEC - 1e-9) {
      continue;
    }
    cues.push({
      ...raw,
      tStartSec: fitted.tStartSec,
      tEndSec: fitted.tEndSec,
    });
    existingIds.add(raw.id);
  }
  return sortCuesByStart(cues);
}

export function applyAiSuggestToProject(
  prev: ChoreographyProjectJson,
  accepted: AiSuggestAcceptedSlice,
  mode: AiSuggestApplyMode,
  opts?: { durationSec?: number }
): ChoreographyProjectJson {
  if (accepted.cues.length === 0 || accepted.formations.length === 0) {
    return prev;
  }

  const incomingFormIds = new Set(accepted.formations.map((f) => f.id));
  const keptPrevFormations = prev.formations.filter(
    (f) => !incomingFormIds.has(f.id)
  );
  const formations = [...keptPrevFormations, ...accepted.formations];
  const activeFormationId =
    accepted.formations[0]?.id ?? prev.activeFormationId;

  if (mode === "replace") {
    return {
      ...prev,
      formations,
      cues: stitchOverlappingEnds(accepted.cues),
      activeFormationId,
    };
  }

  const trimLo = Number.isFinite(prev.trimStartSec) ? prev.trimStartSec : 0;
  const trimHi = timelineCap(prev, accepted.cues, opts?.durationSec);
  return {
    ...prev,
    formations,
    cues: appendCuesWithoutOverlap(prev.cues, accepted.cues, trimLo, trimHi),
    activeFormationId,
  };
}
