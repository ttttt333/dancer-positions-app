import type {
  AiFormationRank,
  FormationMetrics,
  HumanFormationRating,
} from "../types/EvaluationTypes";
import { clamp, finite, mean, spearman } from "./EvaluationMetrics";

function averageHumanByType(
  ratings: HumanFormationRating[]
): Map<string, number> {
  const buckets = new Map<string, number[]>();
  for (const r of ratings) {
    const list = buckets.get(r.formationType) ?? [];
    list.push(r.score);
    buckets.set(r.formationType, list);
  }
  const avg = new Map<string, number>();
  for (const [type, scores] of [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    avg.set(type, mean(scores));
  }
  return avg;
}

function aiRanked(ranks: AiFormationRank[]): string[] {
  return [...ranks]
    .sort((a, b) => b.score - a.score || a.formationType.localeCompare(b.formationType))
    .map((r) => r.formationType);
}

export function evaluateFormations(
  aiRanks: AiFormationRank[],
  human: HumanFormationRating[]
): FormationMetrics {
  if (human.length === 0 && aiRanks.length === 0) {
    return { top1Agreement: 1, top3Agreement: 1, top5Agreement: 1, rankCorrelation: 1 };
  }
  if (human.length === 0 || aiRanks.length === 0) {
    return { top1Agreement: 0, top3Agreement: 0, top5Agreement: 0, rankCorrelation: 0 };
  }
  const humanAvg = averageHumanByType(human);
  const humanOrder = [...humanAvg.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  const topHuman = humanOrder[0]?.[0];
  const ranked = aiRanked(aiRanks);
  const uniqueAi: string[] = [];
  for (const type of ranked) {
    if (!uniqueAi.includes(type)) uniqueAi.push(type);
  }
  const inTop = (k: number) =>
    topHuman ? (uniqueAi.slice(0, k).includes(topHuman) ? 1 : 0) : 0;
  const shared = humanOrder
    .map(([type]) => type)
    .filter((t) => uniqueAi.includes(t))
    .sort((a, b) => a.localeCompare(b));
  let correlation = 0;
  if (shared.length >= 2) {
    const hScores = shared.map((t) => humanAvg.get(t) ?? 0);
    const aScores = shared.map((t) => aiRanks.find((r) => r.formationType === t)?.score ?? 0);
    correlation = spearman(hScores, aScores);
  } else if (shared.length === 1) {
    correlation = uniqueAi[0] === shared[0] ? 1 : 0;
  }
  return {
    top1Agreement: inTop(1),
    top3Agreement: inTop(3),
    top5Agreement: inTop(5),
    rankCorrelation: clamp(finite(correlation), -1, 1),
  };
}
