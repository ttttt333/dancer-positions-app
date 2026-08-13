import {
  availableCountsBetween,
  computeMaxFeasibleDistance,
  pickFormationPushingLimit,
} from "../../formation_generator";
import { STAGE_WIDTH_M } from "../../types";
import type { Formation as AppFormation } from "../../types";
import type { StageConfig } from "../types/CueTypes";
import type { Formation, Point } from "../types/FormationTypes";
import type { MovementTiming, TransitionContext } from "../types/MovementTypes";
import { magnitudeLimitFactor } from "./movementConfig";
import { effectiveSpeedPx } from "./MovementSpeed";

let pickCallCount = 0;

export function resetPushingLimitAdapterCalls(): void {
  pickCallCount = 0;
}

export function getPushingLimitAdapterCallCount(): number {
  return pickCallCount;
}

function toMeterOffset(point: Point, stage: StageConfig): { x: number; y: number } {
  const pxPerMeter = stage.width / STAGE_WIDTH_M;
  return {
    x: (point.x - stage.width / 2) / pxPerMeter,
    y: (point.y - stage.depth / 2) / pxPerMeter,
  };
}

function engineToApp(formation: Formation, stage: StageConfig): AppFormation {
  return {
    id: formation.id,
    performers: Object.entries(formation.positions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, point]) => ({
        id,
        position: toMeterOffset(point, stage),
      })),
  };
}

/**
 * Calls existing pickFormationPushingLimit (semantics unchanged) and returns
 * the per-dancer max travel in stage pixels.
 */
export function calculatePushingLimit(
  context: Pick<TransitionContext, "currentFormation" | "nextFormation" | "cue" | "stage">,
  timing: MovementTiming,
  _dancerId?: string
): number {
  const counts = availableCountsBetween(timing.startTime, timing.endTime, timing.bpm);
  const prev = engineToApp(context.currentFormation, context.stage);
  const nextPositions = Object.values(context.nextFormation.positions).map((p) =>
    toMeterOffset(p, context.stage)
  );
  const pool = [
    {
      id: context.nextFormation.id || "next",
      name: context.nextFormation.type,
      positions: nextPositions.length > 0 ? nextPositions : [{ x: 0, y: 0 }],
    },
  ];
  pickCallCount += 1;
  pickFormationPushingLimit(pool, prev, counts);

  const meters = computeMaxFeasibleDistance(counts);
  const pxPerMeter = context.stage.width / STAGE_WIDTH_M;
  const fromExisting = meters * pxPerMeter * magnitudeLimitFactor(context.cue.magnitude);
  const physical =
    effectiveSpeedPx(context.stage, undefined, context.cue.magnitude) *
    timing.availableSeconds;
  return Math.min(fromExisting, physical);
}

export function pixelsPerMeter(stage: StageConfig): number {
  return stage.width / STAGE_WIDTH_M;
}
