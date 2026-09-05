/**
 * Stage 16 Formation V2 Controlled Canary — インフラ。
 * 実 Canary は Stage 15 APPROVED_FOR_CANARY の明示起動だけ。自動昇格しない。
 */

import { RELEASE_CANARY_PERCENT } from "./releaseConfig";

export const FORMATION_CANARY_VERSION = "16.0.0-formation-canary";
export const FORMATION_CANARY_STORAGE_KEY = "choreocore.formationCanary.v1";

export const FORMATION_CANARY_ASSIGNMENT_MODE = "DETERMINISTIC_PERCENT" as const;
export const FORMATION_CANARY_ASSIGNMENT_KEY = "projectKey" as const;

/** 起動時の既定割合。自動で増やさない */
export const FORMATION_CANARY_DEFAULT_PERCENT = RELEASE_CANARY_PERCENT;

export const FORMATION_CANARY_HEALTH_HEURISTICS = {
  fallbackWarn: 1,
  fallbackRegression: 3,
  applyFailureWarn: 1,
} as const;
