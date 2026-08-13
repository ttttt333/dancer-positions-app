import type {
  AiSequenceEval,
  HumanSequenceRating,
  SequenceMetrics,
} from "../types/EvaluationTypes";
import { clamp, finite, mae, mean, pearson, rmse } from "./EvaluationMetrics";

export function evaluateSequence(
  ai: AiSequenceEval,
  human: HumanSequenceRating[]
): SequenceMetrics {
  if (human.length === 0) {
    return {
      mae: 0,
      rmse: 0,
      correlation: 1,
      topSequenceAgreement: 1,
      humanOverall: 0,
      normalizedAiScore: clamp(ai.totalScore, 0, 100),
      absoluteGap: 0,
    };
  }
  const overalls = human.map((h) => h.overall);
  const humanOverall = mean(overalls);
  const aiScore = clamp(ai.totalScore, 0, 100);
  const predicted = overalls.map(() => aiScore);
  const agreement =
    human.some((h) => {
      if (h.formationIds.length === 0 || ai.formationTypes.length === 0) return true;
      const a = [...h.formationIds].sort().join("|");
      const b = [...ai.formationTypes].sort().join("|");
      if (a === b) return true;
      const overlap = h.formationIds.filter((id) => ai.formationTypes.includes(id)).length;
      return overlap / Math.max(h.formationIds.length, 1) >= 0.6;
    })
      ? 1
      : 0;
  // One AI sequence score vs N human overalls has no varying predictor.
  // Use closeness-to-mean as the correlation proxy; Spearman when both vary.
  const predictedUnique = new Set(predicted).size;
  const actualUnique = new Set(overalls).size;
  const gapScore = clamp(1 - Math.abs(aiScore - humanOverall) / 50, -1, 1);
  const corr =
    predictedUnique > 1 && actualUnique > 1 ? pearson(predicted, overalls) : gapScore;
  return {
    mae: mae(predicted, overalls),
    rmse: rmse(predicted, overalls),
    correlation: clamp(finite(corr), -1, 1),
    topSequenceAgreement: agreement,
    humanOverall,
    normalizedAiScore: clamp(ai.totalScore, 0, 100),
    absoluteGap: Math.abs(ai.totalScore - humanOverall),
  };
}
