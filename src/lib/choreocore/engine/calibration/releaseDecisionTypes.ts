import type { ReleaseDecision, ReleasePackage, ReleaseStatus } from "./releaseTypes";
import type { EvidenceQuality, EvidenceReadiness } from "./realWorldEvidenceTypes";
import type { WeightApprovalLayer } from "./weightApprovalTypes";

export type ReleaseDecisionDataSource = "REAL" | "FIXTURE";

export type ReleaseDecisionStatus =
  | "NOT_ELIGIBLE"
  | "READY_FOR_RELEASE"
  | "APPROVED_FOR_CANARY"
  | "HOLD"
  | "REJECTED";

export type ReleaseHardBlocker =
  | "INSUFFICIENT_SAMPLE"
  | "LOW_PROJECT_DIVERSITY"
  | "LOW_SESSION_DIVERSITY"
  | "LOW_USER_DIVERSITY"
  | "LOW_SONG_DIVERSITY"
  | "SHADOW_EVIDENCE_MISSING"
  | "SHADOW_UNAVAILABLE"
  | "VERSION_MISMATCH"
  | "MAJOR_REGRESSION"
  | "TOP1_REGRESSION"
  | "APPROVAL_MISSING"
  | "PACKAGE_INVALID";

export type ReleaseDecisionWarning =
  | ReleaseHardBlocker
  | "LOW_ACTION_DIVERSITY"
  | "FIXTURE_DATA_NOT_PRODUCTION_EVIDENCE"
  | "SOFT_EVIDENCE_INFORMATIONAL_ONLY";

export type ChecklistVerdict = "PASS" | "BLOCKED";

export type ReleaseChecklistKey =
  | "HUMAN_EVALUATION"
  | "REAL_WORLD_SAMPLE"
  | "PROJECT_DIVERSITY"
  | "SESSION_DIVERSITY"
  | "USER_DIVERSITY"
  | "SONG_DIVERSITY"
  | "SHADOW_EVIDENCE"
  | "VERSION_INTEGRITY"
  | "REGRESSION_SAFETY"
  | "STAGE_11_APPROVAL"
  | "STAGE_13_RELEASE_PACKAGE";

export type ReleaseChecklistItem = {
  key: ReleaseChecklistKey;
  verdict: ChecklistVerdict;
};

export type EvidenceNeededItem = {
  key: string;
  label: string;
  met: boolean;
};

export type DimensionVerdict = {
  evidenceSufficiency: ChecklistVerdict;
  evidenceDiversity: ChecklistVerdict;
  shadowEvidence: ChecklistVerdict;
  regressionSafety: ChecklistVerdict;
  versionIntegrity: ChecklistVerdict;
  humanApproval: ChecklistVerdict;
};

export type SoftEvidence = {
  formationAcceptRate: number | null;
  formationRejectRate: number | null;
  formationEditRate: number | null;
  formationUnchangedRate: number | null;
  transitionEditRate: number | null;
  shadowTop1Changed: number;
  shadowTop3Changed: number;
  meanScoreDelta: number | null;
  meanRankDelta: number | null;
  note: "Soft evidence cannot override hard blockers.";
};

export type ReleaseEvidenceReview = {
  domain: WeightApprovalLayer;
  releasePackageId?: string;
  dataSource: ReleaseDecisionDataSource;
  evidenceStatus: EvidenceReadiness;
  evidenceQuality: EvidenceQuality;
  sampleCount: number;
  projectCount: number;
  sessionCount: number;
  userCount: number;
  songCount: number;
  formationAcceptRate: number | null;
  formationRejectRate: number | null;
  formationEditRate: number | null;
  formationUnchangedRate: number | null;
  transitionEditRate: number | null;
  shadowAvailable: boolean;
  shadowEvaluatedCount: number;
  shadowTop1Changed: number;
  shadowTop3Changed: number;
  regressionStatus: "PASS" | "MAJOR_REGRESSION" | "TOP1_REGRESSION" | "UNKNOWN";
  blockers: ReleaseHardBlocker[];
  warnings: ReleaseDecisionWarning[];
};

export type ReleaseDecisionReviewRecord = {
  reviewId: string;
  reviewerId: string;
  decision: ReleaseDecision;
  reason: string;
  reviewedAt: string;
  releasePackageId: string;
  evidenceSnapshotVersion: string;
  dataSource: ReleaseDecisionDataSource;
  domain: WeightApprovalLayer;
};

export type ReleaseDecisionReport = {
  analysisVersion: string;
  dataSource: ReleaseDecisionDataSource;
  domain: WeightApprovalLayer;
  status: ReleaseDecisionStatus;
  humanDecision: ReleaseDecision | null;
  productionCanaryEligible: false | true;
  canProceedToCanary: false | true;
  evidenceSnapshotVersion: string;
  review: ReleaseEvidenceReview;
  dimensions: DimensionVerdict;
  checklist: ReleaseChecklistItem[];
  evidenceNeeded: EvidenceNeededItem[];
  hardBlockers: ReleaseHardBlocker[];
  warnings: ReleaseDecisionWarning[];
  softEvidence: SoftEvidence;
  reviews: ReleaseDecisionReviewRecord[];
  releasePackage?: ReleasePackage;
  notes: string[];
};

export function isStage15DecisionStatus(status: ReleaseStatus): status is ReleaseDecisionStatus {
  return (
    status === "NOT_ELIGIBLE" ||
    status === "READY_FOR_RELEASE" ||
    status === "APPROVED_FOR_CANARY" ||
    status === "HOLD" ||
    status === "REJECTED"
  );
}
