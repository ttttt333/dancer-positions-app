import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { TRANSITION_SCORE_WEIGHTS } from "../movement/transitionIntelligenceConfig";
import {
  FORMATION_WEIGHTS_VERSION,
  HUMAN_EVALUATION_VERSION,
  TRANSITION_WEIGHTS_VERSION,
} from "./humanEvaluationConfig";
import { HUMAN_FEEDBACK_VERSION } from "./humanFeedbackConfig";
import { DISCREPANCY_ANALYSIS_VERSION } from "./discrepancyConfig";
import { createHumanEvaluationRecord } from "./humanEvaluationRecord";
import {
  appendHumanEvaluation,
  createHumanEvaluationStore,
} from "./humanEvaluationStore";
import type { HumanEvaluationStore } from "./humanEvaluationTypes";
import {
  FORMATION_WEIGHTS_V1,
  FORMATION_WEIGHTS_V2_PROPOSAL,
  WEIGHT_APPROVAL_VERSION,
} from "./weightApprovalConfig";
import type { WeightApprovalPackage } from "./weightApprovalTypes";
import type { ShadowReport } from "./shadowTypes";
import type { ReleasePackage } from "./releaseTypes";
import { RELEASE_GATE_VERSION } from "./releaseConfig";
import { SHADOW_EVALUATION_VERSION } from "./shadowConfig";
import {
  concentratedRealWorldStore,
  emptyRealWorldStore,
  smallRealWorldStore,
} from "./realWorldEvidenceFixtures";

function formationRow(input: {
  id: string;
  song: string;
  user: string;
  cue: string;
  decision: "accept" | "edit" | "reject";
  formationChanged?: boolean;
}): ReturnType<typeof createHumanEvaluationRecord> {
  return createHumanEvaluationRecord({
    evaluationId: input.id,
    createdAt: "2026-09-05T00:00:00.000Z",
    subject: {
      kind: "formation",
      candidateId: input.id,
      musicId: input.song,
      cueId: input.cue,
      formationType: "V",
      dancerCount: 6,
    },
    decision: input.decision,
    editSignal:
      input.decision === "edit"
        ? { formationChanged: Boolean(input.formationChanged) }
        : undefined,
    aiScoreSnapshot: {
      overall: 80,
      breakdown: { visualImpact: 80 },
      weights: { ...FORMATION_INTELLIGENCE_WEIGHTS },
      weightsVersion: FORMATION_WEIGHTS_VERSION,
    },
    evaluatorContext: { source: "editor", evaluatorId: input.user },
  });
}

function transitionRow(input: {
  id: string;
  song: string;
  user: string;
  cue: string;
  decision: "accept" | "edit" | "reject";
  pathChanged?: boolean;
}): ReturnType<typeof createHumanEvaluationRecord> {
  return createHumanEvaluationRecord({
    evaluationId: input.id,
    createdAt: "2026-09-05T00:00:00.000Z",
    subject: {
      kind: "transition",
      candidateId: input.id,
      musicId: input.song,
      cueId: input.cue,
      pathKind: "STRAIGHT",
    },
    decision: input.decision,
    editSignal:
      input.decision === "edit" ? { pathChanged: Boolean(input.pathChanged) } : undefined,
    aiScoreSnapshot: {
      overall: 75,
      breakdown: { pathCost: 70 },
      weights: { ...TRANSITION_SCORE_WEIGHTS },
      weightsVersion: TRANSITION_WEIGHTS_VERSION,
    },
    evaluatorContext: { source: "editor", evaluatorId: input.user },
  });
}

function appendAll(
  rows: Array<ReturnType<typeof createHumanEvaluationRecord>>
): HumanEvaluationStore {
  let store = createHumanEvaluationStore();
  for (const row of rows) store = appendHumanEvaluation(store, row);
  return store;
}

/** 8 songs × 4 users。Stage 15 evidence 閾値を満たす fixture。本番証拠ではない。 */
export function diverseEvidenceReadyStore(): HumanEvaluationStore {
  const songs = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];
  const users = ["anon-u1", "anon-u2", "anon-u3", "anon-u4"];
  const rows: Array<ReturnType<typeof createHumanEvaluationRecord>> = [];
  let n = 0;
  for (const song of songs) {
    for (const user of users) {
      n += 1;
      const decision = n % 5 === 0 ? "reject" : n % 5 === 1 ? "edit" : "accept";
      rows.push(
        formationRow({
          id: `ev-f-${song}-${user}`,
          song,
          user,
          cue: `cue-${n}`,
          decision,
          formationChanged: decision === "edit",
        })
      );
    }
  }
  return appendAll(rows);
}

