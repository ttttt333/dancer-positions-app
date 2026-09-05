/** @vitest-environment node */
import { afterEach, describe, expect, it } from "vitest";
import { setMusicEnginePhase12EnabledForTests } from "../audio/musicEngineFlag";
import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { TRANSITION_SCORE_WEIGHTS } from "../movement/transitionIntelligenceConfig";
import { createEmptyProject } from "../../../projectDefaults";
import { applyAiSuggestToProject } from "../../../applyAiSuggestResult";
import type { ChoreographyProjectJson, Cue, Formation } from "../../../../types/choreography";
import { analyzeAiHumanCalibration } from "./aiHumanCalibration";
import { FORMATION_WEIGHTS_VERSION } from "./humanEvaluationConfig";
import { proposeWeightAdjustments } from "./weightProposal";
import {
  captureEditorSuggestionApply,
  captureProjectEditsAgainstOrigins,
  captureSuggestionOutcome,
  feedbackToEvaluationStore,
  HumanFeedbackSession,
  observeEditorProjectChange,
  resetHumanFeedbackSessionForTests,
} from "./humanFeedbackCapture";
import {
  exportHumanFeedbackCsv,
  exportHumanFeedbackJson,
  type FeedbackStorage,
} from "./humanFeedbackPersist";
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
    musicId: "song-demo",
    acceptedCueIds: ["cue-v"],
    createdAt: "2026-09-05T12:00:00.000Z",
    cues: [
      {
        id: "cue-v",
        formationId: "form-v",
        tStartSec: 8,
        tEndSec: 16,
      },
      {
        id: "cue-line",
        formationId: "form-line",
        tStartSec: 16,
        tEndSec: 24,
      },
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
    scoreByFormationId: {
      "form-v": {
        overall: 91,
        breakdown: { visualImpact: 88, movementEfficiency: 70 },
        weights: { ...FORMATION_INTELLIGENCE_WEIGHTS },
        weightsVersion: FORMATION_WEIGHTS_VERSION,
      },
      "form-line": {
        overall: 94,
        breakdown: { visualImpact: 92 },
        weights: { ...FORMATION_INTELLIGENCE_WEIGHTS },
        weightsVersion: FORMATION_WEIGHTS_VERSION,
      },
    },
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

afterEach(() => {
  setMusicEnginePhase12EnabledForTests(undefined);
  resetHumanFeedbackSessionForTests();
});

describe("humanFeedbackCapture", () => {
  it("A. Candidate Acceptance — Accept で Evaluation Record が作られる", () => {
    const { events, records } = captureSuggestionOutcome(
      suggestionInput(),
      new Set(["cue-v"])
    );
    const accept = events.find((e) => e.candidateId === "form-v");
    expect(accept?.kind).toBe("EXPLICIT");
    expect(accept?.action).toBe("ACCEPT");
    expect(records.find((r) => r.subject.candidateId === "form-v")?.decision).toBe(
      "accept"
    );
  });

  it("B. Candidate Edit — 編集すると Edit Signal が記録される", () => {
    const origins = new HumanFeedbackSession(isolatedStorage());
    origins.captureSuggestion(suggestionInput(), new Set(["cue-v"]));
    const outcome = captureProjectEditsAgainstOrigins({
      origins: origins.origins,
      project: projectWithCandidate({
        dancers: [
          { id: "d1", xPct: 46, yPct: 50 },
          { id: "d2", xPct: 60, yPct: 50 },
        ],
      }),
      createdAt: "2026-09-05T12:01:00.000Z",
    });
    expect(outcome.events.some((e) => e.kind === "IMPLICIT" && e.action === "EDIT")).toBe(
      true
    );
    expect(outcome.records[0]?.decision).toBe("edit");
    expect(outcome.records[0]?.editSignal?.positionChanged).toBe(true);
  });

  it("C. Candidate Rejection — Reject が記録され、理由は推測しない", () => {
    const { events, records } = captureSuggestionOutcome(
      suggestionInput(),
      new Set(["cue-v"])
    );
    const reject = events.find((e) => e.candidateId === "form-line");
    expect(reject?.action).toBe("REJECT");
    expect(reject?.kind).toBe("EXPLICIT");
    expect(records.find((r) => r.subject.candidateId === "form-line")?.decision).toBe(
      "reject"
    );
    expect(JSON.stringify(reject)).not.toMatch(/why|reason|bad/i);
  });

  it("D. Formation Edit — formationChanged が正しく記録される", () => {
    const session = new HumanFeedbackSession(isolatedStorage());
    session.captureSuggestion(suggestionInput(), new Set(["cue-v"]));
    const outcome = captureProjectEditsAgainstOrigins({
      origins: session.origins,
      project: projectWithCandidate({ name: "ARC" }),
      createdAt: "2026-09-05T12:02:00.000Z",
    });
    expect(outcome.events.some((e) => e.action === "FORMATION_EDIT")).toBe(true);
    expect(outcome.records[0]?.editSignal?.formationChanged).toBe(true);
    expect(outcome.records[0]?.subject.kind).toBe("formation");
  });

  it("E. Position Edit — positionChanged が正しく記録される", () => {
    const session = new HumanFeedbackSession(isolatedStorage());
    session.captureSuggestion(suggestionInput(), new Set(["cue-v"]));
    const outcome = captureProjectEditsAgainstOrigins({
      origins: session.origins,
      project: projectWithCandidate({
        dancers: [
          { id: "d1", xPct: 40, yPct: 56 },
          { id: "d2", xPct: 60, yPct: 50 },
        ],
      }),
      createdAt: "2026-09-05T12:03:00.000Z",
    });
    expect(outcome.events.some((e) => e.action === "POSITION_EDIT")).toBe(true);
    expect(outcome.records[0]?.editSignal?.positionChanged).toBe(true);
    expect(outcome.records[0]?.editSignal?.formationChanged).toBe(false);
  });

  it("F. Path Edit — pathChanged が transition 層として記録される", () => {
    const session = new HumanFeedbackSession(isolatedStorage());
    session.captureSuggestion(suggestionInput(), new Set(["cue-v"]));
    const outcome = captureProjectEditsAgainstOrigins({
      origins: session.origins,
      project: projectWithCandidate({
        dancerCustomPaths: { d1: { cpX: 50, cpY: 72 } },
      }),
      createdAt: "2026-09-05T12:04:00.000Z",
    });
    expect(outcome.events.some((e) => e.action === "PATH_EDIT" && e.layer === "transition")).toBe(
      true
    );
    expect(outcome.records.every((r) => r.subject.kind === "transition")).toBe(true);
    expect(outcome.records[0]?.editSignal?.pathChanged).toBe(true);
    expect(outcome.records[0]?.editSignal?.formationChanged).toBe(false);
  });

  it("G. Timing Edit — timingChanged が transition 層として記録される", () => {
    const session = new HumanFeedbackSession(isolatedStorage());
    session.captureSuggestion(suggestionInput(), new Set(["cue-v"]));
    const outcome = captureProjectEditsAgainstOrigins({
      origins: session.origins,
      project: projectWithCandidate({ tStartSec: 10, tEndSec: 16 }),
      createdAt: "2026-09-05T12:05:00.000Z",
    });
    expect(outcome.events.some((e) => e.action === "TIMING_EDIT" && e.layer === "transition")).toBe(
      true
    );
    expect(outcome.records[0]?.editSignal?.timingChanged).toBe(true);
    expect(outcome.records[0]?.subject.kind).toBe("transition");
  });

  it("H. Snapshot — AI Score / Version が評価時点で保存される", () => {
    const { records } = captureSuggestionOutcome(suggestionInput(), new Set(["cue-v"]));
    const accepted = records.find((r) => r.subject.candidateId === "form-v")!;
    expect(accepted.aiScoreSnapshot.overall).toBe(91);
    expect(accepted.aiScoreSnapshot.weightsVersion).toBe(FORMATION_WEIGHTS_VERSION);
    expect(accepted.scoreWeightsVersion).toBe(FORMATION_WEIGHTS_VERSION);
    expect(accepted.intentVersion).toBeTruthy();
    expect(accepted.candidateVersion).toBeTruthy();
    expect(accepted.transitionVersion).toBeTruthy();
  });

  it("I. Identity — 同一 Candidate を Accept 後の Edit でも追跡できる", () => {
    const session = new HumanFeedbackSession(isolatedStorage());
    session.captureSuggestion(suggestionInput(), new Set(["cue-v"]));
    session.observeProject(
      projectWithCandidate({ name: "ARC" }),
      "2026-09-05T12:06:00.000Z"
    );
    const related = session.events.filter((e) => e.candidateId === "form-v");
    expect(related.some((e) => e.action === "ACCEPT")).toBe(true);
    expect(related.some((e) => e.action === "EDIT")).toBe(true);
    expect(new Set(related.map((e) => e.candidateId))).toEqual(new Set(["form-v"]));
  });

  it("J. No Auto Learning — 評価後に production weights が変わらない", () => {
    const beforeFormation = { ...FORMATION_INTELLIGENCE_WEIGHTS };
    const beforeTransition = { ...TRANSITION_SCORE_WEIGHTS };
    const session = new HumanFeedbackSession(isolatedStorage());
    session.captureSuggestion(suggestionInput(), new Set(["cue-v"]));
    session.observeProject(
      projectWithCandidate({
        dancers: [
          { id: "d1", xPct: 48, yPct: 50 },
          { id: "d2", xPct: 60, yPct: 50 },
        ],
      }),
      "2026-09-05T12:07:00.000Z"
    );
    const proposal = proposeWeightAdjustments(session.toEvaluationStore(), "formation");
    expect(proposal.autoApplied).toBe(false);
    expect(FORMATION_INTELLIGENCE_WEIGHTS).toEqual(beforeFormation);
    expect(TRANSITION_SCORE_WEIGHTS).toEqual(beforeTransition);
  });

  it("K. Production Isolation — 評価データは Production Formation を書き換えない", () => {
    const project = projectWithCandidate({ name: "V" });
    const before = JSON.stringify(project);
    const session = new HumanFeedbackSession(isolatedStorage());
    session.captureSuggestion(suggestionInput(), new Set(["cue-v"]));
    session.observeProject(project, "2026-09-05T12:08:00.000Z");
    expect(JSON.stringify(project)).toBe(before);
    expect(project.formations[0]!.name).toBe("V");
    expect(JSON.stringify(project)).not.toContain("humanFeedback");
    const applied = applyAiSuggestToProject(
      project,
      {
        formations: [
          formationFrom("ai-new", "NEW", [
            { id: "d1", xPct: 10, yPct: 10 },
            { id: "d2", xPct: 90, yPct: 10 },
          ]),
        ],
        cues: [{ id: "ai-c", formationId: "ai-new", tStartSec: 0, tEndSec: 4 }],
      },
      "replace"
    );
    expect(applied.formations.find((f) => f.id === "form-v")?.name).toBe("V");
    expect(session.events.some((e) => e.action === "ACCEPT")).toBe(true);
  });

  it("L. Persistence — reload 後も評価データが保持される", () => {
    const storage = isolatedStorage();
    const first = new HumanFeedbackSession(storage);
    first.captureSuggestion(suggestionInput(), new Set(["cue-v"]));
    first.observeProject(
      projectWithCandidate({ name: "ARC" }),
      "2026-09-05T12:09:00.000Z"
    );
    const eventCount = first.events.length;
    const recordCount = first.evaluationRecords.length;
    const evaluatorId = first.evaluatorId;
    const reloaded = new HumanFeedbackSession(storage);
    expect(reloaded.evaluatorId).toBe(evaluatorId);
    expect(reloaded.evaluatorId.startsWith("anon-")).toBe(true);
    expect(reloaded.events).toHaveLength(eventCount);
    expect(reloaded.evaluationRecords).toHaveLength(recordCount);
    expect(reloaded.origins.some((o) => o.candidateId === "form-v")).toBe(true);
  });

  it("separates formation and transition edits, and does not spam identical commits", () => {
    const session = new HumanFeedbackSession(isolatedStorage());
    session.captureSuggestion(suggestionInput(), new Set(["cue-v"]));
    const edited = projectWithCandidate({
      name: "ARC",
      tStartSec: 11,
      tEndSec: 16,
    });
    session.observeProject(edited, "2026-09-05T12:10:00.000Z");
    const afterFirst = session.events.length;
    session.observeProject(edited, "2026-09-05T12:10:01.000Z");
    expect(session.events).toHaveLength(afterFirst);
    const layers = session.evaluationRecords
      .filter((r) => r.decision === "edit")
      .map((r) => r.subject.kind);
    expect(layers).toEqual(expect.arrayContaining(["formation", "transition"]));
  });

  it("keeps Accept-unchanged distinct from Accept-then-Edit", () => {
    const session = new HumanFeedbackSession(isolatedStorage());
    session.captureSuggestion(suggestionInput(), new Set(["cue-v"]));
    const accepted = session.evaluationRecords.find((r) => r.decision === "accept")!;
    expect(accepted.editSignal).toBeUndefined();
    session.observeProject(
      projectWithCandidate({
        dancers: [
          { id: "d1", xPct: 40, yPct: 58 },
          { id: "d2", xPct: 60, yPct: 50 },
        ],
      }),
      "2026-09-05T12:11:00.000Z"
    );
    expect(session.evaluationRecords.some((r) => r.decision === "edit")).toBe(true);
  });

  it("records assignment swap without inferring the candidate was bad", () => {
    const session = new HumanFeedbackSession(isolatedStorage());
    session.captureSuggestion(suggestionInput(), new Set(["cue-v"]));
    const outcome = captureProjectEditsAgainstOrigins({
      origins: session.origins,
      project: projectWithCandidate({
        dancers: [
          { id: "d1", xPct: 60, yPct: 50 },
          { id: "d2", xPct: 40, yPct: 50 },
        ],
      }),
      createdAt: "2026-09-05T12:12:00.000Z",
    });
    expect(outcome.events.some((e) => e.action === "SWAP")).toBe(true);
    expect(outcome.records[0]?.editSignal?.assignmentChanged).toBe(true);
    expect(outcome.records[0]?.decision).toBe("edit");
    expect(outcome.records[0]?.decision).not.toBe("reject");
  });

  it("feeds Stage 8 calibration without applying weights, and can export", () => {
    const session = new HumanFeedbackSession(isolatedStorage());
    session.captureSuggestion(suggestionInput(), new Set(["cue-v"]));
    const store = feedbackToEvaluationStore(session.evaluationRecords);
    const report = analyzeAiHumanCalibration(store);
    expect(report.autoApplied).toBe(false);
    const json = exportHumanFeedbackJson({
      schemaVersion: "9.0.0-feedback-capture",
      evaluatorId: session.evaluatorId,
      origins: session.origins,
      events: session.events,
      records: session.evaluationRecords,
    });
    const csv = exportHumanFeedbackCsv({
      schemaVersion: "9.0.0-feedback-capture",
      evaluatorId: session.evaluatorId,
      origins: session.origins,
      events: session.events,
      records: session.evaluationRecords,
    });
    expect(json).toContain("form-v");
    expect(csv).toContain("ACCEPT");
    expect(csv).toContain("REJECT");
  });

  it("Music FLAG OFF でも Editor 観測は動く（Feedback は独立）", () => {
    const storage = isolatedStorage();
    resetHumanFeedbackSessionForTests(storage);
    setMusicEnginePhase12EnabledForTests(false);
    captureEditorSuggestionApply(suggestionInput(), new Set(["cue-v"]));
    observeEditorProjectChange(projectWithCandidate({ name: "ARC" }));
    const session = new HumanFeedbackSession(storage);
    expect(session.events.some((e) => e.action === "ACCEPT")).toBe(true);
    expect(session.events.some((e) => e.action === "FORMATION_EDIT")).toBe(true);
  });

  it("supports multiple evaluators on the same candidate identity", () => {
    const a = new HumanFeedbackSession(isolatedStorage());
    const b = new HumanFeedbackSession(isolatedStorage());
    a.captureSuggestion(suggestionInput(), new Set(["cue-v"]));
    b.captureSuggestion(suggestionInput(), new Set([]));
    expect(a.evaluatorId).not.toBe(b.evaluatorId);
    expect(a.events[0]?.candidateId).toBe(b.events[0]?.candidateId);
    expect(a.events[0]?.action).toBe("ACCEPT");
    expect(b.events[0]?.action).toBe("REJECT");
  });
});
