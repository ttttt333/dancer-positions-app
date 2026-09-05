/**
 * Stage 8 Human Evaluation / Weight Calibration — 名前付き定数。
 * 人間の1票で production weights を書き換えない。
 */

export const HUMAN_EVALUATION_VERSION = "8.0.0-human-eval";

export const FORMATION_WEIGHTS_VERSION = "WEIGHTS_FORMATION_V1";
export const TRANSITION_WEIGHTS_VERSION = "WEIGHTS_TRANSITION_V1";

export const CALIBRATION_SAMPLE = {
  proposalMin: 8,
  rankMin: 4,
  usableMin: 24,
  pairwiseMin: 4,
} as const;

export const CALIBRATION_CONFIDENCE = {
  insufficientMax: 7,
  lowMax: 15,
  moderateMax: 23,
} as const;

export const JUDGMENT_ORDINAL = {
  wrong: 0,
  acceptable: 1,
  good: 2,
} as const;

export const TRANSITION_JUDGMENT_ORDINAL = {
  impossible: 0,
  awkward: 1,
  acceptable: 2,
  natural: 3,
} as const;

export const HIGH_AI_THRESHOLD = 88;
export const LOW_AI_THRESHOLD = 62;
export const AXIS_GAP_THRESHOLD = 8;
export const WEIGHT_PROPOSAL_STEP = 0.03;
export const WEIGHT_PROPOSAL_MAX_ABS = 0.08;

export const HUMAN_EVAL_DECISIONS = ["accept", "edit", "reject"] as const;
