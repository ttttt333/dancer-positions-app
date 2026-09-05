/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { TRANSITION_SCORE_WEIGHTS } from "../movement/transitionIntelligenceConfig";
import { RELEASE_CANARY_ENABLED } from "./releaseConfig";
import {
  analyzeRealWorldEvidence,
  canReleaseFormationV2,
  shadowRowsFromReport,
} from "./realWorldEvidence";
import {
  concentratedRealWorldStore,
  diverseObservationStore,
  emptyRealWorldStore,
  smallRealWorldStore,
} from "./realWorldEvidenceFixtures";
import { formatRealWorldEvidenceReport } from "./realWorldEvidenceReport";
import { HUMAN_EVALUATION_VERSION } from "./humanEvaluationConfig";
import type { ShadowReport } from "./shadowTypes";

function stubShadow(storeSchema: string, mismatch = false): ShadowReport {
  return {
    analysisVersion: "12.0.0-shadow",
    layer: "formation",
    status: "HOLD",
    confidence: "low",
    autoPromoted: false,
    productionWeightsVersion: "WEIGHTS_FORMATION_V1",
    shadowWeightsVersion: "WEIGHTS_FORMATION_V2_PROPOSAL",
    versions: {
      datasetVersion: mismatch ? "other-dataset" : storeSchema,
      algorithmVersion: "9.0.0-feedback-capture",
      analysisVersion: "10.0.0-discrepancy",
      approvalVersion: "11.0.0-approval-gate",
      weightsVersionCurrent: "WEIGHTS_FORMATION_V1",
      weightsVersionProposed: "WEIGHTS_FORMATION_V2_PROPOSAL",
    },
    sampleSize: 2,
    contextCount: 1,
    evaluations: [
      {
        evaluationId: "shd-1",
        candidateId: "s-1",
        contextKey: "song-a|c1|formation",
        layer: "formation",
        production: { score: 80, rank: 1, weightsVersion: "WEIGHTS_FORMATION_V1" },
        shadow: { score: 84, rank: 2, weightsVersion: "WEIGHTS_FORMATION_V2_PROPOSAL" },
        scoreDelta: 4,
        rankDelta: 1,
        productionHumanOutcome: "ACCEPT_UNCHANGED",
        counterfactual: "unknown",
        createdAt: "2026-09-05T00:00:00.000Z",
      },
    ],
    comparisons: [
      {
        contextKey: "song-a|c1|formation",
        layer: "formation",
        v1Top1: "s-1",
        v2Top1: "s-2",
        v1Ranking: ["s-1", "s-2"],
        v2Ranking: ["s-2", "s-1"],
        candidateSetChanged: false,
        rankingChanged: true,
        top1Changed: true,
        productionHumanOutcome: "ACCEPT_UNCHANGED",
        categories: ["RANK_CHANGED", "TOP1_CHANGED"],
      },
    ],
    observational: {
      v1Top1AcceptUnchanged: 1,
      v2Top1AcceptUnchanged: 0,
      v1Top1Reject: 0,
      v2Top1Reject: 0,
      comparableGroups: 1,
    },
    observed: [],
    hypothesis: [],
    notes: [],
  };
}

