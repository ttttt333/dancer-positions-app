import type { FormationCandidate } from "../types/FormationTypes";
import type { TransitionAnalysis } from "../types/MovementTypes";
import type { CandidateScore, CandidateScoringContext } from "../types/ScoringTypes";
import { DEFAULT_BEAM_SEARCH_CONFIG, resolveCandidateWeights } from "./ScoreWeights";
import { clamp, finite, mean } from "./scoreMath";
import { musicFitScore } from "./MusicFitScore";
import { visualImpactScore } from "./VisualImpactScore";
import { transitionQualityScore } from "./TransitionQualityScore";
import { feasibilityScore, isHardRejected } from "./FeasibilityScore";
import { spacingScore } from "./SpacingScore";
import { symmetryScore } from "./SymmetryScore";
import { complexityScore } from "./ComplexityScore";
import {
  noveltyScore,
  repetitionPenaltyValue,
  visualMonotonyPenalty,
} from "./NoveltyScore";

export function scoreFormationCandidate(
  context: CandidateScoringContext,
  candidate: FormationCandidate,
  transition: TransitionAnalysis
): CandidateScore {
  const cfg = { ...DEFAULT_BEAM_SEARCH_CONFIG, ...context.config };
  const weights = context.weights ?? resolveCandidateWeights(context.style, context.cue);
  const previous = context.previousFormations;
  const last = previous[previous.length - 1] ?? context.currentFormation;

  const musicFit = musicFitScore({
    candidate,
    cue: context.cue,
    intent: context.intent,
    section: context.section,
    phrase: context.phrase,
  });
  const visualImpact = visualImpactScore({ candidate, cue: context.cue });
  const transitionQuality = transitionQualityScore(transition);
  const feasibility = feasibilityScore(transition);
  const spacing = spacingScore(candidate.formation, context.stage);
  const symmetry = symmetryScore(candidate.formation, context.style);
  const complexity = complexityScore(candidate.formation, context.cue);
  const novelty = noveltyScore(last, candidate.formation);

  const repetition = repetitionPenaltyValue(previous, candidate.formation, cfg.repetitionPenalty);
  const visualMonotony = visualMonotonyPenalty(previous, candidate.formation, cfg.monotonyPenalty);
  const movementRisk = clamp(transition.risk * 0.15, 0, 25);
  let excessiveChange = 0;
  const recentMajors = previous.slice(-2).length;
  if (
    recentMajors >= 2 &&
    (context.cue.magnitude === "LARGE" || context.cue.magnitude === "MAX") &&
    !context.cue.reasonCodes.includes("SECTION_CHANGE") &&
    !context.section?.type.includes("CHORUS")
  ) {
    excessiveChange = 8;
  }
  if (
    context.cue.energyAfter >= 65 &&
    context.cue.deltaEnergy < 8 &&
    context.cue.action === "MAJOR_CHANGE"
  ) {
    excessiveChange += 10;
  }

  const nextScores = context.nextFeasibleScores ?? [];
  const nextNextScores = context.nextNextFeasibleScores ?? [];
  const futurePotential =
    nextScores.length + nextNextScores.length === 0
      ? 70
      : mean([...nextScores, ...nextNextScores.map((s) => s * 0.85)]);

  const trap =
    visualImpact >= 88 && nextScores.length > 0 && Math.max(...nextScores, 0) < 50
      ? cfg.trapPenalty
      : 0;

  const prepBonus =
    (context.cue.action === "MICRO_SHIFT" || context.cue.reasonCodes.includes("ANTICIPATION")) &&
    context.nextCueIsMajor &&
    nextScores.length > 0
      ? clamp((Math.max(...nextScores) - 70) * 0.25, 0, 12)
      : 0;

  const threeStep =
    previous.length >= 1 && nextScores.length > 0
      ? clamp((transitionQuality + Math.max(...nextScores) - 140) * 0.15, -8, 10)
      : 0;

  const weighted =
    musicFit * weights.musicFit +
    visualImpact * weights.visualImpact +
    transitionQuality * weights.transitionQuality +
    feasibility * weights.feasibility +
    spacing * weights.spacing +
    symmetry * weights.symmetry +
    complexity * weights.complexity +
    novelty * weights.novelty;

  const penaltySum = repetition + visualMonotony + movementRisk + excessiveChange + trap;
  let total = weighted - penaltySum + prepBonus + threeStep;
  if (isHardRejected(transition)) total = Math.min(total, 35);
  total = clamp(finite(total), 0, 100);

  const reasons: string[] = [];
  reasons.push(`musicFit=${musicFit.toFixed(1)}`);
  reasons.push(`visual=${visualImpact.toFixed(1)}`);
  reasons.push(`transition=${transitionQuality.toFixed(1)}`);
  reasons.push(`future=${futurePotential.toFixed(1)}`);
  if (repetition > 0) reasons.push("REPETITION");
  if (visualMonotony > 0) reasons.push("MONOTONY");
  if (trap > 0) reasons.push("FORMATION_TRAP");
  if (prepBonus > 0) reasons.push("PREPARATION");
  if (threeStep > 2) reasons.push("CONTINUITY");
  if (threeStep < -2) reasons.push("BAD_MIDDLE");
  if (isHardRejected(transition)) reasons.push(transition.rejectionReason ?? "INFEASIBLE");

  return {
    candidateId: candidate.id,
    musicFit: finite(musicFit),
    visualImpact: finite(visualImpact),
    transitionQuality: finite(transitionQuality),
    feasibility: finite(feasibility),
    spacing: finite(spacing),
    symmetry: finite(symmetry),
    complexity: finite(complexity),
    novelty: finite(novelty),
    futurePotential: finite(futurePotential),
    totalScore: total,
    penalties: {
      repetition: finite(repetition),
      movementRisk: finite(movementRisk),
      excessiveChange: finite(excessiveChange),
      visualMonotony: finite(visualMonotony),
    },
    reasons,
  };
}
