/** @vitest-environment node */
import { afterEach, describe, expect, it } from "vitest";
import { setMusicEnginePhase12EnabledForTests } from "../audio/musicEngineFlag";
import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { TRANSITION_SCORE_WEIGHTS } from "../movement/transitionIntelligenceConfig";
import { createEmptyProject } from "../../../projectDefaults";
import type { ChoreographyProjectJson, Cue, Formation } from "../../../../types/choreography";
import {
  captureEditorSuggestionApply,
  captureProjectEditsAgainstOrigins,
  feedbackToEvaluationStore,
  HumanFeedbackSession,
  observeEditorProjectChange,
  resetHumanFeedbackSessionForTests,
} from "./humanFeedbackCapture";
import type { FeedbackStorage } from "./humanFeedbackPersist";
import { HUMAN_EVALUATION_VERSION } from "./humanEvaluationConfig";
import { analyzeDiscrepancy } from "./discrepancyAnalysis";
import { evaluateApprovedShadow } from "./shadowEvaluate";
import { buildWeightApprovalPackage } from "./weightApprovalGate";
import { analyzeRealWorldEvidence } from "./realWorldEvidence";
import { evaluateProductionReleaseReadiness, evaluateReleaseReadiness } from "./releaseDecision";
import { eligibleFixtureBundle } from "./releaseDecisionFixtures";
import {
  getProductionCanaryActivation,
  resetFormationCanaryForTests,
  resolveFormationCanaryWeights,
} from "./formationCanary";
import { RELEASE_CANARY_ENABLED } from "./releaseConfig";
import { importHumanEvaluationDataset } from "./humanEvaluationStore";
import {
  auditProductionInstrumentation,
  confirmNoAutomaticRelease,
} from "./productionInstrumentationAudit";
import type { CaptureSuggestionInput } from "./humanFeedbackTypes";

