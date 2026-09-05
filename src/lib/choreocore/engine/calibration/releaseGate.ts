/**
 * Stage 13: V2 を入れてよいかを判断する Release Gate。
 * 自動昇格しない。Apply は明示操作。失敗・不明は V1。
 */

import { ANALYSIS_VERSION } from "../constants";
import { CUE_ANALYSIS_VERSION } from "../cue/cueConfig";
import { FORMATION_INTELLIGENCE_VERSION } from "../formation/intentFormationConfig";
import { CHOREOGRAPHIC_INTENT_VERSION } from "../intent/ChoreographicIntentEngine";
import { TRANSITION_INTELLIGENCE_VERSION } from "../movement/transitionIntelligenceConfig";
import { RELEASE_GATE_VERSION, RELEASE_MIN_SAMPLE } from "./releaseConfig";
import type { ShadowReport } from "./shadowTypes";
import { versionsCompatible } from "./weightApprovalGate";
import {
  FORMATION_WEIGHTS_V1,
  TRANSITION_WEIGHTS_V1,
} from "./weightApprovalConfig";
import type { WeightApprovalPackage } from "./weightApprovalTypes";
import type { HumanEvaluationStore } from "./humanEvaluationTypes";
import {
  resolveWeights,
  stableFormationWeights,
  stableTransitionWeights,
} from "./weightRegistry";
import type {
  ReleaseDecision,
  ReleasePackage,
  ReleaseScope,
  ReleaseStatus,
} from "./releaseTypes";

function algorithmVersions() {
  return {
    music: ANALYSIS_VERSION,
    cue: CUE_ANALYSIS_VERSION,
    intent: CHOREOGRAPHIC_INTENT_VERSION,
    formation: FORMATION_INTELLIGENCE_VERSION,
    transition: TRANSITION_INTELLIGENCE_VERSION,
  };
}

function scopeFor(pkg: WeightApprovalPackage): ReleaseScope {
  return {
    formation: pkg.layer === "formation" ? "V2" : "unchanged",
    transition: pkg.layer === "transition" ? "V2" : "unchanged",
    music: "unchanged",
    cue: "unchanged",
    intent: "unchanged",
  };
}

function eligibilityStatus(
  approval: WeightApprovalPackage,
  shadow: ShadowReport,
  store: HumanEvaluationStore
): { status: ReleaseStatus; reasons: string[] } {
  const reasons: string[] = [];
  if (approval.status !== "APPROVED") {
    reasons.push("Stage 11 proposal is not APPROVED.");
    return { status: "NOT_ELIGIBLE", reasons };
  }
  if (!versionsCompatible(approval, store)) {
    reasons.push("VERSION_MISMATCH");
    return { status: "NOT_ELIGIBLE", reasons };
  }
  if (shadow.status === "INSUFFICIENT" || shadow.sampleSize < RELEASE_MIN_SAMPLE) {
    reasons.push("INSUFFICIENT shadow evidence.");
    return { status: "INSUFFICIENT", reasons };
  }
  if (shadow.status === "UNAVAILABLE") {
    reasons.push("Shadow UNAVAILABLE.");
    return { status: "NOT_ELIGIBLE", reasons };
  }
  if (shadow.status === "REGRESSION") {
    reasons.push("Shadow REGRESSION.");
    return { status: "NOT_ELIGIBLE", reasons };
  }
  if (shadow.autoPromoted) {
    reasons.push("Shadow autoPromoted is forbidden.");
    return { status: "NOT_ELIGIBLE", reasons };
  }
  if (shadow.status !== "PROMISING") {
    reasons.push(`Shadow ${shadow.status} is not release-eligible by itself.`);
    return { status: "NOT_ELIGIBLE", reasons };
  }
  if (shadow.confidence === "insufficient") {
    reasons.push("Shadow confidence is insufficient.");
    return { status: "INSUFFICIENT", reasons };
  }
  return { status: "READY_FOR_RELEASE", reasons: ["Preconditions met. Human release review still required."] };
}

