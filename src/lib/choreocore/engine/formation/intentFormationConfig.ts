/**
 * Stage 6 Formation Intelligence — 名前付き定数。
 * Visual Impact per Movement を中心に、インラインのマジックナンバーを置かない。
 */

export const FORMATION_INTELLIGENCE_VERSION = "6.0.0-intent-formation";

export const FORMATION_INTELLIGENCE_CANDIDATE_COUNT = {
  min: 3,
  max: 8,
} as const;

export const FORMATION_INTELLIGENCE_ALTERNATIVE_COUNT = 2;

/** ソフトスコア合成（加算項）。合計 1.0 */
export const FORMATION_INTELLIGENCE_WEIGHTS = {
  intentAlignment: 0.24,
  visualImpact: 0.2,
  transitionQuality: 0.16,
  movementEfficiency: 0.22,
  stageUsage: 0.1,
  roleCompatibility: 0.08,
} as const;

/** ソフトペナルティ。0–100 入力に対する係数 */
export const FORMATION_INTELLIGENCE_PENALTIES = {
  complexity: 0.08,
  collision: 0.12,
} as const;

/** Visual Impact の内訳 */
export const VISUAL_IMPACT_COMPONENT_WEIGHTS = {
  storedImpact: 0.2,
  shapeContrast: 0.22,
  densityChange: 0.16,
  stageCoverageChange: 0.2,
  symmetryChange: 0.1,
  centerShift: 0.12,
} as const;

/** Movement Cost の内訳。総距離だけにしない */
export const MOVEMENT_COST_WEIGHTS = {
  pathLength: 0.28,
  maxIndividualDistance: 0.22,
  requiredSpeed: 0.2,
  crossingRisk: 0.15,
  timingPressure: 0.15,
} as const;

export const MOVEMENT_COST_NORMALIZE = {
  pathLengthRef: 480,
  maxDistanceRef: 200,
} as const;

/** VIPM = visualImpact / max(floor, movementCost) */
export const VISUAL_IMPACT_PER_MOVEMENT = {
  costFloor: 8,
  scoreScale: 16,
} as const;

export const INTENT_INTENSITY_THRESHOLDS = {
  max: 0.88,
  large: 0.62,
  medium: 0.38,
  small: 0.15,
} as const;

/** intensity=1 のときの目標 coverage 変化（ポイント） */
export const TARGET_COVERAGE_DELTA_AT_FULL = {
  EXPAND: 38,
  CONTRACT: -32,
  SPLIT: 22,
  MERGE: -18,
  HOLD: 0,
  REVEAL: 34,
  HIDE: -28,
  HIT: 16,
  SHIFT_CENTER: 10,
  MICRO_SHIFT: 6,
  MAJOR_CHANGE: 28,
  TRAVEL: 12,
  RESET: -8,
  ROTATE: 8,
} as const;

export const TARGET_SHAPE_CONTRAST_AT_FULL = {
  EXPAND: 55,
  CONTRACT: 40,
  SPLIT: 60,
  MERGE: 35,
  HOLD: 8,
  REVEAL: 58,
  HIDE: 36,
  HIT: 50,
  SHIFT_CENTER: 42,
  MICRO_SHIFT: 18,
  MAJOR_CHANGE: 70,
  TRAVEL: 30,
  RESET: 20,
  ROTATE: 28,
} as const;

export const COVERAGE_FIT_SCALE = 1.6;
export const CONTRAST_FIT_SCALE = 1.4;

export const HARD_CONSTRAINTS = {
  /** 既存 Motion の soft/hard 境 (1.35) より緩い。経路最適化前の「明らかに不可能」だけ除外 */
  maxSpeedRatio: 2.6,
  maxCollisionRisk: 96,
  lockedPositionEpsilon: 8,
  impossibleTimingSeconds: 0.08,
} as const;

export const HARD_REJECTION_REASONS = [
  "OUTSIDE_SAFE_MARGIN",
  "OUTSIDE_STAGE",
  "STAGE_OUTSIDE",
  "INVALID_COORDINATE",
  "DUPLICATE_POINT",
  "DUPLICATE_FINAL_POSITION",
  "DANCER_COUNT_MISMATCH",
  "STATIC_COLLISION",
  "IMPOSSIBLE_AVAILABLE_TIME",
  "LOCKED_POSITION_MISSING",
  "LOCKED_POSITION_VIOLATION",
] as const;

export const DIVERSITY_RANKING = {
  maxScoreGapFromPrimary: 18,
  sameFamilySkip: true,
} as const;

export const EDGE_BAND_RATIO = 0.14;

export const CONTEXT_CONTRAST = {
  oppositePairBonus: 10,
  repeatIntentDampening: 8,
} as const;

export const COMPLEXITY_SOFT = {
  holdThreshold: 40,
  defaultSoftStart: 55,
} as const;

export const DEFAULT_TRANSITION_BEATS = 4;
export const DEFAULT_TRANSITION_BPM = 120;
