import type { FormationCandidateHumanRating } from "../formation/intentFormationTypes";
import type { TransitionHumanRating } from "../movement/transitionIntelligenceTypes";
import type { HUMAN_EVAL_DECISIONS } from "./humanEvaluationConfig";

export type HumanEvalDecision = (typeof HUMAN_EVAL_DECISIONS)[number];
export type HumanJudgment = FormationCandidateHumanRating;
export type EvaluatorSource = "editor" | "internal";
export type EvaluationPreview =
  | "candidate-only"
  | "music+formation"
  | "music+formation+transition";

export type HumanEvalSubjectKind = "formation" | "transition";

export type HumanEvalSubject = {
  kind: HumanEvalSubjectKind;
  candidateId: string;
  transitionId?: string;
  musicId?: string;
  cueId?: string;
  intent?: string;
  formationType?: string;
  pathKind?: string;
  assignment?: string;
  dancerCount?: number;
  availableSeconds?: number;
};

export type AiScoreSnapshot = {
  overall: number;
  breakdown: Record<string, number>;
  rank?: number;
  weights: Record<string, number>;
  weightsVersion: string;
};

export type AlgorithmVersions = {
  algorithmVersion: string;
  analysisVersion: string;
  scoreWeightsVersion: string;
  intentVersion?: string;
  candidateVersion?: string;
  transitionVersion?: string;
};

export type HumanEvalDimensions = {
  formationQuality?: number;
  transitionQuality?: number;
  visualImpact?: number;
  movementNaturalness?: number;
  musicalFit?: number;
  overallJudgment?: HumanJudgment | TransitionHumanRating;
};

export type HumanEditSignal = {
  positionChanged?: boolean;
  formationChanged?: boolean;
  assignmentChanged?: boolean;
  pathChanged?: boolean;
  timingChanged?: boolean;
};

export type HumanEvaluatorContext = {
  source: EvaluatorSource;
  evaluatorId?: string;
  blind?: boolean;
  preview?: EvaluationPreview;
};

export type HumanEvaluationRecord = {
  evaluationId: string;
  subject: HumanEvalSubject;
  decision: HumanEvalDecision;
  humanJudgment: HumanJudgment | TransitionHumanRating;
  dimensions?: HumanEvalDimensions;
  editSignal?: HumanEditSignal;
  aiScoreSnapshot: AiScoreSnapshot;
  evaluatorContext?: HumanEvaluatorContext;
  algorithmVersion: string;
  analysisVersion: string;
  scoreWeightsVersion: string;
  intentVersion?: string;
  candidateVersion?: string;
  transitionVersion?: string;
  createdAt: string;
};

export type PairwisePreference = "A" | "B" | "EQUAL";

export type PairwiseEvaluation = {
  pairwiseId: string;
  candidateAId: string;
  candidateBId: string;
  preference: PairwisePreference;
  evaluatorContext?: HumanEvaluatorContext;
  algorithmVersion: string;
  createdAt: string;
};

export type HumanEvaluationStore = {
  schemaVersion: string;
  records: HumanEvaluationRecord[];
  pairwise: PairwiseEvaluation[];
};

export type CalibrationConfidence = "insufficient" | "low" | "moderate" | "usable";

export type AxisHypothesis = {
  axis: string;
  direction: "over-weighted" | "under-weighted";
  evidence: string;
};

export type RankAgreement = {
  groups: number;
  top1Agreement: number;
  top3Agreement: number;
  spearman: number;
};

export type CalibrationReport = {
  analysisVersion: string;
  sampleSize: number;
  pairwiseCount: number;
  confidence: CalibrationConfidence;
  autoApplied: false;
  aiVsHuman: {
    highAiRejectCount: number;
    lowAiAcceptCount: number;
    meanAiWhenGood: number;
    meanAiWhenWrong: number;
  };
  axisHypotheses: AxisHypothesis[];
  rankAgreement: RankAgreement | null;
  pairwiseAgreement: number | null;
  notes: string[];
};

export type WeightProposal = {
  layer: HumanEvalSubjectKind;
  weightsVersionCurrent: string;
  weightsVersionProposed: string;
  current: Record<string, number>;
  proposed: Record<string, number>;
  deltas: Record<string, number>;
  rationale: string[];
  sampleSize: number;
  confidence: CalibrationConfidence;
  autoApplied: false;
};

export type WeightSimulation = {
  weightsVersionBefore: string;
  weightsVersionAfter: string;
  before: RankAgreement;
  after: RankAgreement;
  improved: boolean;
  autoApplied: false;
};
