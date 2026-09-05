/**
 * Stage 13 Release Gate — V2 を自動で本番にしない。
 * 未設定・不明 version は常に V1。新しい env flag は増やさない。
 */

import { SHADOW_MIN_SAMPLE } from "./shadowConfig";
import { FORMATION_WEIGHTS_V1, TRANSITION_WEIGHTS_V1 } from "./weightApprovalConfig";

export const RELEASE_GATE_VERSION = "13.0.0-release-gate";

export const STABLE_FORMATION_WEIGHTS = FORMATION_WEIGHTS_V1;
export const STABLE_TRANSITION_WEIGHTS = TRANSITION_WEIGHTS_V1;

/** Canary traffic は既定 OFF。assignment の安定性だけ先に置く */
export const RELEASE_CANARY_ENABLED = false;
export const RELEASE_CANARY_PERCENT = 10;

export const RELEASE_MIN_SAMPLE = SHADOW_MIN_SAMPLE;
