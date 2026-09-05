/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { TRANSITION_SCORE_WEIGHTS } from "../movement/transitionIntelligenceConfig";
import { discrepancySparseFixture } from "./discrepancyFixtures";
import { humanEvaluationPreferenceFixture } from "./humanEvaluationFixtures";
import { assignShadowExperiment, stableExperimentArm } from "./shadowAbDesign";
import { SHADOW_AB_SPLIT_ENABLED } from "./shadowConfig";
import { evaluateApprovedShadow, productionRankings } from "./shadowEvaluate";
import { formatShadowReport } from "./shadowReport";
import {
  buildWeightApprovalPackage,
  reviewWeightApproval,
} from "./weightApprovalGate";
import type { WeightApprovalPackage } from "./weightApprovalTypes";
import { scoreBreakdownWithWeights } from "./weightProposal";
import type { HumanEvaluationStore } from "./humanEvaluationTypes";

function approvedFormation(store: HumanEvaluationStore): WeightApprovalPackage {
  const built = buildWeightApprovalPackage(store, "formation");
  const ready: WeightApprovalPackage = {
    ...built,
    status: "READY_FOR_REVIEW",
    comparison: built.comparison
      ? {
          ...built.comparison,
          readyForReview: true,
          overallImproved: true,
          criticalRegressions: [],
        }
      : built.comparison,
  };
  return reviewWeightApproval(ready, {
    decision: "APPROVE",
    reason: "shadow test gate",
    reviewerId: "anon-shadow",
    store,
  }).package;
}

