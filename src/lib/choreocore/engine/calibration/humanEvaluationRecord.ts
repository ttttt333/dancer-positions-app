import type { RankedFormationCandidate } from "../formation/intentFormationTypes";
import type { RankedTransitionCandidate } from "../movement/transitionIntelligenceTypes";
import {
  FORMATION_INTELLIGENCE_VERSION,
  FORMATION_INTELLIGENCE_WEIGHTS,
} from "../formation/intentFormationConfig";
import {
  TRANSITION_INTELLIGENCE_VERSION,
  TRANSITION_SCORE_WEIGHTS,
} from "../movement/transitionIntelligenceConfig";
import { CHOREOGRAPHIC_INTENT_VERSION } from "../intent/ChoreographicIntentEngine";
import { FORMATION_CANDIDATE_VERSION } from "../types/FormationTypes";
import {
  FORMATION_WEIGHTS_VERSION,
  HUMAN_EVALUATION_VERSION,
  TRANSITION_WEIGHTS_VERSION,
} from "./humanEvaluationConfig";
import type {
  HumanEvalDecision,
  HumanEvaluationRecord,
  HumanEvalSubject,
  PairwiseEvaluation,
  PairwisePreference,
  HumanEvaluatorContext,
  HumanEditSignal,
  HumanEvalDimensions,
  HumanJudgment,
} from "./humanEvaluationTypes";
import type { TransitionHumanRating } from "../movement/transitionIntelligenceTypes";

function isoNow(): string {
  return new Date().toISOString();
}

function stableId(prefix: string, parts: string[]): string {
  return `${prefix}-${parts.join("-")}`;
}

export function decisionToFormationJudgment(decision: HumanEvalDecision): HumanJudgment {
  if (decision === "accept") return "good";
  if (decision === "edit") return "acceptable";
  return "wrong";
}

export function decisionToTransitionJudgment(
  decision: HumanEvalDecision
): TransitionHumanRating {
  if (decision === "accept") return "natural";
  if (decision === "edit") return "acceptable";
  return "awkward";
}

export function createHumanEvaluationRecord(input: {
  subject: HumanEvalSubject;
  decision: HumanEvalDecision;
  humanJudgment?: HumanJudgment | TransitionHumanRating;
  aiScoreSnapshot: HumanEvaluationRecord["aiScoreSnapshot"];
  evaluatorContext?: HumanEvaluatorContext;
  dimensions?: HumanEvalDimensions;
  editSignal?: HumanEditSignal;
  createdAt?: string;
  evaluationId?: string;
  intentVersion?: string;
  candidateVersion?: string;
  transitionVersion?: string;
}): HumanEvaluationRecord {
  const createdAt = input.createdAt ?? isoNow();
  const judgment =
    input.humanJudgment ??
    (input.subject.kind === "transition"
      ? decisionToTransitionJudgment(input.decision)
      : decisionToFormationJudgment(input.decision));
  return {
    evaluationId:
      input.evaluationId ??
      stableId("heval", [
        input.subject.kind,
        input.subject.candidateId,
        input.decision,
        createdAt,
      ]),
    subject: { ...input.subject },
    decision: input.decision,
    humanJudgment: judgment,
    dimensions: input.dimensions,
    editSignal: input.editSignal,
    aiScoreSnapshot: {
      overall: input.aiScoreSnapshot.overall,
      breakdown: { ...input.aiScoreSnapshot.breakdown },
      rank: input.aiScoreSnapshot.rank,
      weights: { ...input.aiScoreSnapshot.weights },
      weightsVersion: input.aiScoreSnapshot.weightsVersion,
    },
    evaluatorContext: input.evaluatorContext,
    algorithmVersion: HUMAN_EVALUATION_VERSION,
    analysisVersion: HUMAN_EVALUATION_VERSION,
    scoreWeightsVersion: input.aiScoreSnapshot.weightsVersion,
    intentVersion: input.intentVersion ?? CHOREOGRAPHIC_INTENT_VERSION,
    candidateVersion: input.candidateVersion ?? FORMATION_CANDIDATE_VERSION,
    transitionVersion: input.transitionVersion,
    createdAt,
  };
}

