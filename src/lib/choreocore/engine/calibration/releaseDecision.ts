/**
 * Stage 15: Evidence を人がレビューし、Canary へ進めてよいか判断する枠。
 * Production は変えない。RELEASE ≠ Canary ≠ Full Release。
 * 総合点は作らない。Hard blocker は他の好指標で相殺できない。
 */

import { HUMAN_FEEDBACK_VERSION } from "./humanFeedbackConfig";
import { HumanFeedbackSession } from "./humanFeedbackCapture";
import { defaultFeedbackStorage, type FeedbackStorage } from "./humanFeedbackPersist";
import type { HumanEvaluationStore } from "./humanEvaluationTypes";
import { createHumanEvaluationStore } from "./humanEvaluationStore";
import { analyzeRealWorldEvidence } from "./realWorldEvidence";
import type { RealWorldEvidenceReport } from "./realWorldEvidenceTypes";
import { EVIDENCE_QUALITY_HEURISTICS } from "./realWorldEvidenceConfig";
import { buildReleaseCandidate, reviewRelease } from "./releaseGate";
import type { ReleaseDecision, ReleasePackage } from "./releaseTypes";
import {
  RELEASE_CHECKLIST_KEYS,
  RELEASE_DECISION_HEURISTICS,
  RELEASE_DECISION_VERSION,
} from "./releaseDecisionConfig";
import type {
  ChecklistVerdict,
  DimensionVerdict,
  EvidenceNeededItem,
  ReleaseChecklistItem,
  ReleaseDecisionDataSource,
  ReleaseDecisionReport,
  ReleaseDecisionReviewRecord,
  ReleaseDecisionStatus,
  ReleaseDecisionWarning,
  ReleaseEvidenceReview,
  ReleaseHardBlocker,
  SoftEvidence,
} from "./releaseDecisionTypes";
import type { ShadowReport } from "./shadowTypes";
import type { WeightApprovalLayer, WeightApprovalPackage } from "./weightApprovalTypes";

export type ReleaseDecisionInput = {
  dataSource: ReleaseDecisionDataSource;
  domain: WeightApprovalLayer;
  store: HumanEvaluationStore;
  shadow?: ShadowReport;
  approvedWeightPackage?: WeightApprovalPackage | null;
  releasePackage?: ReleasePackage | null;
  expected?: {
    datasetVersion?: string;
    algorithmVersion?: string;
    analysisVersion?: string;
    weightVersion?: string;
    shadowPackageVersion?: string;
    releasePackageId?: string;
  };
};