export function transitionOnlyStore(): HumanEvaluationStore {
  const rows = Array.from({ length: 4 }, (_, i) =>
    transitionRow({
      id: `tr-only-${i}`,
      song: "one-song",
      user: "anon-only",
      cue: `t-${i}`,
      decision: "edit",
      pathChanged: true,
    })
  );
  return appendAll(rows);
}

export function stubApprovedFormation(store: HumanEvaluationStore): WeightApprovalPackage {
  return {
    proposalId: `wap-formation-${store.schemaVersion}-${FORMATION_WEIGHTS_V2_PROPOSAL}`,
    layer: "formation",
    status: "APPROVED",
    autoApplied: false,
    applied: false,
    disabled: false,
    versions: {
      datasetVersion: store.schemaVersion,
      algorithmVersion: HUMAN_FEEDBACK_VERSION,
      analysisVersion: DISCREPANCY_ANALYSIS_VERSION,
      approvalVersion: WEIGHT_APPROVAL_VERSION,
      weightsVersionCurrent: FORMATION_WEIGHTS_V1,
      weightsVersionProposed: FORMATION_WEIGHTS_V2_PROPOSAL,
    },
    createdAt: "2026-09-05T00:00:00.000Z",
    evidence: [],
    proposal: {
      layer: "formation",
      weightsVersionCurrent: FORMATION_WEIGHTS_V1,
      weightsVersionProposed: FORMATION_WEIGHTS_V2_PROPOSAL,
      current: { ...FORMATION_INTELLIGENCE_WEIGHTS },
      proposed: { ...FORMATION_INTELLIGENCE_WEIGHTS, visualImpact: 0.4 },
      deltas: { visualImpact: 0.03 },
      rationale: ["fixture proposal"],
      sampleSize: store.records.length,
      confidence: "moderate",
      autoApplied: false,
    },
    comparison: {
      metrics: [
        { key: "top1Agreement", v1: 0.4, v2: 0.5, delta: 0.1, direction: "improved" },
      ],
      improvedCount: 2,
      worsenedCount: 0,
      criticalRegressions: [],
      tradeoffs: [],
      overallImproved: true,
      readyForReview: true,
      notes: [],
    },
    reviews: [
      {
        reviewId: "war-fixture",
        proposalId: `wap-formation-${store.schemaVersion}-${FORMATION_WEIGHTS_V2_PROPOSAL}`,
        decision: "APPROVE",
        reviewerId: "anon-fix",
        reason: "fixture",
        reviewedAt: "2026-09-05T00:00:00.000Z",
      },
    ],
    notes: ["FIXTURE — not real production evidence."],
  };
}

