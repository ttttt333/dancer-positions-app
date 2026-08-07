/**
 * テンプレ候補プールからスコア最大の隊列を選定（決定的）
 */

import { solveMinDisplacementAssignment, assignmentToFormation } from "./assignment";
import { computeFormationScore } from "./score";
import type {
  Formation,
  FormationScore,
  FormationTemplate,
  FormationWeights,
  PickResult,
  SuggestFeedback,
} from "./types";

function resolveWeights(feedback?: SuggestFeedback): Partial<FormationWeights> {
  const w: Partial<FormationWeights> = { ...feedback?.weightOverrides };
  if (feedback?.preferLessMovement) {
    w.move = Math.max(w.move ?? 0.6, 0.75);
    w.safety = w.safety ?? 0.25;
  }
  if (feedback?.preferFewerCrossings) {
    w.safety = Math.max(w.safety ?? 0.4, 0.7);
    w.move = w.move ?? 0.3;
  }
  return w;
}

export type PickFormationOptions = {
  maxFeasibleDistance: number;
  performerOverrides?: Map<string, number> | null;
  feedback?: SuggestFeedback;
  /** フォールバック用の広めプール（primary 全滅時） */
  fallbackPool?: FormationTemplate[];
};

/**
 * 候補テンプレを ID 順に評価し、総合スコア最大を返す。
 */
export function pickBestScoredFormation(
  prev: Formation,
  primaryPool: FormationTemplate[],
  opts: PickFormationOptions
): PickResult | null {
  const avoid = new Set(opts.feedback?.avoidLayoutIds ?? []);
  const weightOverrides = resolveWeights(opts.feedback);

  const evaluatePool = (
    pool: FormationTemplate[],
    usedFallback: boolean
  ): PickResult | null => {
    const sorted = [...pool]
      .filter((t) => !avoid.has(t.id))
      .sort((a, b) => a.id.localeCompare(b.id));

    let best: PickResult | null = null;

    for (const template of sorted) {
      const result = solveMinDisplacementAssignment(
        prev,
        template.slots,
        opts.maxFeasibleDistance,
        opts.performerOverrides ?? null
      );
      if (!result.feasible && result.assignment.size === 0) continue;

      let score: FormationScore = computeFormationScore(
        result,
        opts.maxFeasibleDistance,
        weightOverrides
      );

      // インパクト希望時は major / impact タグをわずかに加点（説明可能）
      if (
        opts.feedback?.preferMoreImpact &&
        (template.tier === "major" ||
          template.tags?.includes("impact") ||
          template.tags?.includes("chorus"))
      ) {
        score = {
          ...score,
          total: Math.min(100, score.total + 5),
        };
      }

      const pick: PickResult = {
        formation: template,
        assignment: result.assignment,
        score,
        totalDisplacement: result.totalDisplacement,
        averageDisplacement: result.averageDisplacement,
        displacementVariance: result.displacementVariance,
        maxIndividualDisplacement: result.maxIndividualDisplacement,
        warning:
          !result.feasible || result.pinnedOverLimitPerformerIds.length > 0,
        usedFallbackPool: usedFallback,
        pinnedOverLimitPerformerIds: result.pinnedOverLimitPerformerIds,
        crossings: result.crossings,
      };

      if (
        !best ||
        pick.score.total > best.score.total ||
        (pick.score.total === best.score.total &&
          pick.formation.id.localeCompare(best.formation.id) < 0)
      ) {
        best = pick;
      }
    }
    return best;
  };

  const primary = evaluatePool(primaryPool, false);
  if (primary) return primary;
  if (opts.fallbackPool?.length) {
    return evaluatePool(opts.fallbackPool, true);
  }
  return null;
}

export function pickResultToFormation(
  prev: Formation,
  pick: PickResult
): Formation {
  return assignmentToFormation(prev, pick.assignment, pick.formation.id);
}