function scopedStore(store: HumanEvaluationStore, domain: WeightApprovalLayer): HumanEvaluationStore {
  return {
    schemaVersion: store.schemaVersion,
    records: [...store.records]
      .filter((record) => record.subject.kind === domain)
      .sort((a, b) => a.evaluationId.localeCompare(b.evaluationId)),
    pairwise: [...store.pairwise].sort((a, b) => a.pairwiseId.localeCompare(b.pairwiseId)),
  };
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function snapshotVersion(input: {
  evidence: RealWorldEvidenceReport;
  shadow?: ShadowReport;
  approval?: WeightApprovalPackage | null;
  release?: ReleasePackage | null;
}): string {
  return [
    input.evidence.analysisVersion,
    input.evidence.datasetVersion,
    input.shadow?.analysisVersion ?? "no-shadow",
    input.shadow?.shadowWeightsVersion ?? "no-shadow-weights",
    input.approval?.proposalId ?? "no-approval",
    input.approval?.versions.weightsVersionProposed ?? "no-proposed",
    input.release?.packageId ?? "no-release",
  ].join("|");
}

function shadowForDomain(shadow: ShadowReport | undefined, domain: WeightApprovalLayer): ShadowReport | undefined {
  if (!shadow || shadow.layer !== domain) return undefined;
  return shadow;
}

function detectTop1Regression(
  approval: WeightApprovalPackage | null | undefined,
  shadow: ShadowReport | undefined
): boolean {
  const metric = approval?.comparison?.metrics.find((row) => row.key === "top1Agreement");
  if (metric?.direction === "worsened") return true;
  if (approval?.comparison?.criticalRegressions.some((row) => row.toLowerCase().includes("top1"))) {
    return true;
  }
  if (!shadow) return false;
  return (
    shadow.observational.comparableGroups > 0 &&
    shadow.observational.v2Top1Reject > shadow.observational.v1Top1Reject &&
    shadow.observational.v2Top1AcceptUnchanged < shadow.observational.v1Top1AcceptUnchanged
  );
}

function detectMajorRegression(
  approval: WeightApprovalPackage | null | undefined,
  shadow: ShadowReport | undefined
): boolean {
  if (shadow?.status === "REGRESSION") return true;
  const critical = approval?.comparison?.criticalRegressions ?? [];
  return critical.some((row) => !row.toLowerCase().includes("top1"));
}

function collectHardBlockers(input: {
  dataSource: ReleaseDecisionDataSource;
  domain: WeightApprovalLayer;
  store: HumanEvaluationStore;
  evidence: RealWorldEvidenceReport;
  shadow?: ShadowReport;
  approval?: WeightApprovalPackage | null;
  release?: ReleasePackage | null;
  expected?: ReleaseDecisionInput["expected"];
}): { blockers: ReleaseHardBlocker[]; warnings: ReleaseDecisionWarning[] } {
  const h = RELEASE_DECISION_HEURISTICS;
  const quality = input.evidence.evidenceQuality;
  const blockers: ReleaseHardBlocker[] = [];
  const warnings: ReleaseDecisionWarning[] = [];

  if (quality.sampleCount < h.sampleMin) blockers.push("INSUFFICIENT_SAMPLE");
  if (quality.uniqueProjectCount < h.projectMin) blockers.push("LOW_PROJECT_DIVERSITY");
  if (quality.uniqueSessionCount < h.sessionMin) blockers.push("LOW_SESSION_DIVERSITY");
  if (quality.uniqueUserCount < h.userMin) blockers.push("LOW_USER_DIVERSITY");
  if (quality.uniqueSongCount < h.songMin) blockers.push("LOW_SONG_DIVERSITY");

  if (quality.actionDiversity < EVIDENCE_QUALITY_HEURISTICS.lowActionWarn) {
    warnings.push("LOW_ACTION_DIVERSITY");
  }

  if (!input.shadow) blockers.push("SHADOW_EVIDENCE_MISSING");
  else if (input.shadow.status === "UNAVAILABLE" || input.shadow.evaluations.length === 0) {
    if (input.shadow.status === "UNAVAILABLE") blockers.push("SHADOW_UNAVAILABLE");
    if (input.shadow.evaluations.length === 0) blockers.push("SHADOW_EVIDENCE_MISSING");
  }

  if (input.evidence.integrity === "UNAVAILABLE") blockers.push("VERSION_MISMATCH");

  const approval = input.approval;
  if (!approval || approval.status !== "APPROVED") blockers.push("APPROVAL_MISSING");

  const release = input.release;
  if (!release || !release.packageId || release.layer !== input.domain) {
    blockers.push("PACKAGE_INVALID");
  }

  const expected = input.expected;
  if (expected) {
    if (expected.datasetVersion && expected.datasetVersion !== input.store.schemaVersion) {
      blockers.push("VERSION_MISMATCH");
    }
    if (expected.algorithmVersion && expected.algorithmVersion !== HUMAN_FEEDBACK_VERSION) {
      blockers.push("VERSION_MISMATCH");
    }
    if (expected.analysisVersion && input.shadow && expected.analysisVersion !== input.shadow.analysisVersion) {
      blockers.push("VERSION_MISMATCH");
    }
    if (
      expected.weightVersion &&
      approval &&
      approval.versions.weightsVersionCurrent !== expected.weightVersion
    ) {
      blockers.push("VERSION_MISMATCH");
    }
    if (
      expected.shadowPackageVersion &&
      input.shadow &&
      input.shadow.shadowWeightsVersion !== expected.shadowPackageVersion
    ) {
      blockers.push("VERSION_MISMATCH");
    }
    if (expected.releasePackageId && release && release.packageId !== expected.releasePackageId) {
      blockers.push("VERSION_MISMATCH");
    }
  }

  if (approval && input.store.schemaVersion !== approval.versions.datasetVersion) {
    blockers.push("VERSION_MISMATCH");
  }
  if (input.shadow && input.store.schemaVersion !== input.shadow.versions.datasetVersion) {
    blockers.push("VERSION_MISMATCH");
  }
  if (approval && input.shadow && approval.proposalId && input.shadow.versions.weightsVersionProposed) {
    if (approval.versions.weightsVersionProposed !== input.shadow.shadowWeightsVersion) {
      blockers.push("VERSION_MISMATCH");
    }
  }
  if (release && approval && release.sourceProposalId !== approval.proposalId) {
    blockers.push("VERSION_MISMATCH");
  }

  if (detectMajorRegression(approval, input.shadow)) blockers.push("MAJOR_REGRESSION");
  if (detectTop1Regression(approval, input.shadow)) blockers.push("TOP1_REGRESSION");

  if (input.dataSource === "FIXTURE") {
    warnings.push("FIXTURE_DATA_NOT_PRODUCTION_EVIDENCE");
  }
  warnings.push("SOFT_EVIDENCE_INFORMATIONAL_ONLY");

  return {
    blockers: uniqueSorted(blockers),
    warnings: uniqueSorted(warnings),
  };
}

function verdict(blocked: boolean): ChecklistVerdict {
  return blocked ? "BLOCKED" : "PASS";
}

function buildChecklist(blockers: ReleaseHardBlocker[], sampleCount: number): ReleaseChecklistItem[] {
  const has = (code: ReleaseHardBlocker) => blockers.includes(code);
  const map: Record<ReleaseChecklistItem["key"], boolean> = {
    HUMAN_EVALUATION: sampleCount === 0,
    REAL_WORLD_SAMPLE: has("INSUFFICIENT_SAMPLE"),
    PROJECT_DIVERSITY: has("LOW_PROJECT_DIVERSITY"),
    SESSION_DIVERSITY: has("LOW_SESSION_DIVERSITY"),
    USER_DIVERSITY: has("LOW_USER_DIVERSITY"),
    SONG_DIVERSITY: has("LOW_SONG_DIVERSITY"),
    SHADOW_EVIDENCE: has("SHADOW_EVIDENCE_MISSING") || has("SHADOW_UNAVAILABLE"),
    VERSION_INTEGRITY: has("VERSION_MISMATCH"),
    REGRESSION_SAFETY: has("MAJOR_REGRESSION") || has("TOP1_REGRESSION"),
    STAGE_11_APPROVAL: has("APPROVAL_MISSING"),
    STAGE_13_RELEASE_PACKAGE: has("PACKAGE_INVALID"),
  };
  return RELEASE_CHECKLIST_KEYS.map((key) => ({
    key,
    verdict: verdict(map[key]),
  }));
}

function buildNeeded(checklist: ReleaseChecklistItem[]): EvidenceNeededItem[] {
  const find = (key: ReleaseChecklistItem["key"]) =>
    checklist.find((item) => item.key === key)?.verdict === "PASS";
  return [
    { key: "HUMAN_EVALUATION", label: "Human feedback", met: find("HUMAN_EVALUATION") },
    { key: "PROJECT_DIVERSITY", label: "Diverse projects", met: find("PROJECT_DIVERSITY") },
    { key: "SONG_DIVERSITY", label: "Diverse songs", met: find("SONG_DIVERSITY") },
    { key: "USER_DIVERSITY", label: "Diverse users", met: find("USER_DIVERSITY") },
    { key: "SHADOW_EVIDENCE", label: "Shadow observations", met: find("SHADOW_EVIDENCE") },
    { key: "REGRESSION_SAFETY", label: "Regression evidence", met: find("REGRESSION_SAFETY") },
  ];
}

function buildDimensions(blockers: ReleaseHardBlocker[]): DimensionVerdict {
  const has = (code: ReleaseHardBlocker) => blockers.includes(code);
  return {
    evidenceSufficiency: verdict(has("INSUFFICIENT_SAMPLE")),
    evidenceDiversity: verdict(
      has("LOW_PROJECT_DIVERSITY") ||
        has("LOW_SESSION_DIVERSITY") ||
        has("LOW_USER_DIVERSITY") ||
        has("LOW_SONG_DIVERSITY")
    ),
    shadowEvidence: verdict(has("SHADOW_EVIDENCE_MISSING") || has("SHADOW_UNAVAILABLE")),
    regressionSafety: verdict(has("MAJOR_REGRESSION") || has("TOP1_REGRESSION")),
    versionIntegrity: verdict(has("VERSION_MISMATCH")),
    humanApproval: verdict(has("APPROVAL_MISSING") || has("PACKAGE_INVALID")),
  };
}

function regressionStatus(
  blockers: ReleaseHardBlocker[]
): ReleaseEvidenceReview["regressionStatus"] {
  if (blockers.includes("MAJOR_REGRESSION")) return "MAJOR_REGRESSION";
  if (blockers.includes("TOP1_REGRESSION")) return "TOP1_REGRESSION";
  if (blockers.includes("SHADOW_EVIDENCE_MISSING") || blockers.includes("SHADOW_UNAVAILABLE")) {
    return "UNKNOWN";
  }
  return "PASS";
}

function resolveReleasePackage(input: ReleaseDecisionInput, shadow?: ShadowReport): ReleasePackage | undefined {
  if (input.releasePackage) return input.releasePackage;
  if (!input.approvedWeightPackage || !shadow) return undefined;
  return buildReleaseCandidate({
    approval: input.approvedWeightPackage,
    shadow,
    store: input.store,
  });
}

function canaryPermission(input: {
  dataSource: ReleaseDecisionDataSource;
  status: ReleaseDecisionStatus;
  blockers: ReleaseHardBlocker[];
  humanDecision: ReleaseDecision | null;
}): { productionCanaryEligible: boolean; canProceedToCanary: boolean } {
  const permitted =
    input.dataSource === "REAL" &&
    input.status === "APPROVED_FOR_CANARY" &&
    input.blockers.length === 0 &&
    input.humanDecision === "RELEASE";
  return {
    productionCanaryEligible: permitted,
    canProceedToCanary: permitted,
  };
}

export function canProceedToCanary(report?: ReleaseDecisionReport): boolean {
  if (!report) return false;
  return (
    report.dataSource === "REAL" &&
    report.status === "APPROVED_FOR_CANARY" &&
    report.hardBlockers.length === 0 &&
    report.humanDecision === "RELEASE" &&
    report.productionCanaryEligible === true
  );
}

export function canFormationV2ProceedToCanary(report?: ReleaseDecisionReport): false | true {
  return canProceedToCanary(report);
}

export function loadRealEditorEvaluationStore(storage?: FeedbackStorage): HumanEvaluationStore {
  try {
    return new HumanFeedbackSession(storage ?? defaultFeedbackStorage()).toEvaluationStore();
  } catch {
    return createHumanEvaluationStore();
  }
}

export function evaluateReleaseReadiness(input: ReleaseDecisionInput): ReleaseDecisionReport {
  const domain = input.domain;
  const scoped = scopedStore(input.store, domain);
  const shadow = shadowForDomain(input.shadow, domain);
  const displayEvidence = analyzeRealWorldEvidence({
    store: input.store,
    shadow: input.shadow,
    expected: input.expected
      ? {
          datasetVersion: input.expected.datasetVersion,
          algorithmVersion: input.expected.algorithmVersion,
          analysisVersion: input.expected.analysisVersion,
          weightsVersion: input.expected.weightVersion,
        }
      : undefined,
  });
  const evidence = analyzeRealWorldEvidence({
    store: scoped,
    shadow,
    expected: input.expected
      ? {
          datasetVersion: input.expected.datasetVersion,
          algorithmVersion: input.expected.algorithmVersion,
          analysisVersion: input.expected.analysisVersion,
          weightsVersion: input.expected.weightVersion,
        }
      : undefined,
  });
  const release = resolveReleasePackage(input, shadow);
  const { blockers, warnings } = collectHardBlockers({
    dataSource: input.dataSource,
    domain,
    store: input.store,
    evidence,
    shadow,
    approval: input.approvedWeightPackage,
    release,
    expected: input.expected,
  });
  const status: ReleaseDecisionStatus = blockers.length === 0 ? "READY_FOR_RELEASE" : "NOT_ELIGIBLE";
  const checklist = buildChecklist(blockers, evidence.evidenceQuality.sampleCount);
  const quality = evidence.evidenceQuality;
  const soft: SoftEvidence = {
    formationAcceptRate: displayEvidence.formation.acceptRate,
    formationRejectRate: displayEvidence.formation.rejectRate,
    formationEditRate: displayEvidence.formation.editRate,
    formationUnchangedRate: displayEvidence.formation.unchangedRate,
    transitionEditRate: displayEvidence.transition.editRate,
    shadowTop1Changed: evidence.shadow.top1ChangedCount,
    shadowTop3Changed: evidence.shadow.top3ChangedCount,
    meanScoreDelta: evidence.shadow.meanScoreDelta,
    meanRankDelta: evidence.shadow.meanRankDelta,
    note: "Soft evidence cannot override hard blockers.",
  };
  const review: ReleaseEvidenceReview = {
    domain,
    releasePackageId: release?.packageId,
    dataSource: input.dataSource,
    evidenceStatus: evidence.readiness.status,
    evidenceQuality: quality,
    sampleCount: quality.sampleCount,
    projectCount: quality.uniqueProjectCount,
    sessionCount: quality.uniqueSessionCount,
    userCount: quality.uniqueUserCount,
    songCount: quality.uniqueSongCount,
    formationAcceptRate: displayEvidence.formation.acceptRate,
    formationRejectRate: displayEvidence.formation.rejectRate,
    formationEditRate: displayEvidence.formation.editRate,
    formationUnchangedRate: displayEvidence.formation.unchangedRate,
    transitionEditRate: displayEvidence.transition.editRate,
    shadowAvailable: shadow != null && shadow.status !== "UNAVAILABLE",
    shadowEvaluatedCount: evidence.shadow.evaluatedCount,
    shadowTop1Changed: evidence.shadow.top1ChangedCount,
    shadowTop3Changed: evidence.shadow.top3ChangedCount,
    regressionStatus: regressionStatus(blockers),
    blockers,
    warnings,
  };
  const permission = canaryPermission({
    dataSource: input.dataSource,
    status,
    blockers,
    humanDecision: null,
  });
  return {
    analysisVersion: RELEASE_DECISION_VERSION,
    dataSource: input.dataSource,
    domain,
    status,
    humanDecision: null,
    productionCanaryEligible: permission.productionCanaryEligible,
    canProceedToCanary: permission.canProceedToCanary,
    evidenceSnapshotVersion: snapshotVersion({
      evidence,
      shadow,
      approval: input.approvedWeightPackage,
      release,
    }),
    review,
    dimensions: buildDimensions(blockers),
    checklist,
    evidenceNeeded: buildNeeded(checklist),
    hardBlockers: blockers,
    warnings,
    softEvidence: soft,
    reviews: [],
    releasePackage: release,
    notes: [
      "Stage 15 is a review framework. It does not apply V2.",
      "RELEASE means permission to consider Controlled Canary, not Production Default.",
      "Hard blockers cannot be offset by accept rate, shadow score, or other soft metrics.",
      "Fixture evidence is never production release evidence.",
      "counterfactual remains unknown.",
    ],
  };
}

export function evaluateProductionReleaseReadiness(
  input: Omit<ReleaseDecisionInput, "dataSource" | "store"> & {
    storage?: FeedbackStorage;
  } = { domain: "formation" }
): ReleaseDecisionReport {
  return evaluateReleaseReadiness({
    ...input,
    domain: input.domain ?? "formation",
    store: loadRealEditorEvaluationStore(input.storage),
    dataSource: "REAL",
  });
}

function anonymousReviewerId(reviewerId: string): string {
  return reviewerId.startsWith("anon-") ? reviewerId : `anon-${reviewerId.slice(0, 8)}`;
}

export function reviewReleaseDecision(
  report: ReleaseDecisionReport,
  input: {
    decision: ReleaseDecision;
    reason: string;
    reviewerId: string;
    reviewedAt: string;
  }
): {
  report: ReleaseDecisionReport;
  accepted: boolean;
  reason: string;
  review: ReleaseDecisionReviewRecord;
} {
  const reviewerId = anonymousReviewerId(input.reviewerId);
  const releasePackageId = report.releasePackage?.packageId ?? `pending-${report.domain}`;
  const review: ReleaseDecisionReviewRecord = {
    reviewId: `rdr-${releasePackageId}-${input.decision}-${reviewerId}-${input.reviewedAt}`,
    reviewerId,
    decision: input.decision,
    reason: input.reason,
    reviewedAt: input.reviewedAt,
    releasePackageId,
    evidenceSnapshotVersion: report.evidenceSnapshotVersion,
    dataSource: report.dataSource,
    domain: report.domain,
  };

  if (input.decision === "RELEASE" && report.status !== "READY_FOR_RELEASE") {
    return {
      report: {
        ...report,
        reviews: [...report.reviews, review],
      },
      accepted: false,
      reason: "NOT_ELIGIBLE",
      review,
    };
  }

  let nextPackage = report.releasePackage;
  if (input.decision === "RELEASE" && nextPackage) {
    const reviewed = reviewRelease(nextPackage, {
      decision: input.decision,
      reason: input.reason,
      reviewerId,
      reviewedAt: input.reviewedAt,
    });
    if (!reviewed.accepted) {
      return {
        report: {
          ...report,
          reviews: [...report.reviews, review],
        },
        accepted: false,
        reason: reviewed.reason,
        review,
      };
    }
    nextPackage = { ...reviewed.package, applied: false, autoReleased: false };
  } else if (input.decision === "REJECT" && nextPackage) {
    nextPackage = { ...nextPackage, status: "REJECTED", applied: false, autoReleased: false };
  }

  const nextStatus: ReleaseDecisionStatus =
    input.decision === "RELEASE"
      ? "APPROVED_FOR_CANARY"
      : input.decision === "HOLD"
        ? "HOLD"
        : "REJECTED";
  const permission = canaryPermission({
    dataSource: report.dataSource,
    status: nextStatus,
    blockers: report.hardBlockers,
    humanDecision: input.decision,
  });

  return {
    report: {
      ...report,
      status: nextStatus,
      humanDecision: input.decision,
      productionCanaryEligible: permission.productionCanaryEligible,
      canProceedToCanary: permission.canProceedToCanary,
      releasePackage: nextPackage,
      reviews: [...report.reviews, review],
    },
    accepted: true,
    reason: input.decision,
    review,
  };
}
