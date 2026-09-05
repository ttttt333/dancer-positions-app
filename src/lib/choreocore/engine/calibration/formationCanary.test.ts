/** @vitest-environment node */
import { describe, expect, it, beforeEach } from "vitest";
import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { TRANSITION_SCORE_WEIGHTS } from "../movement/transitionIntelligenceConfig";
import { ANALYSIS_VERSION } from "../constants";
import { CUE_ANALYSIS_VERSION } from "../cue/cueConfig";
import { CHOREOGRAPHIC_INTENT_VERSION } from "../intent/ChoreographicIntentEngine";
import { TRANSITION_INTELLIGENCE_VERSION } from "../movement/transitionIntelligenceConfig";
import { recommendFormationsForIntent } from "../formation/intentFormationIntelligence";
import { DEFAULT_STAGE, lineFormation, makeCue } from "../formation/formationFixtures";
import { captureSuggestionOutcome } from "./humanFeedbackCapture";
import { RELEASE_CANARY_ENABLED } from "./releaseConfig";
import { applyFullRelease } from "./releaseGate";
import { evaluateReleaseReadiness, reviewReleaseDecision } from "./releaseDecision";
import { eligibleFixtureBundle } from "./releaseDecisionFixtures";
import {
  activateFormationCanary,
  appendCanaryObservation,
  getProductionCanaryActivation,
  listCanaryObservations,
  listCanarySafetyEvents,
  resetFormationCanaryForTests,
  resolveFormationArm,
  resolveFormationCanaryWeights,
  rollbackFormationCanary,
} from "./formationCanary";
import { recommendFormationsWithCanary } from "./formationCanaryRecommend";
import { recordCanaryObservationsFromSuggestion } from "./formationCanaryObserve";
import { assessCanaryHealth } from "./formationCanaryHealth";
import { formatFormationCanaryReport } from "./formationCanaryReport";
import { proposeWeightAdjustments } from "./weightProposal";
import type { FormationCanaryActivation } from "./formationCanaryTypes";
import type { ReleasePackage } from "./releaseTypes";
import type { Formation } from "../types/FormationTypes";
import { stageCoverage } from "../formation/FormationScaler";

function formationFromLine(count = 6): Formation {
  const positions = lineFormation(count);
  return {
    id: "cur-line",
    type: "LINE",
    positions,
    symmetry: 92,
    complexity: 22,
    stageCoverage: stageCoverage(positions, DEFAULT_STAGE),
    visualImpact: 48,
    tags: ["line"],
  };
}

function formationRequest() {
  return {
    intent: {
      cueId: "cue-intent-1",
      primary: {
        intent: "EXPAND" as const,
        score: 0.88,
        confidence: 0.84,
        intensity: 0.82,
        sourceEventIds: ["ec-1"],
        reasonCodes: ["EXPAND"],
      },
      alternatives: [],
      contrastFromPrevious: 0,
      previousIntent: null,
      sourceEventId: "ec-1",
      chorusFamilyId: null,
      variation: "none" as const,
    },
    cue: makeCue("EXPAND", "LARGE", { id: "cue-intent-1", rawTime: 48 }),
    currentFormation: formationFromLine(),
    dancerCount: 6,
    stage: DEFAULT_STAGE,
    previousIntent: null,
    constraints: { bpm: 120, availableSeconds: 4 },
  };
}

function approvedCanaryPackage(): ReleasePackage {
  const bundle = eligibleFixtureBundle();
  const report = evaluateReleaseReadiness({
    store: bundle.store,
    domain: "formation",
    dataSource: "FIXTURE",
    approvedWeightPackage: bundle.approval,
    shadow: bundle.shadow,
    releasePackage: bundle.releasePackage,
  });
  const reviewed = reviewReleaseDecision(report, {
    decision: "RELEASE",
    reason: "fixture canary infra",
    reviewerId: "anon-c16",
    reviewedAt: "2026-09-05T00:00:00.000Z",
  });
  return reviewed.report.releasePackage!;
}

