import type {
  AiTransitionEval,
  CriticalError,
  HumanFormationRating,
  TransitionMetrics,
} from "../types/EvaluationTypes";
import { clamp, finite, mae, pearson, rmse } from "./EvaluationMetrics";

export function evaluateTransitions(
  ai: AiTransitionEval[],
  human: HumanFormationRating[],
  songId?: string
): { metrics: TransitionMetrics; errors: CriticalError[] } {
  const errors: CriticalError[] = [];
  if (ai.length === 0 && human.length === 0) {
    return {
      metrics: { mae: 0, rmse: 0, correlation: 1, unsafeRecommendationRate: 0 },
      errors,
    };
  }
  const n = Math.min(ai.length, human.length);
  const predicted: number[] = [];
  const actual: number[] = [];
  for (let i = 0; i < n; i += 1) {
    predicted.push(ai[i]!.transitionScore);
    actual.push(human[i]!.transitionQuality);
  }
  if (n === 0 && ai.length > 0) {
    for (const t of ai) predicted.push(t.transitionScore);
  }
  let unsafe = 0;
  let recommended = 0;
  const count = Math.max(ai.length, 1);
  for (let i = 0; i < ai.length; i += 1) {
    const t = ai[i]!;
    recommended += 1;
    const h = human[i];
    const humanUnsafe = h ? h.execution < 40 : false;
    if (t.unsafe || (!t.feasible && t.transitionScore >= 70) || (t.feasible && humanUnsafe)) {
      unsafe += 1;
      if (t.feasible && humanUnsafe) {
        errors.push({
          type: "UNSAFE_MOVEMENT",
          severity: "HIGH",
          message: "AI marked feasible while human rated execution unsafe",
          songId,
        });
      }
    }
  }
  return {
    metrics: {
      mae: predicted.length && actual.length ? mae(predicted, actual) : 0,
      rmse: predicted.length && actual.length ? rmse(predicted, actual) : 0,
      correlation: predicted.length >= 2 && actual.length >= 2 ? pearson(predicted, actual) : predicted.length === 1 && actual.length === 1 ? 1 : 0,
      unsafeRecommendationRate: clamp(finite(unsafe / count), 0, 1),
    },
    errors,
  };
}
