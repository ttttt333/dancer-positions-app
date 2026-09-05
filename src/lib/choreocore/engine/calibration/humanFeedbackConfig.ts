export const HUMAN_FEEDBACK_VERSION = "9.0.0-feedback-capture";
export const HUMAN_FEEDBACK_STORAGE_KEY = "choreocore.humanFeedback.v1";
export const HUMAN_FEEDBACK_EVALUATOR_KEY = "choreocore.humanFeedback.anonId";

/**
 * Editor 観測は Music Engine FLAG と独立。
 * 現場の通常利用から Feedback を貯める。OFF にすると学習材料が消える。
 */
export const HUMAN_FEEDBACK_CAPTURE_ENABLED = true;

export const HUMAN_FEEDBACK_LIMITS = {
  maxEvents: 2000,
  maxOrigins: 400,
} as const;

export const HUMAN_FEEDBACK_DIFF = {
  positionEpsPct: 0.45,
  assignmentSwapEpsPct: 0.8,
} as const;