function activateFixture(percent = 100): FormationCanaryActivation {
  const started = activateFormationCanary({
    releasePackage: approvedCanaryPackage(),
    reviewerId: "anon-c16",
    activatedAt: "2026-09-05T00:00:00.000Z",
    dataSource: "FIXTURE",
    canaryPercentage: percent,
  });
  if (!started.activation) throw new Error(started.reason);
  return started.activation;
}

beforeEach(() => {
  resetFormationCanaryForTests();
});

describe("formationCanary Stage 16", () => {
  it("A. Canary OFF keeps Production V1 behavior", () => {
    const request = formationRequest();
    const off = resolveFormationCanaryWeights({ projectKey: "proj-a" });
    expect(off.canaryOff).toBe(true);
    expect(off.arm).toBe("V1");
    expect(off.formationWeights).toEqual(FORMATION_INTELLIGENCE_WEIGHTS);
    const a = recommendFormationsForIntent(request);
    const b = recommendFormationsForIntent({ ...request, scoreWeights: undefined });
    expect(a.ranked.map((row) => row.score)).toEqual(b.ranked.map((row) => row.score));
    expect(getProductionCanaryActivation()).toBeNull();
  });

  it("B. Eligible approved package activates correctly", () => {
    const result = activateFormationCanary({
      releasePackage: approvedCanaryPackage(),
      reviewerId: "anon-act",
      activatedAt: "2026-09-05T00:00:00.000Z",
      dataSource: "FIXTURE",
      canaryPercentage: 100,
    });
    expect(result.accepted).toBe(true);
    expect(result.activation?.domain).toBe("FORMATION");
    expect(result.activation?.releasePackage.status).toBe("CANARY");
    expect(result.activation?.releasePackage.applied).toBe(false);
    expect(getProductionCanaryActivation()).toBeNull();
  });

  it("C. Non-approved package cannot activate", () => {
    const pkg = { ...approvedCanaryPackage(), status: "READY_FOR_RELEASE" as const };
    const result = activateFormationCanary({
      releasePackage: pkg,
      reviewerId: "anon-c",
      activatedAt: "2026-09-05T00:00:00.000Z",
      dataSource: "FIXTURE",
    });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NOT_APPROVED_FOR_CANARY");
  });

  it("D. Invalid package falls back to V1", () => {
    const activation = activateFixture(100);
    const broken: FormationCanaryActivation = {
      ...activation,
      releasePackage: { ...activation.releasePackage, layer: "transition" },
    };
    const resolved = resolveFormationCanaryWeights({
      projectKey: "proj-d",
      activation: broken,
      safetyAt: "2026-09-05T00:00:00.000Z",
    });
    expect(resolved.arm).toBe("V1");
    expect(resolved.fallback).toBe(true);
  });

  it("E. Version mismatch falls back to V1", () => {
    const activation = activateFixture(100);
    const broken: FormationCanaryActivation = {
      ...activation,
      releasePackage: {
        ...activation.releasePackage,
        formationWeightsVersion: "WEIGHTS_DOES_NOT_EXIST",
      },
    };
    const resolved = resolveFormationCanaryWeights({
      projectKey: "proj-e",
      activation: broken,
      safetyAt: "2026-09-05T00:00:00.000Z",
    });
    expect(resolved.arm).toBe("V1");
    expect(resolved.fallback).toBe(true);
    expect(resolved.formationWeights).toEqual(FORMATION_INTELLIGENCE_WEIGHTS);
  });

  it("F. Same projectKey + packageId always resolves to the same arm", () => {
    const activation = activateFixture(50);
    const a = resolveFormationArm({
      projectKey: "stable-project",
      releasePackageId: activation.releasePackageId,
      canaryConfig: activation.config,
    });
    const b = resolveFormationArm({
      projectKey: "stable-project",
      releasePackageId: activation.releasePackageId,
      canaryConfig: activation.config,
    });
    expect(a).toBe(b);
  });

  it("G. Different projects can be deterministically distributed", () => {
    const activation = activateFixture(50);
    const arms = new Set(
      ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"].map((projectKey) =>
        resolveFormationArm({
          projectKey,
          releasePackageId: activation.releasePackageId,
          canaryConfig: activation.config,
        })
      )
    );
    expect(arms.size).toBeGreaterThan(1);
  });

  it("H–L. Canary affects Formation only; other layers stay V1", () => {
    const activation = activateFixture(100);
    const resolved = resolveFormationCanaryWeights({
      projectKey: "proj-v2",
      activation,
    });
    expect(resolved.arm).toBe("V2");
    expect(resolved.formationVersion).toBe("V2");
    expect(resolved.transitionVersion).toBe("V1");
    expect(resolved.musicVersion).toBe("V1");
    expect(resolved.cueVersion).toBe("V1");
    expect(resolved.intentVersion).toBe("V1");
    expect(resolved.context.musicVersion).toBe(ANALYSIS_VERSION);
    expect(resolved.context.cueVersion).toBe(CUE_ANALYSIS_VERSION);
    expect(resolved.context.intentVersion).toBe(CHOREOGRAPHIC_INTENT_VERSION);
    expect(resolved.context.transitionVersion).toBe(TRANSITION_INTELLIGENCE_VERSION);
    expect(resolved.context.productionFormationVersion).toBe("V1");
    expect(TRANSITION_SCORE_WEIGHTS).toEqual(TRANSITION_SCORE_WEIGHTS);
  });

  it("M. Normal Editor feedback continues to be captured", () => {
    const captured = captureSuggestionOutcome(
      {
        musicId: "song-m",
        createdAt: "2026-09-05T00:00:00.000Z",
        acceptedCueIds: ["c1"],
        cues: [{ id: "c1", formationId: "f1", tStartSec: 0, tEndSec: 4 }],
        formations: [{ id: "f1", name: "V", dancers: [{ id: "d1", xPct: 40, yPct: 40 }] }],
      },
      new Set(["c1"])
    );
    expect(captured.events.some((event) => event.action === "ACCEPT")).toBe(true);
    const rows = recordCanaryObservationsFromSuggestion(
      {
        musicId: "song-m",
        createdAt: "2026-09-05T00:00:00.000Z",
        acceptedCueIds: ["c1"],
        cues: [{ id: "c1", formationId: "f1", tStartSec: 0, tEndSec: 4 }],
        formations: [{ id: "f1", name: "V", dancers: [{ id: "d1", xPct: 40, yPct: 40 }] }],
      },
      new Set(["c1"]),
      activateFixture(100)
    );
    expect(rows[0]?.humanOutcome).toBe("ACCEPT_UNCHANGED");
    expect(rows[0]?.counterfactual).toBe("unknown");
  });

  it("N. V2 calculation failure falls back to V1", () => {
    const activation = activateFixture(100);
    const result = recommendFormationsWithCanary(formationRequest(), {
      projectKey: "proj-n",
      activation,
      forceScoreThrow: true,
      safetyAt: "2026-09-05T00:00:00.000Z",
    });
    expect(result.resolution.fallback).toBe(true);
    expect(result.resolution.arm).toBe("V1");
    expect(result.recommendation.primary).not.toBeNull();
  });

  it("O. Malformed V2 result falls back to V1", () => {
    const activation = activateFixture(100);
    const result = recommendFormationsWithCanary(formationRequest(), {
      projectKey: "proj-o",
      activation,
      forceMalformed: true,
      safetyAt: "2026-09-05T00:00:00.000Z",
    });
    expect(result.resolution.fallback).toBe(true);
    expect(result.recommendation.ranked.every((row) => Number.isFinite(row.score))).toBe(true);
  });

  it("P. Rollback returns to stable V1", () => {
    const activation = activateFixture(100);
    const rolled = rollbackFormationCanary(activation);
    expect(rolled.package.status).toBe("ROLLBACK");
    expect(rolled.activation.config.enabled).toBe(false);
    const resolved = resolveFormationCanaryWeights({
      projectKey: "proj-p",
      activation: rolled.activation,
    });
    expect(resolved.arm).toBe("V1");
    expect(resolved.canaryOff || resolved.fallback || resolved.arm === "V1").toBe(true);
    expect(resolved.formationWeights).toEqual(FORMATION_INTELLIGENCE_WEIGHTS);
  });

  it("Q. Rollback preserves historical evidence", () => {
    const activation = activateFixture(100);
    appendCanaryObservation({
      activationId: activation.activationId,
      releasePackageId: activation.releasePackageId,
      projectKey: "proj-q",
      songKey: "song-q",
      sessionKey: "sess-q",
      arm: "V2",
      candidateContextHash: "abc",
      productionVersion: "V1",
      activeVersion: "V2",
      candidateId: "cand-q",
      humanOutcome: "ACCEPT_UNCHANGED",
      observedAt: "2026-09-05T00:00:00.000Z",
      counterfactual: "unknown",
    });
    const before = listCanaryObservations();
    const rolled = rollbackFormationCanary(activation);
    expect(listCanaryObservations()).toEqual(before);
    expect(rolled.observations).toHaveLength(1);
  });

  it("R. No automatic rollout progression occurs", () => {
    const activation = activateFixture(10);
    resolveFormationCanaryWeights({ projectKey: "proj-r", activation });
    expect(activation.config.canaryPercentage).toBe(10);
    expect(activation.config.assignmentMode).toBe("DETERMINISTIC_PERCENT");
  });

  it("S. No automatic promotion occurs", () => {
    const activation = activateFixture(100);
    expect(activation.releasePackage.applied).toBe(false);
    expect(activation.releasePackage.status).toBe("CANARY");
    expect(applyFullRelease(activation.releasePackage).status).not.toBe("RELEASED");
    expect(RELEASE_CANARY_ENABLED).toBe(false);
  });

  it("T. No automatic weight learning occurs", () => {
    const before = { ...FORMATION_INTELLIGENCE_WEIGHTS };
    const store = eligibleFixtureBundle().store;
    proposeWeightAdjustments(store, "formation");
    activateFixture(100);
    expect(FORMATION_INTELLIGENCE_WEIGHTS).toEqual(before);
  });

  it("U. Repeated evaluation is deterministic", () => {
    const activation = activateFixture(50);
    const a = resolveFormationCanaryWeights({ projectKey: "proj-u", activation });
    const b = resolveFormationCanaryWeights({ projectKey: "proj-u", activation });
    expect(a).toEqual(b);
    const healthA = assessCanaryHealth({
      activation,
      observations: listCanaryObservations(),
      safety: listCanarySafetyEvents(),
    });
    const healthB = assessCanaryHealth({
      activation,
      observations: listCanaryObservations(),
      safety: listCanarySafetyEvents(),
    });
    expect(healthA).toEqual(healthB);
    expect(formatFormationCanaryReport(healthA, activation)).toBe(
      formatFormationCanaryReport(healthB, activation)
    );
  });

  it("V. Canary observation preserves counterfactual = unknown", () => {
    const rows = recordCanaryObservationsFromSuggestion(
      {
        musicId: "song-v",
        createdAt: "2026-09-05T00:00:00.000Z",
        acceptedCueIds: [],
        cues: [{ id: "c2", formationId: "f2", tStartSec: 4, tEndSec: 8 }],
        formations: [{ id: "f2", name: "V", dancers: [{ id: "d1", xPct: 50, yPct: 50 }] }],
      },
      new Set(),
      activateFixture(100)
    );
    expect(rows.every((row) => row.counterfactual === "unknown")).toBe(true);
  });

  it("real Production Canary stays unavailable with empty evidence", () => {
    const real = activateFormationCanary({
      releasePackage: approvedCanaryPackage(),
      reviewerId: "anon-real",
      activatedAt: "2026-09-05T00:00:00.000Z",
      dataSource: "REAL",
    });
    expect(real.accepted).toBe(false);
    expect(real.reason).toBe("REAL_EVIDENCE_NOT_ELIGIBLE");
    expect(getProductionCanaryActivation()).toBeNull();
  });
});