describe("shadowEvaluate", () => {
  it("A. Shadow Does Not Affect Production — V2 計算後も V1 result が同一", () => {
    const store = humanEvaluationPreferenceFixture();
    const beforeScores = store.records.map((r) => r.aiScoreSnapshot.overall);
    const beforeRank = productionRankings(store, "formation");
    const beforeWeights = { ...FORMATION_INTELLIGENCE_WEIGHTS };
    evaluateApprovedShadow(store, approvedFormation(store));
    expect(store.records.map((r) => r.aiScoreSnapshot.overall)).toEqual(beforeScores);
    expect(productionRankings(store, "formation")).toEqual(beforeRank);
    expect(FORMATION_INTELLIGENCE_WEIGHTS).toEqual(beforeWeights);
  });

  it("B/K. V2 Failure Isolation — V2 throw でも V1 は成功する", () => {
    const store = humanEvaluationPreferenceFixture();
    const before = productionRankings(store, "formation");
    const report = evaluateApprovedShadow(store, approvedFormation(store), {
      forceShadowError: true,
    });
    expect(report.status).toBe("UNAVAILABLE");
    expect(productionRankings(store, "formation")).toEqual(before);
    expect(report.notes.some((n) => n.includes("V1"))).toBe(true);
    expect(FORMATION_INTELLIGENCE_WEIGHTS).toEqual(
      expect.objectContaining({ visualImpact: FORMATION_INTELLIGENCE_WEIGHTS.visualImpact })
    );
  });

  it("C. Version Tracking — V1/V2 version が記録される", () => {
    const store = humanEvaluationPreferenceFixture();
    const pkg = approvedFormation(store);
    const report = evaluateApprovedShadow(store, pkg);
    expect(report.productionWeightsVersion).toBe(pkg.versions.weightsVersionCurrent);
    expect(report.shadowWeightsVersion).toBe(pkg.versions.weightsVersionProposed);
    expect(report.versions.approvalVersion).toContain("11.");
    expect(report.analysisVersion).toContain("12.");
    expect(report.evaluations[0]?.production.weightsVersion).toBe(
      pkg.versions.weightsVersionCurrent
    );
    expect(report.evaluations[0]?.shadow.weightsVersion).toBe(
      pkg.versions.weightsVersionProposed
    );
  });

  it("D. Score Delta — V1/V2 score delta が正確", () => {
    const store = humanEvaluationPreferenceFixture();
    const pkg = approvedFormation(store);
    const report = evaluateApprovedShadow(store, pkg);
    const row = report.evaluations[0]!;
    const source = store.records.find((r) => r.subject.candidateId === row.candidateId)!;
    const expectedV2 = scoreBreakdownWithWeights(
      source.aiScoreSnapshot.breakdown,
      pkg.proposal.proposed
    );
    expect(row.production.score).toBe(source.aiScoreSnapshot.overall);
    expect(row.shadow.score).toBe(expectedV2);
    expect(row.scoreDelta).toBe(expectedV2 - source.aiScoreSnapshot.overall);
  });

  it("E. Rank Delta — ranking change が正確", () => {
    const store = humanEvaluationPreferenceFixture();
    const report = evaluateApprovedShadow(store, approvedFormation(store));
    const changed = report.comparisons.find((c) => c.rankingChanged);
    if (changed) {
      expect(changed.v1Ranking.join("|")).not.toBe(changed.v2Ranking.join("|"));
      const ev = report.evaluations.find((e) => e.contextKey === changed.contextKey)!;
      expect(ev.rankDelta).toBe(ev.shadow.rank - ev.production.rank);
    } else {
      expect(
        report.evaluations.every((e) => e.rankDelta === e.shadow.rank - e.production.rank)
      ).toBe(true);
    }
  });

  it("F. Candidate Set Delta — candidate set change が正確", () => {
    const store = humanEvaluationPreferenceFixture();
    const cue = store.records[0]!.subject.cueId ?? "cue-drop";
    const music = store.records[0]!.subject.musicId ?? "fixture-song";
    const report = evaluateApprovedShadow(store, approvedFormation(store), {
      extraShadowCandidateIds: {
        [`${music}|${cue}|formation`]: ["cand-shadow-only"],
      },
    });
    expect(report.comparisons.some((c) => c.candidateSetChanged)).toBe(true);
    expect(report.comparisons.some((c) => c.categories.includes("CANDIDATE_SET_CHANGED"))).toBe(
      true
    );
  });

  it("G. Human Attribution — Human feedback は V1 production outcome", () => {
    const store = humanEvaluationPreferenceFixture();
    const report = evaluateApprovedShadow(store, approvedFormation(store));
    expect(report.evaluations.some((e) => e.productionHumanOutcome)).toBe(true);
    expect(JSON.stringify(report)).not.toMatch(/v2HumanOutcome|v2Accepted|human chose V2/i);
  });

  it("H. No Counterfactual Claims — V2 選択を事実として記録しない", () => {
    const store = humanEvaluationPreferenceFixture();
    const report = evaluateApprovedShadow(store, approvedFormation(store));
    expect(report.evaluations.every((e) => e.counterfactual === "unknown")).toBe(true);
    const text = formatShadowReport(report);
    expect(text).toContain("OBSERVED:");
    expect(text).toContain("HYPOTHESIS:");
    expect(text).not.toMatch(/V2 was accepted/i);
    expect(text).not.toMatch(/human chose V2/i);
    expect(text).toContain("observational only");
  });

  it("I. Formation / Transition Separation — 別々に分析", () => {
    const store = humanEvaluationPreferenceFixture();
    const formation = evaluateApprovedShadow(store, approvedFormation(store));
    const transitionPkg = {
      ...approvedFormation(store),
      layer: "transition" as const,
      status: "REJECTED" as const,
    };
    const blocked = evaluateApprovedShadow(store, transitionPkg);
    expect(formation.layer).toBe("formation");
    expect(formation.formation).toBeDefined();
    expect(formation.transition).toBeUndefined();
    expect(blocked.status).toBe("UNAVAILABLE");
  });

  it("J. Sample Guard — 不足データで結論を出さない", () => {
    const sparse = discrepancySparseFixture();
    const pkg = {
      ...approvedFormation(humanEvaluationPreferenceFixture()),
      status: "APPROVED" as const,
    };
    const report = evaluateApprovedShadow(sparse, {
      ...pkg,
      versions: { ...pkg.versions, datasetVersion: sparse.schemaVersion },
    });
    expect(["INSUFFICIENT", "UNAVAILABLE"]).toContain(report.status);
    expect(report.autoPromoted).toBe(false);
    expect(report.status).not.toBe("PROMISING");
  });

  it("L. Determinism — 同一入力 → 同じ Shadow result", () => {
    const store = humanEvaluationPreferenceFixture();
    const pkg = approvedFormation(store);
    const a = evaluateApprovedShadow(store, pkg);
    const b = evaluateApprovedShadow(store, pkg);
    expect(a).toEqual(b);
    expect(formatShadowReport(a)).toBe(formatShadowReport(b));
  });

  it("rejects non-approved proposals and does not split traffic", () => {
    const store = humanEvaluationPreferenceFixture();
    const proposed = buildWeightApprovalPackage(store, "formation");
    expect(proposed.status).not.toBe("APPROVED");
    expect(evaluateApprovedShadow(store, proposed).status).toBe("UNAVAILABLE");
    expect(SHADOW_AB_SPLIT_ENABLED).toBe(false);
    expect(stableExperimentArm("project-1")).toBe("production");
    expect(assignShadowExperiment({
      experimentId: "exp-v2",
      stableKey: "project-1",
      shadowApproved: true,
    }).arm).toBe("production");
    expect(TRANSITION_SCORE_WEIGHTS).toEqual({ ...TRANSITION_SCORE_WEIGHTS });
  });
});
