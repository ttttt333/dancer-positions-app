/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { TRANSITION_SCORE_WEIGHTS } from "../movement/transitionIntelligenceConfig";
import { analyzeAiHumanCalibration } from "./aiHumanCalibration";
import {
  createHumanEvaluationRecord,
  createPairwiseEvaluation,
  decisionToFormationJudgment,
  recordFromFormationCandidate,
} from "./humanEvaluationRecord";
import {
  appendHumanEvaluation,
  createHumanEvaluationStore,
  exportHumanEvaluationDataset,
  importHumanEvaluationDataset,
} from "./humanEvaluationStore";
import { humanEvaluationPreferenceFixture } from "./humanEvaluationFixtures";
import {
  productionFormationWeights,
  proposeWeightAdjustments,
  simulateWeightChange,
} from "./weightProposal";
import { FORMATION_WEIGHTS_VERSION } from "./humanEvaluationConfig";
import type { RankedFormationCandidate } from "../formation/intentFormationTypes";

function stubCandidate(id: string, score: number): RankedFormationCandidate {
  return {
    formation: {
      id: `form-${id}`,
      type: "V",
      positions: {},
      symmetry: 70,
      complexity: 30,
      stageCoverage: 60,
      visualImpact: 80,
      tags: [],
    },
    candidateId: id,
    templateId: "v",
    shapeFamily: "V",
    score,
    intentAlignment: 80,
    visualImpact: 90,
    transitionQuality: 70,
    movementEfficiency: 75,
    movementCost: 20,
    visualImpactPerMovement: 4,
    stageUsage: 60,
    roleCompatibility: 60,
    complexityPenalty: 0,
    collisionPenalty: 0,
    reasonCodes: ["INTENT_EXPAND"],
    feasibility: {
      valid: true,
      collisionRisk: 0,
      maxRequiredSpeed: 0.4,
      outsideStage: false,
      lockedViolation: false,
      rejectionReasons: [],
    },
  };
}

