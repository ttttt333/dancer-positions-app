/**
 * Stage 11 Weight Approval Gate — 名前付き定数。
 * V2 を本番適用しない。閾値は既存 Calibration / Discrepancy を再利用する。
 */

import { DISCREPANCY_MIN_SAMPLE } from "./discrepancyConfig";
import {
  FORMATION_WEIGHTS_VERSION,
  TRANSITION_WEIGHTS_VERSION,
} from "./humanEvaluationConfig";

export const WEIGHT_APPROVAL_VERSION = "11.0.0-approval-gate";
export const WEIGHT_APPROVAL_STORAGE_KEY = "choreocore.weightApproval.v1";

export const FORMATION_WEIGHTS_V1 = FORMATION_WEIGHTS_VERSION;
export const TRANSITION_WEIGHTS_V1 = TRANSITION_WEIGHTS_VERSION;
export const FORMATION_WEIGHTS_V2_PROPOSAL = "WEIGHTS_FORMATION_V2_PROPOSAL";
export const TRANSITION_WEIGHTS_V2_PROPOSAL = "WEIGHTS_TRANSITION_V2_PROPOSAL";

/** 既存 discrepancy / calibration の最低件数。新閾値は増やさない */
export const APPROVAL_MIN_SAMPLE = DISCREPANCY_MIN_SAMPLE;

/**
 * 「少し良くなっただけ」では READY_FOR_REVIEW にしない。
 * スコア幅ではなく、改善した指標の個数。
 */
export const APPROVAL_MIN_IMPROVED_METRICS = 2;