describe("realWorldEvidence", () => {
  it("A. No real data → INSUFFICIENT", () => {
    const report = analyzeRealWorldEvidence({ store: emptyRealWorldStore() });
    expect(report.readiness.status).toBe("INSUFFICIENT");
    expect(report.readiness.blockers).toContain("INSUFFICIENT_SAMPLE");
    expect(report.readiness.canReleaseFormationV2).toBe(false);
    expect(canReleaseFormationV2()).toBe(false);
  });

  it("B. Small real dataset → INSUFFICIENT", () => {
    const report = analyzeRealWorldEvidence({ store: smallRealWorldStore() });
    expect(report.readiness.status).toBe("INSUFFICIENT");
    expect(report.formation.candidateCount).toBe(2);
  });

  it("C. High sample / low diversity → INSUFFICIENT + LOW_*_DIVERSITY", () => {
    const report = analyzeRealWorldEvidence({ store: concentratedRealWorldStore() });
    expect(report.evidenceQuality.sampleCount).toBe(20);
    expect(report.evidenceQuality.uniqueProjectCount).toBe(1);
    expect(report.readiness.status).toBe("INSUFFICIENT");
    expect(report.readiness.blockers).toContain("LOW_PROJECT_DIVERSITY");
    expect(report.readiness.warnings).toEqual(
      expect.arrayContaining(["LOW_PROJECT_DIVERSITY", "LOW_SONG_DIVERSITY", "LOW_USER_DIVERSITY"])
    );
  });

  it("D. Diverse observation set → OBSERVATION_READY", () => {
    const report = analyzeRealWorldEvidence({ store: diverseObservationStore() });
    expect(report.readiness.status).toBe("OBSERVATION_READY");
    expect(report.readiness.canReleaseFormationV2).toBe(false);
  });

  it("E. Formation evidence does not contaminate Transition", () => {
    const report = analyzeRealWorldEvidence({ store: diverseObservationStore() });
    expect(report.formation.formationEditCount).toBeGreaterThan(0);
    expect("formationEditCount" in report.transition).toBe(false);
    expect(report.transition.pathEditCount).toBeGreaterThan(0);
    expect(report.formation.candidateCount + report.transition.candidateCount).toBe(
      report.evidenceQuality.sampleCount
    );
  });

  it("F. Transition evidence does not contaminate Formation", () => {
    const report = analyzeRealWorldEvidence({ store: diverseObservationStore() });
    expect("pathEditCount" in report.formation).toBe(false);
    expect(report.transition.impossibleCount).toBe(0);
    expect(report.formation.acceptCount).toBeGreaterThan(0);
  });

  it("G. Shadow human outcome remains V1 outcome", () => {
    const store = smallRealWorldStore();
    const shadow = stubShadow(store.schemaVersion);
    const report = analyzeRealWorldEvidence({ store, shadow });
    expect(report.shadow.humanOutcomeIsProduction).toBe(true);
    const rows = shadowRowsFromReport(shadow);
    expect(rows[0]?.humanOutcome).toBe("ACCEPT_UNCHANGED");
  });

  it("H. counterfactual remains unknown", () => {
    const store = smallRealWorldStore();
    const shadow = stubShadow(store.schemaVersion);
    const report = analyzeRealWorldEvidence({ store, shadow });
    expect(report.shadow.counterfactual).toBe("unknown");
    expect(shadowRowsFromReport(shadow).every((r) => r.counterfactual === "unknown")).toBe(true);
  });

  it("I. Version mismatch → UNAVAILABLE", () => {
    const store = smallRealWorldStore();
    const report = analyzeRealWorldEvidence({
      store,
      shadow: stubShadow(store.schemaVersion, true),
      expected: { datasetVersion: HUMAN_EVALUATION_VERSION },
    });
    expect(report.integrity).toBe("UNAVAILABLE");
    expect(report.readiness.status).toBe("UNAVAILABLE");
    expect(report.readiness.blockers).toContain("VERSION_MISMATCH");
    expect(report.shadow.evaluatedCount).toBe(0);
  });

  it("J. Same input dataset produces identical report", () => {
    const store = diverseObservationStore();
    const a = analyzeRealWorldEvidence({ store });
    const b = analyzeRealWorldEvidence({ store });
    expect(a).toEqual(b);
    expect(formatRealWorldEvidenceReport(a)).toBe(formatRealWorldEvidenceReport(b));
  });

  it("K. Production V1 remains unchanged after Stage 14", () => {
    const beforeF = { ...FORMATION_INTELLIGENCE_WEIGHTS };
    const beforeT = { ...TRANSITION_SCORE_WEIGHTS };
    analyzeRealWorldEvidence({ store: diverseObservationStore() });
    expect(FORMATION_INTELLIGENCE_WEIGHTS).toEqual(beforeF);
    expect(TRANSITION_SCORE_WEIGHTS).toEqual(beforeT);
  });

  it("L. Stage 14 cannot trigger Apply / Release / Canary", () => {
    const report = analyzeRealWorldEvidence({ store: diverseObservationStore() });
    expect(report.readiness.canReleaseFormationV2).toBe(false);
    expect(canReleaseFormationV2()).toBe(false);
    expect(RELEASE_CANARY_ENABLED).toBe(false);
    expect(report.readiness.status).not.toBe("RELEASE_CANDIDATE");
  });
});