function isolatedStorage(): FeedbackStorage {
  const map = new Map<string, string>();
  return {
    getItem(key) {
      return map.get(key) ?? null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
  };
}

function suggestionInput(overrides?: Partial<CaptureSuggestionInput>): CaptureSuggestionInput {
  return {
    musicId: "本番の曲A",
    acceptedCueIds: ["cue-v"],
    createdAt: "2026-09-05T13:00:00.000Z",
    cues: [
      { id: "cue-v", formationId: "form-v", tStartSec: 8, tEndSec: 16 },
      { id: "cue-line", formationId: "form-line", tStartSec: 16, tEndSec: 24 },
    ],
    formations: [
      {
        id: "form-v",
        name: "V",
        dancers: [
          { id: "d1", xPct: 40, yPct: 50 },
          { id: "d2", xPct: 60, yPct: 50 },
        ],
      },
      {
        id: "form-line",
        name: "LINE",
        dancers: [
          { id: "d1", xPct: 30, yPct: 50 },
          { id: "d2", xPct: 70, yPct: 50 },
        ],
      },
    ],
    ...overrides,
  };
}

function formationFrom(
  id: string,
  name: string,
  dancers: Array<{ id: string; xPct: number; yPct: number }>
): Formation {
  return {
    id,
    name,
    dancers: dancers.map((d, i) => ({
      id: d.id,
      label: String(i + 1),
      xPct: d.xPct,
      yPct: d.yPct,
      colorIndex: i,
    })),
  };
}

function projectWithCandidate(input: {
  name?: string;
  dancers?: Array<{ id: string; xPct: number; yPct: number }>;
  tStartSec?: number;
  tEndSec?: number;
  gapApproachFromPrev?: Cue["gapApproachFromPrev"];
  dancerCustomPaths?: Cue["dancerCustomPaths"];
}): ChoreographyProjectJson {
  const base = createEmptyProject();
  const form = formationFrom(
    "form-v",
    input.name ?? "V",
    input.dancers ?? [
      { id: "d1", xPct: 40, yPct: 50 },
      { id: "d2", xPct: 60, yPct: 50 },
    ]
  );
  return {
    ...base,
    pieceTitle: "本番の曲A",
    formations: [form],
    activeFormationId: form.id,
    cues: [
      {
        id: "cue-v",
        formationId: "form-v",
        tStartSec: input.tStartSec ?? 8,
        tEndSec: input.tEndSec ?? 16,
        gapApproachFromPrev: input.gapApproachFromPrev,
        dancerCustomPaths: input.dancerCustomPaths,
      },
    ],
  };
}

function productionFlow(storage: FeedbackStorage, accepted: ReadonlySet<string>) {
  resetHumanFeedbackSessionForTests(storage);
  captureEditorSuggestionApply(suggestionInput(), accepted);
  return new HumanFeedbackSession(storage);
}

afterEach(() => {
  setMusicEnginePhase12EnabledForTests(undefined);
  resetHumanFeedbackSessionForTests();
  resetFormationCanaryForTests();
});

describe("productionInstrumentationAudit", () => {
  it("A. ACCEPT is captured from the Editor apply entry", () => {
    setMusicEnginePhase12EnabledForTests(false);
    const session = productionFlow(isolatedStorage(), new Set(["cue-v"]));
    expect(session.events.some((e) => e.action === "ACCEPT" && e.candidateId === "form-v")).toBe(
      true
    );
    const record = session.evaluationRecords.find((r) => r.subject.candidateId === "form-v");
    expect(record?.decision).toBe("accept");
    expect(record?.subject.candidateId).toBe("form-v");
    expect(record?.evaluatorContext?.source).toBe("editor");
    expect(record?.evaluatorContext?.evaluatorId?.startsWith("anon-")).toBe(true);
    expect(record?.createdAt).toBe("2026-09-05T13:00:00.000Z");
    expect(record?.subject.musicId).toBe("本番の曲A");
  });

  it("B. REJECT is captured only for unapplied candidates in the same apply", () => {
    const session = productionFlow(isolatedStorage(), new Set(["cue-v"]));
    expect(session.events.some((e) => e.action === "REJECT" && e.candidateId === "form-line")).toBe(
      true
    );
    expect(session.events.filter((e) => e.action === "REJECT")).toHaveLength(1);
  });

  it("C. ACCEPT + POSITION_EDIT", () => {
    const storage = isolatedStorage();
    const session = productionFlow(storage, new Set(["cue-v"]));
    observeEditorProjectChange(
      projectWithCandidate({
        dancers: [
          { id: "d1", xPct: 46, yPct: 50 },
          { id: "d2", xPct: 60, yPct: 50 },
        ],
      })
    );
    const reloaded = new HumanFeedbackSession(storage);
    expect(reloaded.events.some((e) => e.action === "ACCEPT")).toBe(true);
    expect(reloaded.events.some((e) => e.action === "POSITION_EDIT")).toBe(true);
    expect(session.origins[0]?.candidateId).toBe("form-v");
  });

  it("D. ACCEPT + FORMATION_EDIT", () => {
    const storage = isolatedStorage();
    productionFlow(storage, new Set(["cue-v"]));
    observeEditorProjectChange(projectWithCandidate({ name: "ARC" }));
    const events = new HumanFeedbackSession(storage).events;
    expect(events.some((e) => e.action === "ACCEPT")).toBe(true);
    expect(events.some((e) => e.action === "FORMATION_EDIT")).toBe(true);
  });

  it("E. ACCEPT + ASSIGNMENT_EDIT", () => {
    const storage = isolatedStorage();
    productionFlow(storage, new Set(["cue-v"]));
    observeEditorProjectChange(
      projectWithCandidate({
        dancers: [
          { id: "d1", xPct: 60, yPct: 50 },
          { id: "d2", xPct: 40, yPct: 50 },
        ],
      })
    );
    const events = new HumanFeedbackSession(storage).events;
    expect(events.some((e) => e.action === "ASSIGNMENT_EDIT")).toBe(true);
  });

  it("F. ACCEPT + SWAP", () => {
    const storage = isolatedStorage();
    productionFlow(storage, new Set(["cue-v"]));
    observeEditorProjectChange(
      projectWithCandidate({
        dancers: [
          { id: "d1", xPct: 60, yPct: 50 },
          { id: "d2", xPct: 40, yPct: 50 },
        ],
      })
    );
    expect(new HumanFeedbackSession(storage).events.some((e) => e.action === "SWAP")).toBe(true);
  });

  it("G. PATH_EDIT", () => {
    const storage = isolatedStorage();
    productionFlow(storage, new Set(["cue-v"]));
    observeEditorProjectChange(
      projectWithCandidate({ dancerCustomPaths: { d1: { cpX: 50, cpY: 72 } } })
    );
    expect(
      new HumanFeedbackSession(storage).events.some((e) => e.action === "PATH_EDIT")
    ).toBe(true);
  });

  it("H. TIMING_EDIT", () => {
    const storage = isolatedStorage();
    productionFlow(storage, new Set(["cue-v"]));
    observeEditorProjectChange(projectWithCandidate({ tStartSec: 10, tEndSec: 16 }));
    expect(
      new HumanFeedbackSession(storage).events.some((e) => e.action === "TIMING_EDIT")
    ).toBe(true);
  });

  it("I. unchanged accepted candidate stays ACCEPT_UNCHANGED", () => {
    const storage = isolatedStorage();
    productionFlow(storage, new Set(["cue-v"]));
    observeEditorProjectChange(projectWithCandidate({}));
    const store = feedbackToEvaluationStore(new HumanFeedbackSession(storage).evaluationRecords);
    const evidence = analyzeRealWorldEvidence({ store });
    expect(evidence.formation.acceptUnchangedCount).toBeGreaterThan(0);
    expect(evidence.formation.acceptEditCount).toBe(0);
  });

  it("J. fixture does not become real evidence", () => {
    const fixture = evaluateReleaseReadiness({
      ...eligibleFixtureBundle(),
      domain: "formation",
      dataSource: "FIXTURE",
      approvedWeightPackage: eligibleFixtureBundle().approval,
      shadow: eligibleFixtureBundle().shadow,
      releasePackage: eligibleFixtureBundle().releasePackage,
      store: eligibleFixtureBundle().store,
    });
    expect(fixture.dataSource).toBe("FIXTURE");
    const real = evaluateProductionReleaseReadiness({ domain: "formation" });
    expect(real.dataSource).toBe("REAL");
    expect(real.review.sampleCount).toBe(0);
    expect(real.status).toBe("NOT_ELIGIBLE");
  });

  it("K. Canary OFF preserves V1", () => {
    const resolved = resolveFormationCanaryWeights({ projectKey: "audit-project" });
    expect(resolved.canaryOff).toBe(true);
    expect(resolved.arm).toBe("V1");
    expect(resolved.formationWeights).toEqual(FORMATION_INTELLIGENCE_WEIGHTS);
    expect(getProductionCanaryActivation()).toBeNull();
    expect(RELEASE_CANARY_ENABLED).toBe(false);
  });

  it("L. duplicate identical history commit is not spammed", () => {
    const storage = isolatedStorage();
    const session = productionFlow(storage, new Set(["cue-v"]));
    const edited = projectWithCandidate({ name: "ARC" });
    session.observeProject(edited, "2026-09-05T13:01:00.000Z");
    const afterFirst = session.events.length;
    session.observeProject(edited, "2026-09-05T13:01:01.000Z");
    expect(session.events).toHaveLength(afterFirst);
  });

  it("M. malformed event does not corrupt the dataset", () => {
    const session = productionFlow(isolatedStorage(), new Set(["cue-v"]));
    const before = session.evaluationRecords.length;
    const broken = importHumanEvaluationDataset(
      JSON.stringify({
        schemaVersion: HUMAN_EVALUATION_VERSION,
        records: [
          ...session.evaluationRecords,
          {
            evaluationId: "broken",
            subject: { kind: "formation", candidateId: "" },
            decision: "accept",
            humanJudgment: "good",
            aiScoreSnapshot: { overall: 0, breakdown: {}, weights: {}, weightsVersion: "" },
            algorithmVersion: "",
            analysisVersion: "",
            scoreWeightsVersion: "",
            createdAt: "2026-09-05T13:02:00.000Z",
          },
        ],
        pairwise: [],
      })
    );
    expect(broken.records.length).toBe(before + 1);
    expect(() => analyzeRealWorldEvidence({ store: broken })).not.toThrow();
    expect(session.evaluationRecords).toHaveLength(before);
  });

  it("N. version mismatch remains safe", () => {
    const store = productionFlow(isolatedStorage(), new Set(["cue-v"])).toEvaluationStore();
    const report = analyzeRealWorldEvidence({
      store,
      expected: { datasetVersion: "other-dataset" },
    });
    expect(report.integrity).toBe("UNAVAILABLE");
    expect(report.readiness.status).toBe("UNAVAILABLE");
  });

  it("O. repeated identical input preserves deterministic downstream analysis", () => {
    const session = productionFlow(isolatedStorage(), new Set(["cue-v"]));
    session.observeProject(
      projectWithCandidate({
        dancers: [
          { id: "d1", xPct: 46, yPct: 50 },
          { id: "d2", xPct: 60, yPct: 50 },
        ],
      }),
      "2026-09-05T13:03:00.000Z"
    );
    const store = session.toEvaluationStore();
    const a = analyzeRealWorldEvidence({ store });
    const b = analyzeRealWorldEvidence({ store });
    expect(a).toEqual(b);
    expect(analyzeDiscrepancy(store).analysisVersion).toBe(
      analyzeDiscrepancy(store).analysisVersion
    );
    const approval = buildWeightApprovalPackage(store, "formation");
    const shadow = evaluateApprovedShadow(store, approval);
    expect(shadow.autoPromoted).toBe(false);
    expect(shadow.evaluations.every((row) => row.counterfactual === "unknown")).toBe(true);
  });

  it("history no-change does not create an edit", () => {
    const origins = new HumanFeedbackSession(isolatedStorage());
    origins.captureSuggestion(suggestionInput(), new Set(["cue-v"]));
    const outcome = captureProjectEditsAgainstOrigins({
      origins: origins.origins,
      project: projectWithCandidate({}),
      createdAt: "2026-09-05T13:04:00.000Z",
    });
    expect(outcome.events).toHaveLength(0);
  });

  it("does not treat fixture readiness as production evidence or change V1", () => {
    const beforeF = { ...FORMATION_INTELLIGENCE_WEIGHTS };
    const beforeT = { ...TRANSITION_SCORE_WEIGHTS };
    const audit = auditProductionInstrumentation();
    expect(audit.canaryOff).toBe(true);
    expect(audit.productionFormationDefault).toBe("V1");
    expect(audit.releaseCanaryEnabled).toBe(false);
    expect(confirmNoAutomaticRelease()).toEqual({
      canReleaseFormationV2: false,
      canaryActivated: false,
    });
    expect(FORMATION_INTELLIGENCE_WEIGHTS).toEqual(beforeF);
    expect(TRANSITION_SCORE_WEIGHTS).toEqual(beforeT);
  });
});
