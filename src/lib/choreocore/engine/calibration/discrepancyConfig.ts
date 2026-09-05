/**
 * Stage 10 Discrepancy Intelligence — 名前付き定数。
 * 学習・自動 weight 変更はしない。観測と仮説の分離だけ。
 */

import {
  CALIBRATION_CONFIDENCE,
  CALIBRATION_SAMPLE,
  HIGH_AI_THRESHOLD,
  LOW_AI_THRESHOLD,
} from "./humanEvaluationConfig";

export const DISCREPANCY_ANALYSIS_VERSION = "10.0.0-discrepancy";

/** 既存 AI score は 0–100。境界は [min, max)、最後だけ 100 を含む */
export const AI_SCORE_BUCKETS = [
  { id: "0-20", min: 0, max: 20 },
  { id: "20-40", min: 20, max: 40 },
  { id: "40-60", min: 40, max: 60 },
  { id: "60-80", min: 60, max: 80 },
  { id: "80-100", min: 80, max: 101 },
] as const;

export const DISCREPANCY_SCORE = {
  high: HIGH_AI_THRESHOLD,
  low: LOW_AI_THRESHOLD,
} as const;

/** 傾向を主張するための最低件数。未満は insufficient */
export const DISCREPANCY_MIN_SAMPLE = CALIBRATION_SAMPLE.proposalMin;

export const DISCREPANCY_CONFIDENCE = {
  insufficientMax: CALIBRATION_CONFIDENCE.insufficientMax,
  lowMax: CALIBRATION_CONFIDENCE.lowMax,
  mediumMax: CALIBRATION_CONFIDENCE.moderateMax,
} as const;

export const DISCREPANCY_TOP_N = 3;
