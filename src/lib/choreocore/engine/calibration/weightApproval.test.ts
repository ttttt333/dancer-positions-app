/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { TRANSITION_SCORE_WEIGHTS } from "../movement/transitionIntelligenceConfig";
import { discrepancySparseFixture } from "./discrepancyFixtures";
import { humanEvaluationPreferenceFixture } from "./humanEvaluationFixtures";
import {
  FORMATION_WEIGHTS_V1,
  FORMATION_WEIGHTS_V2_PROPOSAL,
  TRANSITION_WEIGHTS_V1,
} from "./weightApprovalConfig";
import {
  buildWeightApprovalPackage,
  buildWeightApprovalPackages,
  reviewWeightApproval,
  versionsCompatible,
} from "./weightApprovalGate";
import { compareWeightVersions, detectRegression } from "./weightApprovalMetrics";
import {
  loadWeightApprovalPackages,
  saveWeightApprovalPackage,
} from "./weightApprovalPersist";
import { formatWeightApprovalReport } from "./weightApprovalReport";
import { productionFormationWeights } from "./weightProposal";

describe("weightApprovalGate", () => {
  it("A. Insufficient Gate — 不足データでは Approval 不可", () => {
    const pkg = buildWeightApprovalPackage(discrepancySparseFixture(), "formation");
    expect(pkg.status).toBe("INSUFFICIENT");
    expect(pkg.disabled).toBe(true);
    expect(pkg.proposal.confidence).toBe("insufficient");
    const reviewed = reviewWeightApproval(pkg, {
      decision: "APPROVE",
      reason: "looks fine",
      reviewerId: "anon-reviewer",
      store: discrepancySparseFixture(),
    });
    expect(reviewed.accepted).toBe(false);
    expect(reviewed.reason).toBe("INSUFFICIENT");
    expect(reviewed.package.status).toBe("INSUFFICIENT");
    expect(reviewed.package.applied).toBe(false);
  });

  it("B. Proposal Generation — 十分な Evidence から proposal が生成される", () => {
    const pkg = buildWeightApprovalPackage(humanEvaluationPreferenceFixture(), "formation");
    expect(pkg.status).not.toBe("INSUFFICIENT");
    expect(pkg.disabled).toBe(false);
    expect(pkg.proposal.autoApplied).toBe(false);
    expect(Object.keys(pkg.proposal.deltas).length).toBeGreaterThan(0);
    expect(pkg.proposal.weightsVersionCurrent).toBe(FORMATION_WEIGHTS_V1);
    expect(pkg.proposal.weightsVersionProposed).toBe(FORMATION_WEIGHTS_V2_PROPOSAL);
    expect(pkg.evidence.length).toBeGreaterThan(0);
    expect(pkg.evidence.some((e) => e.hypothesis.length > 0)).toBe(true);
    expect(pkg.evidence.some((e) => e.observed.length > 0)).toBe(true);
  });

  it("C. Offline Simulation — V1/V2 が同じ Dataset で比較できる", () => {
    const pkg = buildWeightApprovalPackage(humanEvaluationPreferenceFixture(), "formation");
    expect(pkg.comparison).not.toBeNull();
    const keys = pkg.comparison!.metrics.map((m) => m.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "top1Agreement",
        "top3Agreement",
        "spearman",
        "pairwiseAgreement",
        "acceptUnchangedRate",
        "editRate",
        "rejectRate",
      ])
    );
    expect(pkg.comparison!.metrics.every((m) => "v1" in m && "v2" in m)).toBe(true);
  });

  it("D. No Mutation — simulation しても Production weights は不変", () => {
    const beforeF = { ...FORMATION_INTELLIGENCE_WEIGHTS };
    const beforeT = { ...TRANSITION_SCORE_WEIGHTS };
    buildWeightApprovalPackages(humanEvaluationPreferenceFixture());
    expect(FORMATION_INTELLIGENCE_WEIGHTS).toEqual(beforeF);
    expect(TRANSITION_SCORE_WEIGHTS).toEqual(beforeT);
  });

  it("E. Versioning — Proposal と Dataset / Algorithm / Weight version が一致", () => {
    const store = humanEvaluationPreferenceFixture();
    const pkg = buildWeightApprovalPackage(store, "formation");
    expect(pkg.versions.datasetVersion).toBe(store.schemaVersion);
    expect(pkg.versions.algorithmVersion).toBeTruthy();
    expect(pkg.versions.analysisVersion).toContain("10.");
    expect(pkg.versions.approvalVersion).toContain("11.");
    expect(pkg.versions.weightsVersionCurrent).toBe(FORMATION_WEIGHTS_V1);
    expect(versionsCompatible(pkg, store)).toBe(true);
    expect(
      versionsCompatible(pkg, { ...store, schemaVersion: "other-dataset" })
    ).toBe(false);
  });

  it("F. Regression Detection — V2 の悪化を検出する", () => {
    const store = humanEvaluationPreferenceFixture();
    const current = productionFormationWeights();
    const inverted: Record<string, number> = {};
    for (const key of Object.keys(current).sort((a, b) => a.localeCompare(b))) {
      inverted[key] = key === "visualImpact" ? (current[key] ?? 0) + 0.2 : current[key] ?? 0;
    }
    const comparison = compareWeightVersions({
      store,
      layer: "formation",
      v1Weights: current,
      v2Weights: inverted,
    });
    expect(detectRegression(comparison) || comparison.overallImproved === false).toBe(true);
    expect(comparison.readyForReview).toBe(false);
  });

  it("G. Approval — APPROVE / REJECT を記録する", () => {
    const store = humanEvaluationPreferenceFixture();
    const pkg = buildWeightApprovalPackage(store, "formation");
    const rejected = reviewWeightApproval(pkg, {
      decision: "REJECT",
      reason: "want more songs first",
      reviewerId: "anon-a",
      store,
      reviewedAt: "2026-09-05T12:00:00.000Z",
    });
    expect(rejected.accepted).toBe(true);
    expect(rejected.package.status).toBe("REJECTED");
    expect(rejected.package.reviews[0]?.decision).toBe("REJECT");
    expect(rejected.package.reviews[0]?.reviewerId.startsWith("anon-")).toBe(true);
    expect(rejected.package.applied).toBe(false);

    if (pkg.status === "READY_FOR_REVIEW") {
      const approved = reviewWeightApproval(pkg, {
        decision: "APPROVE",
        reason: "metrics improved without critical regression",
        reviewerId: "anon-b",
        store,
      });
      expect(approved.accepted).toBe(true);
      expect(approved.package.status).toBe("APPROVED");
    } else {
      const blocked = reviewWeightApproval(pkg, {
        decision: "APPROVE",
        reason: "force",
        reviewerId: "anon-b",
        store,
      });
      expect(blocked.accepted).toBe(false);
    }
  });

  it("H. Approval Does Not Apply — APPROVE しても Production weight は変わらない", () => {
    const before = { ...FORMATION_INTELLIGENCE_WEIGHTS };
    const store = humanEvaluationPreferenceFixture();
    const pkg = buildWeightApprovalPackage(store, "formation");
    const ready: typeof pkg = {
      ...pkg,
      status: "READY_FOR_REVIEW",
      comparison: pkg.comparison
        ? { ...pkg.comparison, readyForReview: true, overallImproved: true, criticalRegressions: [] }
        : pkg.comparison,
    };
    const approved = reviewWeightApproval(ready, {
      decision: "APPROVE",
      reason: "release candidate only",
      reviewerId: "anon-c",
      store,
    });
    expect(approved.package.status).toBe("APPROVED");
    expect(approved.package.applied).toBe(false);
    expect(approved.package.autoApplied).toBe(false);
    expect(FORMATION_INTELLIGENCE_WEIGHTS).toEqual(before);
    expect(FORMATION_INTELLIGENCE_WEIGHTS).not.toBe(approved.package.proposal.proposed);
  });

  it("I. Determinism — 同一 Dataset → 同一 simulation / report", () => {
    const a = buildWeightApprovalPackage(humanEvaluationPreferenceFixture(), "formation");
    const b = buildWeightApprovalPackage(humanEvaluationPreferenceFixture(), "formation");
    expect(a).toEqual(b);
    expect(formatWeightApprovalReport(a)).toBe(formatWeightApprovalReport(b));
  });

  it("J. Formation / Transition Separation — 片方の Proposal がもう片方を変えない", () => {
    const packs = buildWeightApprovalPackages(humanEvaluationPreferenceFixture());
    expect(packs.formation.layer).toBe("formation");
    expect(packs.transition.layer).toBe("transition");
    expect(packs.transition.status).toBe("INSUFFICIENT");
    expect(Object.keys(packs.formation.proposal.deltas).every((k) => k in FORMATION_INTELLIGENCE_WEIGHTS)).toBe(
      true
    );
    expect(packs.formation.proposal.current).not.toEqual(TRANSITION_SCORE_WEIGHTS);
    expect(packs.transition.proposal.weightsVersionCurrent).toBe(TRANSITION_WEIGHTS_V1);
    expect(packs.formation.proposal.proposed).not.toBe(packs.transition.proposal.proposed);
  });

  it("persists approval records without touching production data", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };
    const store = humanEvaluationPreferenceFixture();
    const rejected = reviewWeightApproval(
      buildWeightApprovalPackage(store, "formation"),
      {
        decision: "REJECT",
        reason: "hold",
        reviewerId: "anon-d",
        store,
      }
    );
    saveWeightApprovalPackage(rejected.package, storage);
    expect(loadWeightApprovalPackages(storage)[0]?.status).toBe("REJECTED");
    expect(formatWeightApprovalReport(rejected.package)).toContain("REJECT");
  });
});
