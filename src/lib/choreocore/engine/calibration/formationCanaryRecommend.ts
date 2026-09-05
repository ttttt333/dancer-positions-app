/**
 * Canary 時だけ Formation 重みを差し替える。エンジン本体は書き換えない。
 * V2 失敗は V1 に戻す。Editor は落とさない。
 */

import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import {
  recommendFormationsForIntent,
  recommendFormationsForIntentSequence,
} from "../formation/intentFormationIntelligence";
import type {
  FormationIntelligenceReport,
  FormationIntelligenceRequest,
  FormationRecommendation,
} from "../formation/intentFormationTypes";
import {
  incrementCanarySafety,
  resolveFormationCanaryWeights,
  scoreWeightsForSuggest,
} from "./formationCanary";
import type { FormationCanaryActivation, FormationCanaryResolution } from "./formationCanaryTypes";

function malformed(recommendation: FormationRecommendation): boolean {
  if (recommendation.ranked.some((row) => !row.candidateId || !Number.isFinite(row.score))) {
    return true;
  }
  return false;
}

export function recommendFormationsWithCanary(
  request: FormationIntelligenceRequest,
  input: {
    projectKey: string;
    activation?: FormationCanaryActivation | null;
    safetyAt?: string;
    forceScoreThrow?: boolean;
    forceMalformed?: boolean;
    forceGenerationFailure?: boolean;
  }
): { recommendation: FormationRecommendation; resolution: FormationCanaryResolution } {
  const resolution = resolveFormationCanaryWeights({
    projectKey: input.projectKey,
    activation: input.activation,
    safetyAt: input.safetyAt,
  });
  const v1 = () => recommendFormationsForIntent(request);
  if (resolution.canaryOff || resolution.arm === "V1" || resolution.fallback) {
    return { recommendation: v1(), resolution };
  }
  try {
    if (input.forceGenerationFailure) throw new Error("v2-generation-failed");
    if (input.forceScoreThrow) throw new Error("v2-score-throw");
    const recommendation = recommendFormationsForIntent({
      ...request,
      scoreWeights: scoreWeightsForSuggest(resolution),
    });
    if (input.forceMalformed || malformed(recommendation)) {
      if (input.activation) {
        incrementCanarySafety({
          activation: input.activation,
          kind: "invalid_result",
          projectKey: input.projectKey,
          reason: "malformed-v2",
          recordedAt: input.safetyAt ?? input.activation.activatedAt,
        });
      }
      return {
        recommendation: v1(),
        resolution: { ...resolution, arm: "V1", formationVersion: "V1", fallback: true, error: "malformed-v2" },
      };
    }
    return { recommendation, resolution };
  } catch (error) {
    if (input.activation) {
      incrementCanarySafety({
        activation: input.activation,
        kind: input.forceGenerationFailure ? "generation_failure" : "fallback_v1",
        projectKey: input.projectKey,
        reason: error instanceof Error ? error.message : "v2-failed",
        recordedAt: input.safetyAt ?? input.activation.activatedAt,
      });
    }
    return {
      recommendation: v1(),
      resolution: {
        ...resolution,
        arm: "V1",
        formationVersion: "V1",
        formationWeights: { ...FORMATION_INTELLIGENCE_WEIGHTS },
        fallback: true,
        error: error instanceof Error ? error.message : "v2-failed",
      },
    };
  }
}

export function recommendSequenceWithCanary(
  args: Parameters<typeof recommendFormationsForIntentSequence>[0],
  resolution: FormationCanaryResolution
): FormationIntelligenceReport {
  const weights = scoreWeightsForSuggest(resolution);
  try {
    return recommendFormationsForIntentSequence({
      ...args,
      scoreWeights: weights,
    });
  } catch {
    return recommendFormationsForIntentSequence(args);
  }
}
