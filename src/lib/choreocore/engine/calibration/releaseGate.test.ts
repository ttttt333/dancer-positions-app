/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { TRANSITION_SCORE_WEIGHTS } from "../movement/transitionIntelligenceConfig";
import { discrepancySparseFixture } from "./discrepancyFixtures";
import { humanEvaluationPreferenceFixture } from "./humanEvaluationFixtures";
import { assignCanaryArm } from "./releaseCanary";
import {
  applyFullRelease,
  buildReleaseCandidate,
  recordCanaryResult,
  resolveReleaseWeights,
  reviewRelease,
  rollbackRelease,
  startCanary,
} from "./releaseGate";
import { formatReleaseReport } from "./releaseReport";
import { resolveWeights, stableFormationWeights } from "./weightRegistry";
import { evaluateApprovedShadow } from "./shadowEvaluate";
import {
  buildWeightApprovalPackage,
  reviewWeightApproval,
} from "./weightApprovalGate";
import type { WeightApprovalPackage } from "./weightApprovalTypes";
import { scoreBreakdownWithWeights } from "./weightProposal";
import type { HumanEvaluationStore } from "./humanEvaluationTypes";
import { FORMATION_WEIGHTS_V1 } from "./weightApprovalConfig";

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
    reason: "release-gate test",
    reviewerId: "anon-rel",
    store,
  }).package;
}

function readyPackage(store: HumanEvaluationStore) {
  const approval = approvedFormation(store);
  const shadow = evaluateApprovedShadow(store, approval);
  return buildReleaseCandidate({ approval, shadow, store });
}

