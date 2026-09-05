import type { CandidateOutcomeKind, DiscrepancyConfidence } from "./discrepancyTypes";
import type { WeightApprovalLayer, WeightApprovalVersions } from "./weightApprovalTypes";

export type ShadowStatus = "INSUFFICIENT" | "PROMISING" | "REGRESSION" | "HOLD" | "UNAVAILABLE";

export type ShadowDiscrepancyKind =
  | "RANK_CHANGED"
  | "TOP1_CHANGED"
  | "CANDIDATE_SET_CHANGED"
  | "SCORE_SHIFTED";

export type ProductionScore = {
  score: number;
  rank: number;
  weightsVersion: string;
};

export type ShadowScore = {
  score: number;
  rank: number;
  weightsVersion: string;
  unavailable?: boolean;
};

export type ShadowEvaluation = {
  evaluationId: string;
  candidateId: string;
  contextKey: string;
  layer: WeightApprovalLayer;
  production: ProductionScore;
  shadow: ShadowScore;
  scoreDelta: number | null;
  rankDelta: number | null;
  productionHumanOutcome?: CandidateOutcomeKind;
  counterfactual: "unknown";
  createdAt: string;
};

export type ShadowComparison = {
  contextKey: string;
  layer: WeightApprovalLayer;
  v1Top1: string | null;
  v2Top1: string | null;
  v1Ranking: string[];
  v2Ranking: string[];
  candidateSetChanged: boolean;
  rankingChanged: boolean;
  top1Changed: boolean;
  productionHumanOutcome?: CandidateOutcomeKind;
  categories: ShadowDiscrepancyKind[];
};

export type ShadowObservational = {
  v1Top1AcceptUnchanged: number;
  v2Top1AcceptUnchanged: number;
  v1Top1Reject: number;
  v2Top1Reject: number;
  comparableGroups: number;
};

export type ExperimentAssignment = {
  experimentId: string;
  stableKey: string;
  arm: "production";
  shadowEnabled: boolean;
  splitEnabled: false;
};

export type ShadowReport = {
  analysisVersion: string;
  layer: WeightApprovalLayer;
  status: ShadowStatus;
  confidence: DiscrepancyConfidence;
  autoPromoted: false;
  productionWeightsVersion: string;
  shadowWeightsVersion: string;
  versions: WeightApprovalVersions;
  sampleSize: number;
  contextCount: number;
  evaluations: ShadowEvaluation[];
  comparisons: ShadowComparison[];
  observational: ShadowObservational;
  formation?: { top1Changed: number; setChanged: number };
  transition?: { top1Changed: number; setChanged: number };
  observed: string[];
  hypothesis: string[];
  notes: string[];
};