export function stubShadowForStore(
  store: HumanEvaluationStore,
  opts: { unavailable?: boolean; regression?: boolean; mismatch?: boolean } = {}
): ShadowReport {
  const status = opts.unavailable ? "UNAVAILABLE" : opts.regression ? "REGRESSION" : "PROMISING";
  return {
    analysisVersion: SHADOW_EVALUATION_VERSION,
    layer: "formation",
    status,
    confidence: "medium",
    autoPromoted: false,
    productionWeightsVersion: FORMATION_WEIGHTS_V1,
    shadowWeightsVersion: FORMATION_WEIGHTS_V2_PROPOSAL,
    versions: {
      datasetVersion: opts.mismatch ? "other-dataset" : store.schemaVersion,
      algorithmVersion: HUMAN_FEEDBACK_VERSION,
      analysisVersion: DISCREPANCY_ANALYSIS_VERSION,
      approvalVersion: WEIGHT_APPROVAL_VERSION,
      weightsVersionCurrent: FORMATION_WEIGHTS_V1,
      weightsVersionProposed: FORMATION_WEIGHTS_V2_PROPOSAL,
    },
    sampleSize: opts.unavailable ? 0 : 8,
    contextCount: opts.unavailable ? 0 : 1,
    evaluations: opts.unavailable
      ? []
      : [
          {
            evaluationId: "shd-1",
            candidateId: "ev-f-s1-anon-u1",
            contextKey: "s1|cue-1|formation",
            layer: "formation",
            production: { score: 80, rank: 1, weightsVersion: FORMATION_WEIGHTS_V1 },
            shadow: { score: 84, rank: 1, weightsVersion: FORMATION_WEIGHTS_V2_PROPOSAL },
            scoreDelta: 4,
            rankDelta: 0,
            productionHumanOutcome: "ACCEPT_UNCHANGED",
            counterfactual: "unknown",
            createdAt: "2026-09-05T00:00:00.000Z",
          },
        ],
    comparisons: opts.unavailable
      ? []
      : [
          {
            contextKey: "s1|cue-1|formation",
            layer: "formation",
            v1Top1: "ev-f-s1-anon-u1",
            v2Top1: "ev-f-s1-anon-u1",
            v1Ranking: ["ev-f-s1-anon-u1"],
            v2Ranking: ["ev-f-s1-anon-u1"],
            candidateSetChanged: false,
            rankingChanged: false,
            top1Changed: false,
            productionHumanOutcome: "ACCEPT_UNCHANGED",
            categories: [],
          },
        ],
    observational: {
      v1Top1AcceptUnchanged: 1,
      v2Top1AcceptUnchanged: opts.regression ? 0 : 2,
      v1Top1Reject: 0,
      v2Top1Reject: opts.regression ? 2 : 0,
      comparableGroups: 1,
    },
    observed: [],
    hypothesis: [],
    notes: ["FIXTURE shadow"],
  };
}

export function stubReleasePackage(
  _store: HumanEvaluationStore,
  approval: WeightApprovalPackage,
  status: ReleasePackage["status"] = "READY_FOR_RELEASE"
): ReleasePackage {
  return {
    packageId: `rel-formation-${approval.proposalId}-PROMISING`,
    layer: "formation",
    formationWeightsVersion: FORMATION_WEIGHTS_V2_PROPOSAL,
    transitionWeightsVersion: TRANSITION_WEIGHTS_VERSION,
    formationWeights: { ...FORMATION_INTELLIGENCE_WEIGHTS },
    transitionWeights: { ...TRANSITION_SCORE_WEIGHTS },
    algorithmVersions: {
      music: "fixture",
      cue: "fixture",
      intent: "fixture",
      formation: "fixture",
      transition: "fixture",
    },
    analysisVersion: SHADOW_EVALUATION_VERSION,
    releaseGateVersion: RELEASE_GATE_VERSION,
    approvalVersion: WEIGHT_APPROVAL_VERSION,
    sourceProposalId: approval.proposalId,
    approvalId: approval.reviews[0]?.reviewId ?? approval.proposalId,
    shadowReportId: "shadow-formation-PROMISING-8",
    status,
    createdAt: "2026-09-05T00:00:00.000Z",
    applied: false,
    autoReleased: false,
    scope: {
      formation: "V2",
      transition: "unchanged",
      music: "unchanged",
      cue: "unchanged",
      intent: "unchanged",
    },
    rationale: {
      why: ["fixture"],
      evidence: [],
      shadowResult: "PROMISING",
      risk: [],
      rollback: "Restore STABLE V1.",
    },
    checklist: {
      evidenceSufficient: status === "READY_FOR_RELEASE",
      shadowPassed: true,
      noCriticalRegression: true,
      versionCompatibility: true,
      componentScopeUnderstood: true,
      rollbackTested: true,
      canaryPlanAvailable: true,
      productionImpactUnderstood: true,
      approvalRecorded: false,
    },
    reviews: [],
  };
}

export function eligibleFixtureBundle() {
  const store = diverseEvidenceReadyStore();
  const approval = stubApprovedFormation(store);
  const shadow = stubShadowForStore(store);
  const releasePackage = stubReleasePackage(store, approval);
  return { store, approval, shadow, releasePackage };
}

export {
  emptyRealWorldStore,
  smallRealWorldStore,
  concentratedRealWorldStore,
  HUMAN_EVALUATION_VERSION,
};