export function buildReleaseCandidate(input: {
  approval: WeightApprovalPackage;
  shadow: ShadowReport;
  store: HumanEvaluationStore;
}): ReleasePackage {
  const { status, reasons } = eligibilityStatus(input.approval, input.shadow, input.store);
  const layer = input.approval.layer;
  const hasDeltas = Object.keys(input.approval.proposal.deltas).length > 0;
  const snapshotV2 = input.approval.status === "APPROVED" && hasDeltas;
  const formationV2 = layer === "formation" && snapshotV2;
  const transitionV2 = layer === "transition" && snapshotV2;
  return {
    packageId: `rel-${layer}-${input.approval.proposalId}-${input.shadow.status}`,
    layer,
    formationWeightsVersion: formationV2
      ? input.approval.proposal.weightsVersionProposed
      : FORMATION_WEIGHTS_V1,
    transitionWeightsVersion: transitionV2
      ? input.approval.proposal.weightsVersionProposed
      : TRANSITION_WEIGHTS_V1,
    formationWeights: formationV2
      ? { ...input.approval.proposal.proposed }
      : stableFormationWeights(),
    transitionWeights: transitionV2
      ? { ...input.approval.proposal.proposed }
      : stableTransitionWeights(),
    algorithmVersions: algorithmVersions(),
    analysisVersion: input.shadow.analysisVersion,
    releaseGateVersion: RELEASE_GATE_VERSION,
    approvalVersion: input.approval.versions.approvalVersion,
    sourceProposalId: input.approval.proposalId,
    approvalId: input.approval.reviews[0]?.reviewId ?? input.approval.proposalId,
    shadowReportId: `shadow-${input.shadow.layer}-${input.shadow.status}-${input.shadow.sampleSize}`,
    status,
    createdAt: input.approval.createdAt,
    applied: false,
    autoReleased: false,
    scope: scopeFor(input.approval),
    rationale: {
      why: reasons,
      evidence: input.shadow.observed,
      shadowResult: input.shadow.status,
      risk: input.shadow.hypothesis,
      rollback: "Restore STABLE V1 weights via rollbackRelease. Do not hotfix V2.",
    },
    checklist: {
      evidenceSufficient: status === "READY_FOR_RELEASE",
      shadowPassed: input.shadow.status === "PROMISING",
      noCriticalRegression: input.shadow.status !== "REGRESSION",
      versionCompatibility: versionsCompatible(input.approval, input.store),
      componentScopeUnderstood: true,
      rollbackTested: true,
      canaryPlanAvailable: true,
      productionImpactUnderstood: true,
      approvalRecorded: false,
    },
    reviews: [],
  };
}

export function reviewRelease(
  pkg: ReleasePackage,
  input: {
    decision: ReleaseDecision;
    reason: string;
    reviewerId: string;
    reviewedAt?: string;
  }
): { package: ReleasePackage; accepted: boolean; reason: string } {
  if (pkg.status === "INSUFFICIENT" || pkg.status === "NOT_ELIGIBLE") {
    return { package: pkg, accepted: false, reason: pkg.status };
  }
  if (input.decision === "RELEASE" && pkg.status !== "READY_FOR_RELEASE") {
    return { package: pkg, accepted: false, reason: "NOT_READY_FOR_RELEASE" };
  }
  const nextStatus: ReleaseStatus =
    input.decision === "RELEASE"
      ? "APPROVED_FOR_CANARY"
      : input.decision === "HOLD"
        ? "HOLD"
        : "REJECTED";
  const reviewerId = input.reviewerId.startsWith("anon-")
    ? input.reviewerId
    : `anon-${input.reviewerId.slice(0, 8)}`;
  return {
    package: {
      ...pkg,
      status: nextStatus,
      applied: false,
      autoReleased: false,
      checklist: { ...pkg.checklist, approvalRecorded: true },
      reviews: [
        ...pkg.reviews,
        {
          reviewId: `rr-${pkg.packageId}-${input.decision}`,
          packageId: pkg.packageId,
          decision: input.decision,
          reviewerId,
          reason: input.reason,
          reviewedAt: input.reviewedAt ?? pkg.createdAt,
        },
      ],
    },
    accepted: true,
    reason: input.decision,
  };
}

export function startCanary(pkg: ReleasePackage): ReleasePackage {
  if (pkg.status !== "APPROVED_FOR_CANARY") return pkg;
  return { ...pkg, status: "CANARY", applied: false, autoReleased: false };
}

export function recordCanaryResult(
  pkg: ReleasePackage,
  input: { passed: boolean; reason: string }
): ReleasePackage {
  if (pkg.status !== "CANARY") return pkg;
  if (!input.passed) {
    return { ...pkg, status: "HOLD", applied: false, autoReleased: false };
  }
  return { ...pkg, status: "CANARY_PASSED", applied: false, autoReleased: false };
}

export function applyFullRelease(pkg: ReleasePackage): ReleasePackage {
  if (pkg.status !== "CANARY_PASSED") {
    return { ...pkg, applied: false, autoReleased: false };
  }
  return { ...pkg, status: "RELEASED", applied: true, autoReleased: false };
}

export function rollbackRelease(pkg: ReleasePackage): ReleasePackage {
  return { ...pkg, status: "ROLLBACK", applied: false, autoReleased: false };
}

export function resolveReleaseWeights(input: {
  layer: "formation" | "transition";
  release?: ReleasePackage;
  canaryArm?: "v1" | "v2";
}): ReturnType<typeof resolveWeights> {
  try {
    const pkg = input.release;
    if (!pkg) {
      return resolveWeights({ layer: input.layer, version: undefined });
    }
    if (pkg.status === "ROLLBACK" || pkg.status === "REJECTED" || pkg.status === "HOLD") {
      return resolveWeights({ layer: input.layer, version: undefined });
    }
    const wantsV2 =
      (pkg.status === "RELEASED" && pkg.applied) ||
      (pkg.status === "CANARY" && input.canaryArm === "v2");
    if (!wantsV2) {
      return resolveWeights({ layer: input.layer, version: undefined });
    }
    const version =
      input.layer === "formation" ? pkg.formationWeightsVersion : pkg.transitionWeightsVersion;
    return resolveWeights({ layer: input.layer, version, release: pkg });
  } catch (error) {
    const v1 = resolveWeights({ layer: input.layer, version: undefined });
    return {
      ...v1,
      fallback: true,
      error: error instanceof Error ? error.message : "v2-resolve-failed",
    };
  }
}