export function recordFromFormationCandidate(input: {
  candidate: RankedFormationCandidate;
  decision: HumanEvalDecision;
  musicId?: string;
  cueId?: string;
  intent?: string;
  dancerCount?: number;
  evaluatorContext?: HumanEvaluatorContext;
  editSignal?: HumanEditSignal;
  createdAt?: string;
  evaluationId?: string;
}): HumanEvaluationRecord {
  const c = input.candidate;
  return createHumanEvaluationRecord({
    subject: {
      kind: "formation",
      candidateId: c.candidateId,
      musicId: input.musicId,
      cueId: input.cueId,
      intent: input.intent,
      formationType: c.formation.type,
      dancerCount: input.dancerCount,
    },
    decision: input.decision,
    aiScoreSnapshot: {
      overall: c.score,
      breakdown: {
        intentAlignment: c.intentAlignment,
        visualImpact: c.visualImpact,
        transitionQuality: c.transitionQuality,
        movementEfficiency: c.movementEfficiency,
        stageUsage: c.stageUsage,
        roleCompatibility: c.roleCompatibility,
      },
      weights: { ...FORMATION_INTELLIGENCE_WEIGHTS },
      weightsVersion: FORMATION_WEIGHTS_VERSION,
    },
    evaluatorContext: input.evaluatorContext,
    editSignal: input.editSignal,
    createdAt: input.createdAt,
    evaluationId: input.evaluationId,
    intentVersion: CHOREOGRAPHIC_INTENT_VERSION,
    candidateVersion: FORMATION_INTELLIGENCE_VERSION,
  });
}

export function recordFromTransitionCandidate(input: {
  candidate: RankedTransitionCandidate;
  decision: HumanEvalDecision;
  musicId?: string;
  cueId?: string;
  availableSeconds?: number;
  evaluatorContext?: HumanEvaluatorContext;
  editSignal?: HumanEditSignal;
  createdAt?: string;
  evaluationId?: string;
}): HumanEvaluationRecord {
  const c = input.candidate;
  return createHumanEvaluationRecord({
    subject: {
      kind: "transition",
      candidateId: c.id,
      transitionId: c.id,
      musicId: input.musicId,
      cueId: input.cueId,
      pathKind: c.pathKind,
      assignment: c.assignment,
      availableSeconds: input.availableSeconds,
    },
    decision: input.decision,
    aiScoreSnapshot: {
      overall: c.evaluation.score,
      breakdown: {
        pathCost: c.evaluation.pathCost,
        collisionRisk: c.evaluation.collisionRisk,
        crossingRisk: c.evaluation.crossingRisk,
        speedPressure: c.evaluation.speedPressure,
        smoothness: c.evaluation.smoothness,
        arrivalSync: c.evaluation.arrivalSync,
      },
      weights: { ...TRANSITION_SCORE_WEIGHTS },
      weightsVersion: TRANSITION_WEIGHTS_VERSION,
    },
    evaluatorContext: input.evaluatorContext,
    editSignal: input.editSignal,
    createdAt: input.createdAt,
    evaluationId: input.evaluationId,
    transitionVersion: TRANSITION_INTELLIGENCE_VERSION,
  });
}

export function createPairwiseEvaluation(input: {
  candidateAId: string;
  candidateBId: string;
  preference: PairwisePreference;
  evaluatorContext?: HumanEvaluatorContext;
  createdAt?: string;
  pairwiseId?: string;
}): PairwiseEvaluation {
  const createdAt = input.createdAt ?? isoNow();
  return {
    pairwiseId:
      input.pairwiseId ??
      stableId("pair", [input.candidateAId, input.candidateBId, input.preference, createdAt]),
    candidateAId: input.candidateAId,
    candidateBId: input.candidateBId,
    preference: input.preference,
    evaluatorContext: input.evaluatorContext,
    algorithmVersion: HUMAN_EVALUATION_VERSION,
    createdAt,
  };
}
