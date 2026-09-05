/**
 * Stage 11: V2 を人間が承認できる状態にするだけ。
 * APPROVE ≠ Production apply。insufficient なら approval 不可。
 */

import { CHOREOGRAPHIC_INTENT_VERSION } from "../intent/ChoreographicIntentEngine";
import { FORMATION_INTELLIGENCE_VERSION } from "../formation/intentFormationConfig";
import { TRANSITION_INTELLIGENCE_VERSION } from "../movement/transitionIntelligenceConfig";
import { FORMATION_CANDIDATE_VERSION } from "../types/FormationTypes";
import { analyzeDiscrepancy } from "./discrepancyAnalysis";
import { DISCREPANCY_ANALYSIS_VERSION } from "./discrepancyConfig";
import { HUMAN_FEEDBACK_VERSION } from "./humanFeedbackConfig";
import type { HumanEvaluationStore, WeightProposal } from "./humanEvaluationTypes";
import { proposeWeightAdjustments } from "./weightProposal";
import {
  APPROVAL_MIN_SAMPLE,
  FORMATION_WEIGHTS_V1,
  FORMATION_WEIGHTS_V2_PROPOSAL,
  TRANSITION_WEIGHTS_V1,
  TRANSITION_WEIGHTS_V2_PROPOSAL,
  WEIGHT_APPROVAL_VERSION,
} from "./weightApprovalConfig";
import { compareWeightVersions, detectRegression } from "./weightApprovalMetrics";
import type {
  WeightApprovalEvidence,
  WeightApprovalLayer,
  WeightApprovalPackage,
  WeightApprovalReviewResult,
  WeightApprovalVersions,
} from "./weightApprovalTypes";

function disabledProposal(layer: WeightApprovalLayer, sampleSize: number): WeightProposal {
  const currentVersion = layer === "formation" ? FORMATION_WEIGHTS_V1 : TRANSITION_WEIGHTS_V1;
  return {
    layer,
    weightsVersionCurrent: currentVersion,
    weightsVersionProposed: `${currentVersion}-unchanged`,
    current: {},
    proposed: {},
    deltas: {},
    rationale: ["Insufficient evidence — proposal disabled."],
    sampleSize,
    confidence: "insufficient",
    autoApplied: false,
  };
}

function packageVersions(
  store: HumanEvaluationStore,
  layer: WeightApprovalLayer,
  proposedVersion: string
): WeightApprovalVersions {
  const first = [...store.records].sort((a, b) =>
    a.evaluationId.localeCompare(b.evaluationId)
  )[0];
  return {
    datasetVersion: store.schemaVersion,
    algorithmVersion: HUMAN_FEEDBACK_VERSION,
    analysisVersion: DISCREPANCY_ANALYSIS_VERSION,
    approvalVersion: WEIGHT_APPROVAL_VERSION,
    weightsVersionCurrent: layer === "formation" ? FORMATION_WEIGHTS_V1 : TRANSITION_WEIGHTS_V1,
    weightsVersionProposed: proposedVersion,
    intentVersion: first?.intentVersion ?? CHOREOGRAPHIC_INTENT_VERSION,
    candidateVersion: first?.candidateVersion ?? FORMATION_CANDIDATE_VERSION,
    transitionVersion: first?.transitionVersion ?? TRANSITION_INTELLIGENCE_VERSION,
  };
}

export function versionsCompatible(
  pkg: WeightApprovalPackage,
  store: HumanEvaluationStore
): boolean {
  const expected = packageVersions(store, pkg.layer, pkg.versions.weightsVersionProposed);
  return (
    pkg.versions.datasetVersion === expected.datasetVersion &&
    pkg.versions.algorithmVersion === expected.algorithmVersion &&
    pkg.versions.analysisVersion === expected.analysisVersion &&
    pkg.versions.intentVersion === expected.intentVersion &&
    pkg.versions.candidateVersion === expected.candidateVersion &&
    pkg.versions.transitionVersion === expected.transitionVersion &&
    pkg.versions.weightsVersionCurrent === expected.weightsVersionCurrent
  );
}

function evidenceForLayer(
  store: HumanEvaluationStore,
  layer: WeightApprovalLayer
): WeightApprovalEvidence[] {
  const discrepancy = analyzeDiscrepancy(store);
  const findings = discrepancy.findings.filter((f) =>
    layer === "formation"
      ? f.likelyLayer === "formation" || f.likelyLayer === "intent"
      : f.likelyLayer === "transition" || f.likelyLayer === "music_cue"
  );
  const fromFindings: WeightApprovalEvidence[] = findings.map((f) => ({
    finding: f.category,
    sampleSize: f.sampleSize,
    confidence: f.confidence,
    affectedLayer: layer,
    observed: f.observed,
    hypothesis: f.hypothesis,
  }));
  const proposal = proposeWeightAdjustments(store, layer);
  const fromAxes: WeightApprovalEvidence[] = proposal.rationale
    .filter((line) => line.includes("over-weighted") || line.includes("under-weighted"))
    .map((line) => ({
      finding: "AXIS_HYPOTHESIS" as const,
      sampleSize: proposal.sampleSize,
      confidence:
        proposal.confidence === "usable"
          ? "high"
          : proposal.confidence === "moderate"
            ? "medium"
            : proposal.confidence === "low"
              ? "low"
              : "insufficient",
      affectedLayer: layer,
      affectedMetric: line.split(" ")[0],
      observed: [line],
      hypothesis: [
        "Axis gap is a hypothesis from rejected vs accepted breakdowns.",
        "It does not prove a specific numeric weight change.",
      ],
    }));
  return [...fromFindings, ...fromAxes].sort((a, b) =>
    a.finding.localeCompare(b.finding) || (a.affectedMetric ?? "").localeCompare(b.affectedMetric ?? "")
  );
}

