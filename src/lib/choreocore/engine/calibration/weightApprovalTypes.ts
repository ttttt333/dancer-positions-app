import type { DiscrepancyCategory, DiscrepancyConfidence } from "./discrepancyTypes";
import type { WeightProposal } from "./humanEvaluationTypes";

export type WeightApprovalStatus =
  | "INSUFFICIENT"
  | "PROPOSED"
  | "SIMULATED"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "REJECTED";

export type WeightApprovalDecision = "APPROVE" | "REJECT";

export type WeightApprovalLayer = "formation" | "transition";

export type WeightApprovalVersions = {
  datasetVersion: string;
  algorithmVersion: string;
  analysisVersion: string;
  approvalVersion: string;
  weightsVersionCurrent: string;
  weightsVersionProposed: string;
  intentVersion?: string;
  candidateVersion?: string;
  transitionVersion?: string;
};

export type WeightApprovalEvidence = {
  finding: DiscrepancyCategory | "AXIS_HYPOTHESIS";
  sampleSize: number;
  confidence: DiscrepancyConfidence;
  affectedLayer: WeightApprovalLayer;
  affectedMetric?: string;
  observed: string[];
  hypothesis: string[];
};

export type MetricComparison = {
  key: string;
  v1: number | null;
  v2: number | null;
  delta: number | null;
  direction: "improved" | "unchanged" | "worsened" | "unknown";
};

export type SimulationComparison = {
  metrics: MetricComparison[];
  improvedCount: number;
  worsenedCount: number;
  criticalRegressions: string[];
  tradeoffs: string[];
  overallImproved: boolean;
  readyForReview: boolean;
  notes: string[];
};

export type WeightApprovalReview = {
  reviewId: string;
  proposalId: string;
  decision: WeightApprovalDecision;
  reviewerId: string;
  reason: string;
  reviewedAt: string;
};

export type WeightApprovalPackage = {
  proposalId: string;
  layer: WeightApprovalLayer;
  status: WeightApprovalStatus;
  autoApplied: false;
  applied: false;
  disabled: boolean;
  versions: WeightApprovalVersions;
  createdAt: string;
  evidence: WeightApprovalEvidence[];
  proposal: WeightProposal;
  comparison: SimulationComparison | null;
  reviews: WeightApprovalReview[];
  notes: string[];
};

export type WeightApprovalReviewResult = {
  package: WeightApprovalPackage;
  accepted: boolean;
  reason: string;
};