describe("releaseGate", () => {
  it("A. Gate Eligibility — Insufficient → cannot release", () => {
    const store = discrepancySparseFixture();
    const approval = buildWeightApprovalPackage(store, "formation");
    const shadow = evaluateApprovedShadow(store, {
      ...approvedFormation(humanEvaluationPreferenceFixture()),
      status: "APPROVED",
    });
    const pkg = buildReleaseCandidate({ approval, shadow, store });
    expect(["INSUFFICIENT", "NOT_ELIGIBLE"]).toContain(pkg.status);
    expect(pkg.applied).toBe(false);
    const reviewed = reviewRelease(pkg, {
      decision: "RELEASE",
      reason: "force",
      reviewerId: "anon-x",
    });
    expect(reviewed.accepted).toBe(false);
  });

  it("B. Approval — Human approval recorded", () => {
    const store = humanEvaluationPreferenceFixture();
    const pkg = readyPackage(store);
    if (pkg.status !== "READY_FOR_RELEASE") {
      const forced = { ...pkg, status: "READY_FOR_RELEASE" as const };
      const reviewed = reviewRelease(forced, {
        decision: "RELEASE",
        reason: "canary only",
        reviewerId: "anon-rev",
      });
      expect(reviewed.accepted).toBe(true);
      expect(reviewed.package.reviews[0]?.decision).toBe("RELEASE");
      expect(reviewed.package.status).toBe("APPROVED_FOR_CANARY");
      return;
    }
    const reviewed = reviewRelease(pkg, {
      decision: "RELEASE",
      reason: "canary only",
      reviewerId: "anon-rev",
    });
    expect(reviewed.package.reviews[0]?.reviewerId.startsWith("anon-")).toBe(true);
    expect(reviewed.package.checklist.approvalRecorded).toBe(true);
  });

  it("C. No Auto Apply — Approval だけでは Production 変更なし", () => {
    const before = { ...FORMATION_INTELLIGENCE_WEIGHTS };
    const store = humanEvaluationPreferenceFixture();
    const reviewed = reviewRelease(
      { ...readyPackage(store), status: "READY_FOR_RELEASE" },
      { decision: "RELEASE", reason: "permit canary", reviewerId: "anon-c" }
    );
    expect(reviewed.package.applied).toBe(false);
    expect(reviewed.package.status).not.toBe("RELEASED");
    expect(FORMATION_INTELLIGENCE_WEIGHTS).toEqual(before);
    expect(resolveReleaseWeights({ layer: "formation" }).version).toBe(FORMATION_WEIGHTS_V1);
  });

  it("D. Component Scope — Formation V2 が Transition V1 を変えない", () => {
    const pkg = readyPackage(humanEvaluationPreferenceFixture());
    expect(pkg.scope.music).toBe("unchanged");
    expect(pkg.scope.cue).toBe("unchanged");
    expect(pkg.scope.intent).toBe("unchanged");
    expect(pkg.scope.transition).toBe("unchanged");
    expect(pkg.transitionWeightsVersion).toMatch(/TRANSITION_V1|WEIGHTS_TRANSITION_V1/);
    expect(pkg.transitionWeights).toEqual(TRANSITION_SCORE_WEIGHTS);
  });

  it("E. Version Resolution — 正しい weight version を選ぶ", () => {
    const v1 = resolveWeights({ layer: "formation", version: FORMATION_WEIGHTS_V1 });
    expect(v1.version).toBe(FORMATION_WEIGHTS_V1);
    expect(v1.fallback).toBe(false);
    expect(v1.weights).toEqual(stableFormationWeights());
  });

  it("F. Canary Assignment — 同一 project は同じ variant", () => {
    const a = assignCanaryArm({
      packageId: "rel-1",
      projectKey: "project-a",
      enabled: true,
      percent: 50,
    });
    const b = assignCanaryArm({
      packageId: "rel-1",
      projectKey: "project-a",
      enabled: true,
      percent: 50,
    });
    expect(a.arm).toBe(b.arm);
    expect(a.stable).toBe(true);
    expect(assignCanaryArm({ packageId: "rel-1", projectKey: "project-a" }).arm).toBe("v1");
  });

  it("G. Canary Isolation — V2 failure が V1 へ影響しない", () => {
    const store = humanEvaluationPreferenceFixture();
    const canary = startCanary(
      reviewRelease(
        { ...readyPackage(store), status: "READY_FOR_RELEASE" },
        { decision: "RELEASE", reason: "canary", reviewerId: "anon-g" }
      ).package
    );
    const broken = {
      ...canary,
      status: "CANARY" as const,
      layer: "formation" as const,
      formationWeightsVersion: "WEIGHTS_DOES_NOT_EXIST",
    };
    const resolved = resolveReleaseWeights({
      layer: "formation",
      release: broken,
      canaryArm: "v2",
    });
    expect(resolved.version).toBe(FORMATION_WEIGHTS_V1);
    expect(resolved.fallback).toBe(true);
    expect(FORMATION_INTELLIGENCE_WEIGHTS).toEqual(stableFormationWeights());
  });

  it("H. Rollback — V2 → V1 へ正常復帰", () => {
    const store = humanEvaluationPreferenceFixture();
    let pkg = reviewRelease(
      { ...readyPackage(store), status: "READY_FOR_RELEASE" },
      { decision: "RELEASE", reason: "go", reviewerId: "anon-h" }
    ).package;
    pkg = startCanary(pkg);
    pkg = recordCanaryResult(pkg, { passed: true, reason: "metrics ok" });
    pkg = applyFullRelease(pkg);
    expect(pkg.status).toBe("RELEASED");
    const live = resolveReleaseWeights({ layer: "formation", release: pkg });
    expect(live.version).not.toBe(FORMATION_WEIGHTS_V1);
    const rolled = rollbackRelease(pkg);
    expect(rolled.status).toBe("ROLLBACK");
    expect(rolled.applied).toBe(false);
    const after = resolveReleaseWeights({ layer: "formation", release: rolled });
    expect(after.version).toBe(FORMATION_WEIGHTS_V1);
    expect(after.weights).toEqual(FORMATION_INTELLIGENCE_WEIGHTS);
  });

  it("I. Historic Reproduction — 指定 version で過去結果を再現", () => {
    const store = humanEvaluationPreferenceFixture();
    const row = store.records[0]!;
    const a = scoreBreakdownWithWeights(
      row.aiScoreSnapshot.breakdown,
      resolveWeights({ layer: "formation", version: FORMATION_WEIGHTS_V1 }).weights
    );
    const b = scoreBreakdownWithWeights(
      row.aiScoreSnapshot.breakdown,
      resolveWeights({ layer: "formation", version: FORMATION_WEIGHTS_V1 }).weights
    );
    expect(a).toBe(b);
  });

  it("J. Unknown Version — V1 fallback", () => {
    const unknown = resolveWeights({ layer: "formation", version: "latest" });
    expect(unknown.version).toBe(FORMATION_WEIGHTS_V1);
    expect(unknown.fallback).toBe(true);
    expect(resolveWeights({ layer: "formation", version: "no-such" }).fallback).toBe(true);
  });

  it("K. Regression Guard — 閾値超過で HOLD / 非eligible", () => {
    const store = humanEvaluationPreferenceFixture();
    const approval = approvedFormation(store);
    const shadow = {
      ...evaluateApprovedShadow(store, approval),
      status: "REGRESSION" as const,
    };
    const pkg = buildReleaseCandidate({ approval, shadow, store });
    expect(pkg.status).toBe("NOT_ELIGIBLE");
    expect(pkg.applied).toBe(false);
    const canaryHold = recordCanaryResult(
      { ...pkg, status: "CANARY" },
      { passed: false, reason: "reject rate up" }
    );
    expect(canaryHold.status).toBe("HOLD");
  });

  it("L. Determinism — 同一 Release Package 入力は同一 resolution", () => {
    const store = humanEvaluationPreferenceFixture();
    const a = readyPackage(store);
    const b = readyPackage(store);
    expect(a).toEqual(b);
    expect(formatReleaseReport(a)).toBe(formatReleaseReport(b));
    expect(resolveReleaseWeights({ layer: "formation", release: a })).toEqual(
      resolveReleaseWeights({ layer: "formation", release: b })
    );
  });

  it("does not mutate evaluation or production weights on release flow", () => {
    const store = humanEvaluationPreferenceFixture();
    const beforeRecords = JSON.stringify(store.records);
    const beforeW = { ...FORMATION_INTELLIGENCE_WEIGHTS };
    const released = applyFullRelease(
      recordCanaryResult(
        startCanary(
          reviewRelease(
            { ...readyPackage(store), status: "READY_FOR_RELEASE" },
            { decision: "RELEASE", reason: "x", reviewerId: "anon-z" }
          ).package
        ),
        { passed: true, reason: "ok" }
      )
    );
    expect(released.autoReleased).toBe(false);
    expect(JSON.stringify(store.records)).toBe(beforeRecords);
    expect(FORMATION_INTELLIGENCE_WEIGHTS).toEqual(beforeW);
  });
});
