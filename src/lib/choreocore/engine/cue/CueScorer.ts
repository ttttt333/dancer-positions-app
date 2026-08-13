import type { ChangePointType, EventCluster } from "../types/MusicTypes";
import type {
  CueEnergyContext,
  CueEngineConfig,
  FormationChangeMagnitude,
} from "../types/CueTypes";

export function clusterTypes(cluster: EventCluster): Set<ChangePointType> {
  return new Set(cluster.changePoints.map((p) => p.type));
}

export function isMajorCandidate(cluster: EventCluster): boolean {
  if (cluster.isMajor) return true;
  const types = clusterTypes(cluster);
  const hasRise = types.has("ENERGY_RISE");
  return (
    (types.has("SECTION_CHANGE") && hasRise) ||
    (types.has("HIT") && hasRise) ||
    (types.has("BASS_ENTRY") && hasRise) ||
    (types.has("SECTION_CHANGE") && types.has("HIT")) ||
    cluster.changePoints.some((p) => p.type === "HIT" && p.strength >= 85) ||
    (cluster.dominantType === "ENERGY_RISE" && cluster.totalStrength >= 80) ||
    (types.has("ENERGY_DROP") && cluster.totalStrength >= 75)
  );
}

/**
 * priority = totalStrength * 0.70 + confidence * 10 + majorBoost
 */
export function calculateCuePriority(
  cluster: EventCluster,
  major: boolean
): number {
  const base = cluster.totalStrength * 0.7;
  const confidenceBoost = cluster.confidence * 10;
  const majorBoost = major ? 15 : 0;
  return Math.max(0, Math.min(100, base + confidenceBoost + majorBoost));
}

export function magnitudeFromPriority(
  priority: number,
  major: boolean,
  types: Set<ChangePointType>
): FormationChangeMagnitude {
  let mag: FormationChangeMagnitude;
  if (priority <= 20) mag = "NONE";
  else if (priority <= 40) mag = "SMALL";
  else if (priority <= 65) mag = "MEDIUM";
  else if (priority <= 85) mag = "LARGE";
  else mag = "MAX";

  const majorCombo =
    major &&
    ((types.has("SECTION_CHANGE") && types.has("ENERGY_RISE")) ||
      (types.has("SECTION_CHANGE") && types.has("HIT")) ||
      (types.has("HIT") && types.has("ENERGY_RISE") && types.has("BASS_ENTRY")));
  if (majorCombo && (mag === "NONE" || mag === "SMALL" || mag === "MEDIUM")) {
    mag = "LARGE";
  }
  return mag;
}

export function energyContext(
  energyBefore: number,
  energyAfter: number
): CueEnergyContext {
  const delta = energyAfter - energyBefore;
  const direction: CueEnergyContext["direction"] =
    delta > 8 ? "RISING" : delta < -8 ? "FALLING" : "STABLE";
  const reference =
    direction === "FALLING"
      ? energyBefore
      : direction === "RISING"
        ? energyAfter
        : Math.max(energyBefore, energyAfter);
  const level: CueEnergyContext["level"] =
    reference >= 65 ? "HIGH" : reference < 40 ? "LOW" : "MID";
  return { level, direction };
}

/**
 * Adaptive cooldown in beats. Lower priority → longer wait.
 * priority 20→16, 40→12, 60→8, 80→4, 90→2
 */
export function cooldownBeatsForPriority(
  priority: number,
  major: boolean,
  config: CueEngineConfig
): number {
  if (major && priority >= config.majorPriorityThreshold) return 1;
  const p = Math.max(0, Math.min(100, priority));
  const low = config.lowPriorityCooldownBeats;
  const medium = config.mediumPriorityCooldownBeats;
  const high = config.highPriorityCooldownBeats;
  if (p >= 90) return 2;
  if (p >= 80) return Math.round(lerp(80, 90, high, 2, p));
  if (p >= 60) return Math.round(lerp(60, 80, medium, high, p));
  if (p >= 20) return Math.round(lerp(20, 60, low, medium, p));
  return low;
}

function lerp(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  x: number
): number {
  if (x1 === x0) return y1;
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

export function clusterEnergy(cluster: EventCluster): {
  energyBefore: number;
  energyAfter: number;
  deltaEnergy: number;
} {
  const cps = cluster.changePoints;
  if (cps.length === 0) {
    return { energyBefore: 0, energyAfter: 0, deltaEnergy: 0 };
  }
  const energyBefore =
    cps.reduce((s, p) => s + p.energyBefore, 0) / cps.length;
  const energyAfter =
    cps.reduce((s, p) => s + p.energyAfter, 0) / cps.length;
  return {
    energyBefore,
    energyAfter,
    deltaEnergy: energyAfter - energyBefore,
  };
}
