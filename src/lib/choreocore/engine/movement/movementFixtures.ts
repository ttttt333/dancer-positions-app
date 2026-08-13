import type { FormationCue, FormationCueAction, StageConfig } from "../types/CueTypes";
import type { Formation, FormationType, Point } from "../types/FormationTypes";
import type { TransitionContext } from "../types/MovementTypes";
import { DEFAULT_STAGE, lineFormation, makeCue } from "../formation/formationFixtures";
import { makeMovementTiming } from "./MovementTiming";

export function engineFormation(
  positions: Record<string, Point>,
  type: FormationType = "CUSTOM",
  id = "form"
): Formation {
  return {
    id,
    type,
    positions,
    symmetry: 50,
    complexity: 30,
    stageCoverage: 40,
    visualImpact: 40,
    tags: [],
  };
}

export function makeContext(options: {
  from: Record<string, Point>;
  to: Record<string, Point>;
  action?: FormationCueAction;
  startTime?: number;
  endTime?: number;
  bpm?: number;
  stage?: StageConfig;
  cue?: FormationCue;
  fromType?: FormationType;
  toType?: FormationType;
}): TransitionContext {
  const stage = options.stage ?? DEFAULT_STAGE;
  const bpm = options.bpm ?? 120;
  const endTime = options.endTime ?? 48;
  const startTime = options.startTime ?? 46;
  const action = options.action ?? "EXPAND";
  const cue = options.cue ?? makeCue(action, action === "MAJOR_CHANGE" ? "MAX" : "LARGE", { rawTime: endTime });
  return {
    currentFormation: engineFormation(options.from, options.fromType ?? "LINE", "current"),
    nextFormation: engineFormation(options.to, options.toType ?? "CUSTOM", "next"),
    cue,
    bpm,
    timing: makeMovementTiming(startTime, endTime, bpm),
    stage,
  };
}

export function offsetPositions(
  positions: Record<string, Point>,
  dx: number,
  dy: number
): Record<string, Point> {
  const out: Record<string, Point> = {};
  for (const [id, p] of Object.entries(positions)) {
    out[id] = { x: p.x + dx, y: p.y + dy };
  }
  return out;
}

export { DEFAULT_STAGE, lineFormation, makeCue };
