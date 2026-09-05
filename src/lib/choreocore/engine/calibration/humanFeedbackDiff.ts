import type { Cue, Formation } from "../../../../types/choreography";
import { HUMAN_FEEDBACK_DIFF } from "./humanFeedbackConfig";
import type { AiCandidateOrigin, HumanFeedbackAction } from "./humanFeedbackTypes";
import type { HumanEditSignal } from "./humanEvaluationTypes";

function distPct(
  a: { xPct: number; yPct: number },
  b: { xPct: number; yPct: number }
): number {
  return Math.hypot(a.xPct - b.xPct, a.yPct - b.yPct);
}

export function diffFormationAgainstOrigin(
  origin: AiCandidateOrigin,
  formation: Formation
): HumanEditSignal {
  const now: Record<string, { xPct: number; yPct: number }> = {};
  for (const d of formation.dancers) {
    now[d.id] = { xPct: d.xPct, yPct: d.yPct };
  }
  const originIds = [...origin.dancerIds].sort((a, b) => a.localeCompare(b));
  const nowIds = Object.keys(now).sort((a, b) => a.localeCompare(b));
  let moved = 0;
  for (const id of originIds) {
    const a = origin.positions[id];
    const b = now[id];
    if (!a || !b) continue;
    if (distPct(a, b) > HUMAN_FEEDBACK_DIFF.positionEpsPct) moved += 1;
  }

  const positionChanged = moved > 0;
  const formationChanged =
    formation.name !== origin.formationName ||
    originIds.join("|") !== nowIds.join("|");

  let assignmentChanged = false;
  if (originIds.length === nowIds.length && originIds.join("|") === nowIds.join("|")) {
    const unused = new Set(nowIds);
    let rematched = 0;
    for (const id of originIds) {
      const from = origin.positions[id];
      if (!from) continue;
      let bestId: string | null = null;
      let best = Infinity;
      for (const other of unused) {
        const to = now[other]!;
        const d = distPct(from, to);
        if (d < best) {
          best = d;
          bestId = other;
        }
      }
      if (bestId && best <= HUMAN_FEEDBACK_DIFF.assignmentSwapEpsPct) {
        unused.delete(bestId);
        if (bestId !== id) rematched += 1;
      }
    }
    assignmentChanged = rematched >= 2;
  }

  return {
    positionChanged,
    formationChanged,
    assignmentChanged,
    pathChanged: false,
    timingChanged: false,
  };
}

export function diffCueAgainstOrigin(
  origin: AiCandidateOrigin,
  cue: Cue | undefined
): HumanEditSignal {
  if (!cue) {
    return { timingChanged: false, pathChanged: false };
  }
  const timingChanged =
    Math.abs(cue.tStartSec - origin.tStartSec) > 1e-3 ||
    Math.abs(cue.tEndSec - origin.tEndSec) > 1e-3;
  const nextKeys = Object.keys(cue.dancerCustomPaths ?? {}).sort();
  const pathChanged =
    (cue.gapApproachFromPrev ?? "") !== (origin.gapApproachFromPrev ?? "") ||
    nextKeys.join("|") !== origin.customPathKeys.join("|");
  return {
    timingChanged,
    pathChanged,
    positionChanged: false,
    formationChanged: false,
    assignmentChanged: false,
  };
}

export function mergeEditSignals(
  a: HumanEditSignal,
  b: HumanEditSignal
): HumanEditSignal {
  return {
    positionChanged: Boolean(a.positionChanged || b.positionChanged),
    formationChanged: Boolean(a.formationChanged || b.formationChanged),
    assignmentChanged: Boolean(a.assignmentChanged || b.assignmentChanged),
    pathChanged: Boolean(a.pathChanged || b.pathChanged),
    timingChanged: Boolean(a.timingChanged || b.timingChanged),
  };
}

export function formationEditSignal(signal: HumanEditSignal): HumanEditSignal {
  return {
    positionChanged: Boolean(signal.positionChanged),
    formationChanged: Boolean(signal.formationChanged),
    assignmentChanged: Boolean(signal.assignmentChanged),
    pathChanged: false,
    timingChanged: false,
  };
}

export function transitionEditSignal(signal: HumanEditSignal): HumanEditSignal {
  return {
    positionChanged: false,
    formationChanged: false,
    assignmentChanged: false,
    pathChanged: Boolean(signal.pathChanged),
    timingChanged: Boolean(signal.timingChanged),
  };
}

export function actionsFromEditSignal(signal: HumanEditSignal): HumanFeedbackAction[] {
  const actions: HumanFeedbackAction[] = [];
  if (signal.formationChanged) actions.push("FORMATION_EDIT");
  if (signal.positionChanged) actions.push("POSITION_EDIT");
  if (signal.assignmentChanged) {
    actions.push("ASSIGNMENT_EDIT");
    actions.push("SWAP");
  }
  if (signal.pathChanged) actions.push("PATH_EDIT");
  if (signal.timingChanged) actions.push("TIMING_EDIT");
  return actions;
}

export function hasSemanticEdit(signal: HumanEditSignal): boolean {
  return Boolean(
    signal.positionChanged ||
      signal.formationChanged ||
      signal.assignmentChanged ||
      signal.pathChanged ||
      signal.timingChanged
  );
}
