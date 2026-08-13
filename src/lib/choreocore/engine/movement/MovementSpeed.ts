import type { FormationChangeMagnitude, StageConfig } from "../types/CueTypes";
import type { MovementAbility, MovementTiming } from "../types/MovementTypes";
import { usableStage } from "../formation/FormationScaler";
import { magnitudeSpeedFactor, resolveAbility } from "./movementConfig";

/**
 * Pixels / second. Full usable width in ~4s at baseSpeed 1.0.
 */
export function effectiveSpeedPx(
  stage: StageConfig,
  ability: Partial<MovementAbility> | undefined,
  magnitude: FormationChangeMagnitude
): number {
  const profile = resolveAbility(ability);
  const width = Math.max(1, usableStage(stage).width);
  const cruise = (width / 4) * profile.baseSpeed;
  const peak = (width / 4) * profile.maxSpeed;
  const mag = magnitudeSpeedFactor(magnitude);
  const speed = cruise + (peak - cruise) * Math.max(0, mag - 0.7) / 0.48;
  return Math.max(1, speed * profile.agility * mag);
}

export function calculateRequiredTravelTime(
  distance: number,
  stage: StageConfig,
  ability: Partial<MovementAbility> | undefined,
  magnitude: FormationChangeMagnitude
): number {
  const speed = effectiveSpeedPx(stage, ability, magnitude);
  return distance / speed;
}

export function calculateMovementFeasibility(options: {
  distance: number;
  pushingLimit: number;
  requiredSeconds: number;
  timing: MovementTiming;
  softRatio: number;
}): {
  directFeasible: boolean;
  hardViolation: boolean;
  softViolation: boolean;
  speedRatio: number;
} {
  const { distance, pushingLimit, requiredSeconds, timing, softRatio } = options;
  const speedRatio =
    timing.availableSeconds <= 0
      ? Infinity
      : requiredSeconds / timing.availableSeconds;
  const limitRatio = pushingLimit <= 0 ? Infinity : distance / pushingLimit;
  const hardViolation =
    limitRatio > softRatio || speedRatio > Math.max(1.35, softRatio);
  const softViolation = !hardViolation && (limitRatio > 1 || speedRatio > 1);
  return {
    directFeasible: !hardViolation && speedRatio <= 1.001,
    hardViolation,
    softViolation,
    speedRatio: Number.isFinite(speedRatio) ? speedRatio : 99,
  };
}
