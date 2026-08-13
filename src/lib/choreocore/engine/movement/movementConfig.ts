import type { FormationChangeMagnitude } from "../types/CueTypes";
import type { MovementAbility, MovementEngineConfig } from "../types/MovementTypes";
import { DEFAULT_MOVEMENT_ABILITY } from "../types/MovementTypes";

export const DEFAULT_MOVEMENT_ENGINE_CONFIG: MovementEngineConfig = {
  sampleCount: 16,
  softViolationRatio: 1.05,
  pathCollisionSamples: 24,
};

export function resolveMovementEngineConfig(
  partial?: Partial<MovementEngineConfig>
): MovementEngineConfig {
  if (!partial) return DEFAULT_MOVEMENT_ENGINE_CONFIG;
  return { ...DEFAULT_MOVEMENT_ENGINE_CONFIG, ...partial };
}

export function resolveAbility(
  ability?: Partial<MovementAbility>
): MovementAbility {
  if (!ability) return DEFAULT_MOVEMENT_ABILITY;
  return { ...DEFAULT_MOVEMENT_ABILITY, ...ability };
}

export function magnitudeSpeedFactor(magnitude: FormationChangeMagnitude): number {
  switch (magnitude) {
    case "NONE":
      return 0.55;
    case "SMALL":
      return 0.7;
    case "MEDIUM":
      return 0.88;
    case "LARGE":
      return 1;
    case "MAX":
      return 1.18;
    default:
      return 1;
  }
}

export function magnitudeLimitFactor(magnitude: FormationChangeMagnitude): number {
  switch (magnitude) {
    case "NONE":
      return 0.65;
    case "SMALL":
      return 0.8;
    case "MEDIUM":
      return 1;
    case "LARGE":
      return 1.12;
    case "MAX":
      return 1.25;
    default:
      return 1;
  }
}
