/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { TRANSITION_SCORE_WEIGHTS } from "../movement/transitionIntelligenceConfig";
import { RELEASE_CANARY_ENABLED } from "./releaseConfig";
import { startCanary } from "./releaseGate";
import {
  canFormationV2ProceedToCanary,
  canProceedToCanary,
  evaluateProductionReleaseReadiness,
  evaluateReleaseReadiness,
  reviewReleaseDecision,
} from "./releaseDecision";
import {
  appendReleaseDecisionReview,
  loadReleaseDecisionReviews,
} from "./releaseDecisionPersist";
import { formatReleaseDecisionReport } from "./releaseDecisionReport";
import {
  concentratedRealWorldStore,
  diverseEvidenceReadyStore,
  eligibleFixtureBundle,
  emptyRealWorldStore,
  smallRealWorldStore,
  stubApprovedFormation,
  stubReleasePackage,
  stubShadowForStore,
  transitionOnlyStore,
} from "./releaseDecisionFixtures";
import { appendHumanEvaluation } from "./humanEvaluationStore";
import { memoryFeedbackStorage, resetMemoryFeedbackStorage } from "./humanFeedbackPersist";
import { resetHumanFeedbackSessionForTests } from "./humanFeedbackCapture";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("releaseDecision Stage 15", () => {
  it("A. No real data → NOT_ELIGIBLE + INSUFFICIENT_SAMPLE", () => {
    resetMemoryFeedbackStorage();
    resetHumanFeedbackSessionForTests(memoryFeedbackStorage());
    const report = evaluateReleaseReadiness({
      store: emptyRealWorldStore(),
      domain: "formation",
      dataSource: "REAL",
    });
    expect(report.status).toBe("NOT_ELIGIBLE");
    expect(report.hardBlockers).toContain("INSUFFICIENT_SAMPLE");
    expect(report.review.sampleCount).toBe(0);
    expect(report.canProceedToCanary).toBe(false);
    expect(canFormationV2ProceedToCanary(report)).toBe(false);
    const production = evaluateProductionReleaseReadiness({
      domain: "formation",
      storage: memoryFeedbackStorage(),
    });
    expect(production.dataSource).toBe("REAL");
    expect(production.status).toBe("NOT_ELIGIBLE");
    expect(production.review.sampleCount).toBe(0);
  });

  it("B. Fixture data evaluates deterministically and is not real evidence", () => {
    const { store, approval, shadow, releasePackage } = eligibleFixtureBundle();
    const input = {
      store,
      domain: "formation" as const,
      dataSource: "FIXTURE" as const,
      approvedWeightPackage: approval,
      shadow,
      releasePackage,
    };
    const a = evaluateReleaseReadiness(input);
    const b = evaluateReleaseReadiness(input);
    expect(a).toEqual(b);
    expect(a.dataSource).toBe("FIXTURE");
    expect(a.warnings).toContain("FIXTURE_DATA_NOT_PRODUCTION_EVIDENCE");
    expect(a.productionCanaryEligible).toBe(false);
    expect(canProceedToCanary(a)).toBe(false);
  });

  it("C. High sample / low diversity is blocked even with soft metrics", () => {
    const store = concentratedRealWorldStore();
    const approval = stubApprovedFormation(store);
    const report = evaluateReleaseReadiness({
      store,
      domain: "formation",
      dataSource: "FIXTURE",
      approvedWeightPackage: approval,
      shadow: stubShadowForStore(store),
      releasePackage: stubReleasePackage(store, approval),
    });
    expect(report.status).toBe("NOT_ELIGIBLE");
    expect(report.hardBlockers).toEqual(
      expect.arrayContaining(["INSUFFICIENT_SAMPLE", "LOW_PROJECT_DIVERSITY", "LOW_SONG_DIVERSITY"])
    );
    expect(report.softEvidence.formationAcceptRate).not.toBeNull();
    expect(report.hardBlockers.some((row) => row.includes("ACCEPT"))).toBe(false);
  });

  it("D. High-quality diverse evidence is eligible for human review only", () => {
    const { store, approval, shadow, releasePackage } = eligibleFixtureBundle();
    const report = evaluateReleaseReadiness({
      store,
      domain: "formation",
      dataSource: "FIXTURE",
      approvedWeightPackage: approval,
      shadow,
      releasePackage,
    });
    expect(report.status).toBe("READY_FOR_RELEASE");
    expect(report.hardBlockers).toEqual([]);
    expect(report.checklist.every((item) => item.verdict === "PASS")).toBe(true);
    expect(report.humanDecision).toBeNull();
    expect(canProceedToCanary(report)).toBe(false);
  });

  it("E. Missing Stage 11 approval is blocked", () => {
    const { store, shadow, releasePackage } = eligibleFixtureBundle();
    const report = evaluateReleaseReadiness({
      store,
      domain: "formation",
      dataSource: "FIXTURE",
      shadow,
      releasePackage,
    });
    expect(report.status).toBe("NOT_ELIGIBLE");
    expect(report.hardBlockers).toContain("APPROVAL_MISSING");
  });

  it("F. Missing Stage 12 shadow is blocked", () => {
    const { store, approval, releasePackage } = eligibleFixtureBundle();
    const report = evaluateReleaseReadiness({
      store,
      domain: "formation",
      dataSource: "FIXTURE",
      approvedWeightPackage: approval,
      releasePackage,
    });
    expect(report.status).toBe("NOT_ELIGIBLE");
    expect(report.hardBlockers).toContain("SHADOW_EVIDENCE_MISSING");
  });

  it("G. Version mismatch is blocked", () => {
    const { store, approval, releasePackage } = eligibleFixtureBundle();
    const report = evaluateReleaseReadiness({
      store,
      domain: "formation",
      dataSource: "FIXTURE",
      approvedWeightPackage: approval,
      shadow: stubShadowForStore(store, { mismatch: true }),
      releasePackage,
    });
    expect(report.status).toBe("NOT_ELIGIBLE");
    expect(report.hardBlockers).toContain("VERSION_MISMATCH");
    expect(report.dimensions.versionIntegrity).toBe("BLOCKED");
  });

  it("H. Major regression is blocked", () => {
    const { store, approval, releasePackage } = eligibleFixtureBundle();
    const report = evaluateReleaseReadiness({
      store,
      domain: "formation",
      dataSource: "FIXTURE",
      approvedWeightPackage: approval,
      shadow: stubShadowForStore(store, { regression: true }),
      releasePackage,
    });
    expect(report.status).toBe("NOT_ELIGIBLE");
    expect(report.hardBlockers).toContain("MAJOR_REGRESSION");
    expect(report.review.regressionStatus).toBe("MAJOR_REGRESSION");
  });

  it("I. Top1 regression is blocked", () => {
    const { store, approval, shadow, releasePackage } = eligibleFixtureBundle();
    const blockedApproval = {
      ...approval,
      comparison: approval.comparison
        ? {
            ...approval.comparison,
            metrics: [
              { key: "top1Agreement", v1: 0.8, v2: 0.4, delta: -0.4, direction: "worsened" as const },
            ],
            criticalRegressions: ["top1Agreement worsened"],
          }
        : approval.comparison,
    };
    const report = evaluateReleaseReadiness({
      store,
      domain: "formation",
      dataSource: "FIXTURE",
      approvedWeightPackage: blockedApproval,
      shadow,
      releasePackage,
    });
    expect(report.status).toBe("NOT_ELIGIBLE");
    expect(report.hardBlockers).toContain("TOP1_REGRESSION");
    expect(report.hardBlockers).not.toContain("MAJOR_REGRESSION");
  });

  it("J. HOLD records correctly without mutating V1", () => {
    const { store, approval, shadow, releasePackage } = eligibleFixtureBundle();
    const before = evaluateReleaseReadiness({
      store,
      domain: "formation",
      dataSource: "FIXTURE",
      approvedWeightPackage: approval,
      shadow,
      releasePackage,
    });
    const reviewed = reviewReleaseDecision(before, {
      decision: "HOLD",
      reason: "insufficient diversity in production, keep reviewable",
      reviewerId: "anon-hold",
      reviewedAt: "2026-09-05T00:00:00.000Z",
    });
    expect(reviewed.accepted).toBe(true);
    expect(reviewed.report.status).toBe("HOLD");
    expect(reviewed.report.humanDecision).toBe("HOLD");
    expect(reviewed.report.reviews).toHaveLength(1);
    expect(reviewed.report.releasePackage).toEqual(before.releasePackage);
    const storage = memoryStorage();
    appendReleaseDecisionReview(reviewed.review, storage);
    expect(loadReleaseDecisionReviews(storage)).toHaveLength(1);
  });

  it("K. REJECT records correctly and leaves the package inactive", () => {
    const { store, approval, shadow, releasePackage } = eligibleFixtureBundle();
    const before = evaluateReleaseReadiness({
      store,
      domain: "formation",
      dataSource: "FIXTURE",
      approvedWeightPackage: approval,
      shadow,
      releasePackage,
    });
    const reviewed = reviewReleaseDecision(before, {
      decision: "REJECT",
      reason: "do not proceed",
      reviewerId: "reviewer-k",
      reviewedAt: "2026-09-05T00:00:00.000Z",
    });
    expect(reviewed.accepted).toBe(true);
    expect(reviewed.report.status).toBe("REJECTED");
    expect(reviewed.review.reviewerId.startsWith("anon-")).toBe(true);
    expect(reviewed.report.releasePackage?.status).toBe("REJECTED");
    expect(reviewed.report.releasePackage?.applied).toBe(false);
  });

  it("L. RELEASE records correctly as Canary permission only", () => {
    const { store, approval, shadow, releasePackage } = eligibleFixtureBundle();
    const before = evaluateReleaseReadiness({
      store,
      domain: "formation",
      dataSource: "FIXTURE",
      approvedWeightPackage: approval,
      shadow,
      releasePackage,
    });
    const reviewed = reviewReleaseDecision(before, {
      decision: "RELEASE",
      reason: "fixture review",
      reviewerId: "anon-rel",
      reviewedAt: "2026-09-05T00:00:00.000Z",
    });
    expect(reviewed.accepted).toBe(true);
    expect(reviewed.report.status).toBe("APPROVED_FOR_CANARY");
    expect(reviewed.report.humanDecision).toBe("RELEASE");
    expect(reviewed.report.releasePackage?.applied).toBe(false);
    expect(reviewed.report.releasePackage?.status).not.toBe("CANARY");
    expect(reviewed.report.releasePackage?.status).not.toBe("RELEASED");
    expect(canProceedToCanary(reviewed.report)).toBe(false);
  });

  it("M. RELEASE does not change Production V1", () => {
    const beforeF = { ...FORMATION_INTELLIGENCE_WEIGHTS };
    const beforeT = { ...TRANSITION_SCORE_WEIGHTS };
    const { store, approval, shadow, releasePackage } = eligibleFixtureBundle();
    const reviewed = reviewReleaseDecision(
      evaluateReleaseReadiness({
        store,
        domain: "formation",
        dataSource: "FIXTURE",
        approvedWeightPackage: approval,
        shadow,
        releasePackage,
      }),
      {
        decision: "RELEASE",
        reason: "still not production",
        reviewerId: "anon-m",
        reviewedAt: "2026-09-05T00:00:00.000Z",
      }
    );
    expect(FORMATION_INTELLIGENCE_WEIGHTS).toEqual(beforeF);
    expect(TRANSITION_SCORE_WEIGHTS).toEqual(beforeT);
    expect(RELEASE_CANARY_ENABLED).toBe(false);
    expect(reviewed.report.releasePackage?.applied).toBe(false);
    expect(startCanary).not.toBeUndefined();
  });

  it("N. Same snapshot produces an identical decision", () => {
    const bundle = eligibleFixtureBundle();
    const input = {
      store: bundle.store,
      domain: "formation" as const,
      dataSource: "FIXTURE" as const,
      approvedWeightPackage: bundle.approval,
      shadow: bundle.shadow,
      releasePackage: bundle.releasePackage,
    };
    const a = evaluateReleaseReadiness(input);
    const b = evaluateReleaseReadiness(input);
    expect(a).toEqual(b);
    expect(formatReleaseDecisionReport(a)).toBe(formatReleaseDecisionReport(b));
  });

  it("O. Formation evidence does not alter Transition decision", () => {
    const transitionStore = transitionOnlyStore();
    const before = evaluateReleaseReadiness({
      store: transitionStore,
      domain: "transition",
      dataSource: "FIXTURE",
    });
    let mixed = transitionStore;
    for (const row of diverseEvidenceReadyStore().records) {
      mixed = appendHumanEvaluation(mixed, row);
    }
    const after = evaluateReleaseReadiness({
      store: mixed,
      domain: "transition",
      dataSource: "FIXTURE",
    });
    expect(mixed.records.length).toBeGreaterThan(transitionStore.records.length);
    expect(after.review.sampleCount).toBe(before.review.sampleCount);
    expect(after.status).toBe(before.status);
    expect(after.hardBlockers).toEqual(before.hardBlockers);
    const formation = evaluateReleaseReadiness({
      store: mixed,
      domain: "formation",
      dataSource: "FIXTURE",
    });
    expect(formation.review.sampleCount).toBeGreaterThan(after.review.sampleCount);
  });

  it("fixture evidence never makes the production candidate eligible", () => {
    const { store, approval, shadow, releasePackage } = eligibleFixtureBundle();
    const fixture = evaluateReleaseReadiness({
      store,
      domain: "formation",
      dataSource: "FIXTURE",
      approvedWeightPackage: approval,
      shadow,
      releasePackage,
    });
    expect(fixture.status).toBe("READY_FOR_RELEASE");
    expect(canProceedToCanary(fixture)).toBe(false);
    resetMemoryFeedbackStorage();
    const real = evaluateProductionReleaseReadiness({
      domain: "formation",
      storage: memoryFeedbackStorage(),
    });
    expect(real.dataSource).toBe("REAL");
    expect(real.status).toBe("NOT_ELIGIBLE");
    expect(real.review.sampleCount).toBe(0);
    expect(canProceedToCanary(real)).toBe(false);
  });

  it("small real dataset stays NOT_ELIGIBLE", () => {
    const report = evaluateReleaseReadiness({
      store: smallRealWorldStore(),
      domain: "formation",
      dataSource: "REAL",
    });
    expect(report.status).toBe("NOT_ELIGIBLE");
    expect(report.hardBlockers).toContain("INSUFFICIENT_SAMPLE");
  });
});