function createdAtFromStore(store: HumanEvaluationStore): string {
  return (
    [...store.records]
      .map((r) => r.createdAt)
      .sort((a, b) => b.localeCompare(a))[0] ?? "1970-01-01T00:00:00.000Z"
  );
}

export function buildWeightApprovalPackage(
  store: HumanEvaluationStore,
  layer: WeightApprovalLayer
): WeightApprovalPackage {
  const discrepancy = analyzeDiscrepancy(store);
  const scoped = store.records.filter((r) => r.subject.kind === layer);
  const insufficient =
    discrepancy.confidence === "insufficient" ||
    discrepancy.calibrationConfidence === "insufficient" ||
    scoped.length < APPROVAL_MIN_SAMPLE;
  const notes = [
    "APPROVED does not apply production weights.",
    "Reviewer approval is a release decision, not mathematical proof.",
    `Formation intelligence version=${FORMATION_INTELLIGENCE_VERSION}.`,
  ];
  if (insufficient) {
    const proposedVersion =
      layer === "formation" ? FORMATION_WEIGHTS_V1 : TRANSITION_WEIGHTS_V1;
    return {
      proposalId: `wap-${layer}-insufficient`,
      layer,
      status: "INSUFFICIENT",
      autoApplied: false,
      applied: false,
      disabled: true,
      versions: packageVersions(store, layer, proposedVersion),
      createdAt: createdAtFromStore(store),
      evidence: evidenceForLayer(store, layer),
      proposal: disabledProposal(layer, scoped.length),
      comparison: null,
      reviews: [],
      notes: [
        ...notes,
        "Minimum evidence threshold not met.",
        "Weight proposal: DISABLED.",
        "Production: UNCHANGED.",
      ],
    };
  }

  const raw = proposeWeightAdjustments(store, layer);
  const proposedVersion =
    layer === "formation" ? FORMATION_WEIGHTS_V2_PROPOSAL : TRANSITION_WEIGHTS_V2_PROPOSAL;
  const proposal: WeightProposal = {
    ...raw,
    current: { ...raw.current },
    proposed: { ...raw.proposed },
    deltas: { ...raw.deltas },
    rationale: [
      ...raw.rationale,
      "Numeric change is a candidate proposal, not a necessary value from the data.",
    ],
    weightsVersionProposed:
      Object.keys(raw.deltas).length === 0 ? `${raw.weightsVersionCurrent}-unchanged` : proposedVersion,
    autoApplied: false,
  };
  const hasDeltas = Object.keys(proposal.deltas).length > 0;
  const comparison = hasDeltas
    ? compareWeightVersions({
        store,
        layer,
        v1Weights: proposal.current,
        v2Weights: proposal.proposed,
      })
    : null;
  let status: WeightApprovalPackage["status"] = "PROPOSED";
  if (comparison) {
    status = comparison.readyForReview ? "READY_FOR_REVIEW" : "SIMULATED";
  }
  const diversity = analyzeDiscrepancy(store);
  if (diversity.byIntent.length < 2 || diversity.byFormation.length < 2) {
    notes.push("Evidence spans few intents or formation families — avoid overfitting.");
  }
  return {
    proposalId: `wap-${layer}-${store.schemaVersion}-${proposal.weightsVersionProposed}`,
    layer,
    status,
    autoApplied: false,
    applied: false,
    disabled: false,
    versions: packageVersions(store, layer, proposal.weightsVersionProposed),
    createdAt: createdAtFromStore(store),
    evidence: evidenceForLayer(store, layer),
    proposal,
    comparison,
    reviews: [],
    notes,
  };
}

export function buildWeightApprovalPackages(store: HumanEvaluationStore): {
  formation: WeightApprovalPackage;
  transition: WeightApprovalPackage;
} {
  return {
    formation: buildWeightApprovalPackage(store, "formation"),
    transition: buildWeightApprovalPackage(store, "transition"),
  };
}

export function reviewWeightApproval(
  pkg: WeightApprovalPackage,
  input: {
    decision: "APPROVE" | "REJECT";
    reason: string;
    reviewerId: string;
    store: HumanEvaluationStore;
    reviewedAt?: string;
  }
): WeightApprovalReviewResult {
  if (pkg.status === "INSUFFICIENT" || pkg.disabled) {
    return { package: pkg, accepted: false, reason: "INSUFFICIENT" };
  }
  if (!versionsCompatible(pkg, input.store)) {
    return { package: pkg, accepted: false, reason: "VERSION_MISMATCH" };
  }
  if (input.decision === "APPROVE") {
    if (pkg.status !== "READY_FOR_REVIEW") {
      return { package: pkg, accepted: false, reason: "NOT_READY_FOR_REVIEW" };
    }
    if (!pkg.comparison || detectRegression(pkg.comparison) || !pkg.comparison.overallImproved) {
      return { package: pkg, accepted: false, reason: "REGRESSION_OR_WEAK_IMPROVEMENT" };
    }
  }
  const review = {
    reviewId: `war-${pkg.proposalId}-${input.decision}`,
    proposalId: pkg.proposalId,
    decision: input.decision,
    reviewerId: input.reviewerId.startsWith("anon-")
      ? input.reviewerId
      : `anon-${input.reviewerId.slice(0, 8)}`,
    reason: input.reason,
    reviewedAt: input.reviewedAt ?? pkg.createdAt,
  };
  return {
    package: {
      ...pkg,
      status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED",
      autoApplied: false,
      applied: false,
      reviews: [...pkg.reviews, review],
    },
    accepted: true,
    reason: input.decision,
  };
}
