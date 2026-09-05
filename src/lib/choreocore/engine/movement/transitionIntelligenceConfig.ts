/**
 * Stage 7 Transition / Motion Intelligence — 名前付き定数。
 * 最短距離 ≠ 最良の振付移動。4カウント固定ではなく available duration を優先する。
 */

export const TRANSITION_INTELLIGENCE_VERSION = "7.0.0-motion";

export const TRANSITION_PATH_KINDS = [
  "STRAIGHT",
  "ARC",
  "CURVE",
  "SAFE_AROUND",
] as const;

export const TRANSITION_ASSIGNMENTS = ["identity", "hungarian"] as const;

export const TRANSITION_ALTERNATIVE_COUNT = 2;
export const TRANSITION_MAX_CANDIDATES = 6;

export const TRANSITION_DURATION = {
  minSeconds: 0.05,
  fallbackBeats: 4,
} as const;

export const TRANSITION_SAMPLE = {
  coarse: 8,
  fine: 24,
  pathLength: 16,
} as const;

export const TRANSITION_PATH_GEOMETRY = {
  minChordForCurve: 28,
  arcOffsetRatio: 0.22,
  arcOffsetMaxRatio: 0.12,
  curveOffsetRatio: 0.12,
  safeOffsetRatio: 0.3,
  safeOffsetMaxRatio: 0.16,
} as const;

export const TRANSITION_HARD = {
  maxSpeedRatio: 2.6,
  hardCollisionFraction: 0.28,
  lockedPositionEpsilon: 8,
  sameTimeCrossingWindow: 0.12,
} as const;

export const TRANSITION_SCORE_WEIGHTS = {
  feasibility: 0.18,
  collisionSafety: 0.16,
  smoothness: 0.14,
  timing: 0.12,
  movementEfficiency: 0.16,
  arrivalSync: 0.1,
  groupCoherence: 0.08,
  spacing: 0.06,
} as const;

export const TRANSITION_COST_WEIGHTS = {
  distance: 0.22,
  speed: 0.18,
  acceleration: 0.14,
  turn: 0.12,
  crossing: 0.14,
  collision: 0.12,
  timingPressure: 0.08,
} as const;

export const TRANSITION_COST_NORMALIZE = {
  distanceRef: 420,
  speedRatioRef: 1.6,
  accelRef: 220,
  turnRef: 2.4,
} as const;

export const TRANSITION_EFFICIENCY = {
  costFloor: 8,
  scoreScale: 16,
} as const;

export const TRANSITION_DIVERSITY = {
  maxScoreGapFromPrimary: 22,
} as const;

export const TRANSITION_PHASES = ["EXIT", "TRAVEL", "ARRIVAL", "SETTLE"] as const;

export const TRANSITION_PHASE_BOUNDS = {
  exitEnd: 0.16,
  travelEnd: 0.74,
  arrivalEnd: 0.9,
} as const;