describe("humanEvaluation", () => {
  it("A. records human evaluation without mixing into production state", () => {
    const store = appendHumanEvaluation(
      createHumanEvaluationStore(),
      createHumanEvaluationRecord({
        evaluationId: "e1",
        createdAt: "2026-09-05T00:00:00.000Z",
        subject: { kind: "formation", candidateId: "cand-1", cueId: "cue-1" },
        decision: "accept",
        aiScoreSnapshot: {
          overall: 80,
          breakdown: { visualImpact: 70 },
          weights: productionFormationWeights(),
          weightsVersion: FORMATION_WEIGHTS_VERSION,
        },
      })
    );
    expect(store.records).toHaveLength(1);
    expect(store.records[0]!.decision).toBe("accept");
    expect(store.schemaVersion).toContain("8.");
  });

  it("B. snapshots the AI score at evaluation time", () => {
    const record = recordFromFormationCandidate({
      candidate: stubCandidate("cand-snap", 91),
      decision: "reject",
      createdAt: "2026-09-05T00:00:00.000Z",
      evaluationId: "snap-1",
    });
    expect(record.aiScoreSnapshot.overall).toBe(91);
    expect(record.aiScoreSnapshot.breakdown.visualImpact).toBe(90);
    expect(record.aiScoreSnapshot.weightsVersion).toBe(FORMATION_WEIGHTS_VERSION);
    expect(record.scoreWeightsVersion).toBe(FORMATION_WEIGHTS_VERSION);
  });

  it("C. keeps candidate / cue / intent identity", () => {
    const record = recordFromFormationCandidate({
      candidate: stubCandidate("cand-id", 70),
      decision: "edit",
      musicId: "song-a",
      cueId: "cue-9",
      intent: "EXPAND",
      dancerCount: 6,
      evaluationId: "id-1",
      createdAt: "2026-09-05T00:00:00.000Z",
    });
    expect(record.subject.candidateId).toBe("cand-id");
    expect(record.subject.musicId).toBe("song-a");
    expect(record.subject.cueId).toBe("cue-9");
    expect(record.subject.intent).toBe("EXPAND");
    expect(record.intentVersion).toBeTruthy();
    expect(record.candidateVersion).toBeTruthy();
  });

  it("D. distinguishes accept / edit / reject", () => {
    expect(decisionToFormationJudgment("accept")).toBe("good");
    expect(decisionToFormationJudgment("edit")).toBe("acceptable");
    expect(decisionToFormationJudgment("reject")).toBe("wrong");
  });

  it("E. does not change production weights after evaluation or proposal", () => {
    const before = { ...FORMATION_INTELLIGENCE_WEIGHTS };
    const transitionBefore = { ...TRANSITION_SCORE_WEIGHTS };
    const store = humanEvaluationPreferenceFixture();
    const proposal = proposeWeightAdjustments(store, "formation");
    expect(proposal.autoApplied).toBe(false);
    expect(FORMATION_INTELLIGENCE_WEIGHTS).toEqual(before);
    expect(TRANSITION_SCORE_WEIGHTS).toEqual(transitionBefore);
    expect(proposal.proposed).not.toBe(FORMATION_INTELLIGENCE_WEIGHTS);
  });

  it("F. identical dataset yields identical calibration report", () => {
    const a = analyzeAiHumanCalibration(humanEvaluationPreferenceFixture());
    const b = analyzeAiHumanCalibration(humanEvaluationPreferenceFixture());
    expect(a).toEqual(b);
    const exported = exportHumanEvaluationDataset(humanEvaluationPreferenceFixture());
    expect(analyzeAiHumanCalibration(importHumanEvaluationDataset(exported))).toEqual(a);
  });

  it("G. can compare rankings before and after a proposed weight version", () => {
    const store = humanEvaluationPreferenceFixture();
    const proposal = proposeWeightAdjustments(store, "formation");
    expect(proposal.weightsVersionCurrent).toBe(FORMATION_WEIGHTS_VERSION);
    expect(proposal.weightsVersionProposed).not.toBe(proposal.weightsVersionCurrent);
    const sim = simulateWeightChange({
      store,
      current: proposal.current,
      proposed: proposal.proposed,
      weightsVersionBefore: proposal.weightsVersionCurrent,
      weightsVersionAfter: proposal.weightsVersionProposed,
    });
    expect(sim.autoApplied).toBe(false);
    expect(sim.weightsVersionBefore).toBe(FORMATION_WEIGHTS_VERSION);
    expect(sim.before.groups).toBeGreaterThan(0);
    expect(sim.after.groups).toBeGreaterThan(0);
  });

  it("H. compares AI ranking with human preference", () => {
    const report = analyzeAiHumanCalibration(humanEvaluationPreferenceFixture());
    expect(report.rankAgreement).not.toBeNull();
    expect(report.aiVsHuman.highAiRejectCount).toBeGreaterThan(0);
    expect(report.axisHypotheses.some((h) => h.axis === "visualImpact")).toBe(true);
    expect(report.pairwiseAgreement).not.toBeNull();
    expect(report.autoApplied).toBe(false);
    expect(report.notes.some((n) => n.includes("not applied automatically"))).toBe(true);
  });

  it("I. sparse data does not produce a production weight rewrite", () => {
    let store = createHumanEvaluationStore();
    store = appendHumanEvaluation(
      store,
      createHumanEvaluationRecord({
        evaluationId: "sparse-1",
        createdAt: "2026-09-05T00:00:00.000Z",
        subject: { kind: "formation", candidateId: "only" },
        decision: "reject",
        aiScoreSnapshot: {
          overall: 99,
          breakdown: { visualImpact: 99 },
          weights: productionFormationWeights(),
          weightsVersion: FORMATION_WEIGHTS_VERSION,
        },
      })
    );
    const proposal = proposeWeightAdjustments(store, "formation");
    expect(proposal.confidence).toBe("insufficient");
    expect(proposal.proposed).toEqual(proposal.current);
    expect(proposal.autoApplied).toBe(false);
  });

  it("keeps pairwise preference as a future comparison boundary", () => {
    const pair = createPairwiseEvaluation({
      pairwiseId: "p1",
      candidateAId: "a",
      candidateBId: "b",
      preference: "EQUAL",
      createdAt: "2026-09-05T00:00:00.000Z",
    });
    expect(pair.preference).toBe("EQUAL");
  });
});
