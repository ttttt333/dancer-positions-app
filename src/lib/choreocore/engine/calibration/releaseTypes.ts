import type { WeightApprovalLayer } from "./weightApprovalTypes";

export type ReleaseStatus =
  | "INSUFFICIENT"
  | "NOT_ELIGIBLE"
  | "READY_FOR_RELEASE"
  | "APPROVED_FOR_CANARY"
  | "CANARY"
  | "CANARY_PASSED"
  | "RELEASED"
  | "REJECTED"
  | "HOLD"
  | "ROLLBACK";

export type ReleaseDecision = "RELEASE" | "HOLD" | "REJECT";

export type AlgorithmVersions = {
  music: string;
  cue: string;
  intent: string;
  formation: string;
  transition: string;
};

export type ReleaseScope = {
  formation: "V1" | "V2" | "unchanged";
  transition: "V1" | "V2" | "unchanged";
  music: "unchanged";
  cue: "unchanged";
  intent: "unchanged";
};

export type ReleaseReview = {
  reviewId: string;
  packageId: string;
  decision: ReleaseDecision;
  reviewerId: string;
  reason: string;
  reviewedAt: string;
};

export type ReleasePackage = {
  packageId: string;
  layer: WeightApprovalLayer;
  formationWeightsVersion: string;
  transitionWeightsVersion: string;
  formationWeights: Record<string, number>;
  transitionWeights: Record<string, number>;
  algorithmVersions: AlgorithmVersions;
  analysisVersion: string;
  releaseGateVersion: string;
  approvalVersion: string;
  sourceProposalId: string;
  approvalId: string;
  shadowReportId: string;
  status: ReleaseStatus;
  createdAt: string;
  applied: false | true;
  autoReleased: false;
  scope: ReleaseScope;
  rationale: {
    why: string[];
    evidence: string[];
    shadowResult: string;
    risk: string[];
    rollback: string;
  };
  checklist: Record<string, boolean>;
  reviews: ReleaseReview[];
};

export type WeightResolution = {
  layer: WeightApprovalLayer;
  version: string;
  weights: Record<string, number>;
  releasePackageId?: string;
  fallback: boolean;
  error?: string;
};

export type CanaryAssignment = {
  packageId: string;
  projectKey: string;
  arm: "v1" | "v2";
  stable: true;
  splitEnabled: boolean;
};
