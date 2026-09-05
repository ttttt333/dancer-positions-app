/**
 * Stage 12 Shadow Mode — V2 は観測のみ。Production は V1。
 * 閾値は既存 Discrepancy / Calibration を再利用する。
 */

import { DISCREPANCY_MIN_SAMPLE } from "./discrepancyConfig";

export const SHADOW_EVALUATION_VERSION = "12.0.0-shadow";

/** 実 traffic split は無効。設計だけ先に置く */
export const SHADOW_AB_SPLIT_ENABLED = false;

export const SHADOW_TOP_K = 3;

export const SHADOW_MIN_SAMPLE = DISCREPANCY_MIN_SAMPLE;
