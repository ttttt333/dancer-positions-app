/**
 * Controlled A/B の受け皿だけ。Stage 12 では split しない。
 * 全員 Production V1。Shadow は承認済み V2 の裏計算だけ。
 */

import { SHADOW_AB_SPLIT_ENABLED } from "./shadowConfig";
import type { ExperimentAssignment } from "./shadowTypes";

export function stableExperimentArm(_stableKey: string): "production" {
  return "production";
}

export function assignShadowExperiment(input: {
  experimentId: string;
  stableKey: string;
  shadowApproved: boolean;
}): ExperimentAssignment {
  return {
    experimentId: input.experimentId,
    stableKey: input.stableKey,
    arm: "production",
    shadowEnabled: input.shadowApproved && !SHADOW_AB_SPLIT_ENABLED,
    splitEnabled: false,
  };
}
