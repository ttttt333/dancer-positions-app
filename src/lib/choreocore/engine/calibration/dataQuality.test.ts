/** @vitest-environment node */
import { afterEach, describe, expect, it } from "vitest";
import { setMusicEnginePhase12EnabledForTests } from "../audio/musicEngineFlag";
import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { TRANSITION_SCORE_WEIGHTS } from "../movement/transitionIntelligenceConfig";
import { createEmptyProject } from "../../../projectDefaults";
import type { ChoreographyProjectJson, Formation } from "../../../../types/choreography";
import {
  captureEditorSuggestionApply,
  HumanFeedbackSession,
  observeEditorProjectChange,
  resetHumanFeedbackSessionForTests,
} from "./humanFeedbackCapture";
import type { FeedbackStorage } from "./humanFeedbackPersist";
import { HUMAN_EVALUATION_VERSION } from "./humanEvaluationConfig";
import {
  getProductionCanaryActivation,
  resetFormationCanaryForTests,
} from "./formationCanary";
import { RELEASE_CANARY_ENABLED } from "./releaseConfig";
import { eligibleFixtureBundle } from "./releaseDecisionFixtures";
import { feedbackToEvaluationStore } from "./humanFeedbackCapture";
import {
  analyzeProductionDataQuality,
  analyzeRealWorldDataQuality,
} from "./dataQuality";
import { formatRealWorldDataQualityReport } from "./dataQualityReport";
import { DATA_QUALITY_BUFFER_CAPACITY } from "./dataQualityConfig";
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
    createdAt: "2026-09-05T13:20:00.000Z",
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

function projectWithCandidate(name = "V"): ChoreographyProjectJson {
  const base = createEmptyProject();
  const form = formationFrom("form-v", name, [
    { id: "d1", xPct: 40, yPct: 50 },
    { id: "d2", xPct: 60, yPct: 50 },
  ]);
  return {
    ...base,
    pieceTitle: "本番の曲A",
    formations: [form],
    activeFormationId: form.id,
    cues: [{ id: "cue-v", formationId: "form-v", tStartSec: 8, tEndSec: 16 }],
  };
}

function captureInto(storage: FeedbackStorage, accepted: ReadonlySet<string>, input?: CaptureSuggestionInput) {
  resetHumanFeedbackSessionForTests(storage);
  captureEditorSuggestionApply(input ?? suggestionInput(), accepted);
  return new HumanFeedbackSession(storage);
}

afterEach(() => {
  setMusicEnginePhase12EnabledForTests(undefined);
  resetHumanFeedbackSessionForTests();
  resetFormationCanaryForTests();
});

describe("realWorldDataQualityMonitor", () => {
  it("A. Music FLAG OFF still captures Human Feedback", () => {
    setMusicEnginePhase12EnabledForTests(false);
    const session = captureInto(isolatedStorage(), new Set(["cue-v"]));
    const report = analyzeRealWorldDataQuality({
      dataSource: "REAL",
      persisted: {
        schemaVersion: session.events[0] ? "9.0.0-feedback-capture" : "9.0.0-feedback-capture",
        evaluatorId: session.evaluatorId,
        origins: session.origins,
        events: session.events,
        records: session.evaluationRecords,
      },
    });
    expect(report.volume.acceptCount).toBeGreaterThan(0);
  });

  it("B. Music FLAG ON still captures Human Feedback", () => {
    setMusicEnginePhase12EnabledForTests(true);
    const session = captureInto(isolatedStorage(), new Set(["cue-v"]));
    expect(session.events.some((e) => e.action === "ACCEPT")).toBe(true);
  });

  it("C. Valid ACCEPT counted", () => {
    const session = captureInto(isolatedStorage(), new Set(["cue-v"]));
    const report = analyzeRealWorldDataQuality({
      dataSource: "REAL",
      persisted: {
        schemaVersion: "9.0.0-feedback-capture",
        evaluatorId: session.evaluatorId,
        origins: session.origins,
        events: session.events,
        records: session.evaluationRecords,
      },
    });
    expect(report.volume.acceptCount).toBe(1);
    expect(report.observationCoverage.applyOutcomeCount).toBe(2);
  });

  it("D. Valid REJECT counted", () => {
    const session = captureInto(isolatedStorage(), new Set(["cue-v"]));
    const report = analyzeRealWorldDataQuality({
      dataSource: "REAL",
      persisted: {
        schemaVersion: "9.0.0-feedback-capture",
        evaluatorId: session.evaluatorId,
        origins: session.origins,
        events: session.events,
        records: session.evaluationRecords,
      },
    });
    expect(report.volume.rejectCount).toBe(1);
  });

  it("E. ACCEPT + EDIT preserved", () => {
    const storage = isolatedStorage();
    captureInto(storage, new Set(["cue-v"]));
    observeEditorProjectChange(projectWithCandidate("ARC"));
    const session = new HumanFeedbackSession(storage);
    const report = analyzeRealWorldDataQuality({
      dataSource: "REAL",
      persisted: {
        schemaVersion: "9.0.0-feedback-capture",
        evaluatorId: session.evaluatorId,
        origins: session.origins,
        events: session.events,
        records: session.evaluationRecords,
      },
    });
    expect(report.volume.acceptCount).toBe(1);
    expect(report.volume.formationEditCount).toBeGreaterThan(0);
  });

  it("F. Duplicate committed diff is not double-counted", () => {
    const storage = isolatedStorage();
    const session = captureInto(storage, new Set(["cue-v"]));
    const edited = projectWithCandidate("ARC");
    session.observeProject(edited, "2026-09-05T13:21:00.000Z");
    const afterFirst = session.events.length;
    session.observeProject(edited, "2026-09-05T13:21:01.000Z");
    expect(session.events).toHaveLength(afterFirst);
    const report = analyzeRealWorldDataQuality({
      dataSource: "REAL",
      persisted: {
        schemaVersion: "9.0.0-feedback-capture",
        evaluatorId: session.evaluatorId,
        origins: session.origins,
        events: session.events,
        records: session.evaluationRecords,
      },
    });
    expect(report.duplicates.duplicateEventCount).toBe(0);
  });

  it("G. Valid separate edit remains separate", () => {
    const storage = isolatedStorage();
    const session = captureInto(storage, new Set(["cue-v"]));
    session.observeProject(projectWithCandidate("ARC"), "2026-09-05T13:22:00.000Z");
    expect(session.events.some((e) => e.action === "ACCEPT")).toBe(true);
    expect(session.events.some((e) => e.action === "FORMATION_EDIT")).toBe(true);
  });

  it("H. Unknown song detected", () => {
    const session = captureInto(isolatedStorage(), new Set(["cue-v"]), suggestionInput({ musicId: undefined }));
    const report = analyzeRealWorldDataQuality({
      dataSource: "REAL",
      persisted: {
        schemaVersion: "9.0.0-feedback-capture",
        evaluatorId: session.evaluatorId,
        origins: session.origins,
        events: session.events,
        records: session.evaluationRecords,
      },
    });
    expect(report.songIdentity.unknownSongCount).toBeGreaterThan(0);
    expect(report.completeness.missingPieceTitleCount).toBeGreaterThan(0);
    expect(report.warnings).toContain("UNKNOWN_SONG");
  });

  it("I. Missing critical fields detected", () => {
    const session = captureInto(isolatedStorage(), new Set(["cue-v"]));
    const store = feedbackToEvaluationStore(session.evaluationRecords);
    const broken = {
      ...store,
      records: store.records.map((row, i) =>
        i === 0 ? { ...row, subject: { ...row.subject, candidateId: "" } } : row
      ),
    };
    const report = analyzeRealWorldDataQuality({
      dataSource: "REAL",
      store: broken,
      persisted: {
        schemaVersion: "9.0.0-feedback-capture",
        evaluatorId: session.evaluatorId,
        origins: session.origins,
        events: session.events,
        records: broken.records,
      },
    });
    expect(report.completeness.missingCandidateIdCount).toBeGreaterThan(0);
    expect(report.blockers).toContain("MISSING_CANDIDATE_ID");
    expect(report.dimensions.completeness).toBe("BLOCKED");
  });

  it("J. Version mismatch detected", () => {
    const session = captureInto(isolatedStorage(), new Set(["cue-v"]));
    const store = feedbackToEvaluationStore(session.evaluationRecords);
    const broken = {
      ...store,
      records: store.records.map((row, i) =>
        i === 0 ? { ...row, algorithmVersion: "other-algo" } : row
      ),
    };
    const report = analyzeRealWorldDataQuality({
      dataSource: "REAL",
      store: broken,
      persisted: {
        schemaVersion: "9.0.0-feedback-capture",
        evaluatorId: session.evaluatorId,
        origins: session.origins,
        events: session.events,
        records: broken.records,
      },
    });
    expect(report.versions.versionMismatchCount).toBeGreaterThan(0);
    expect(report.blockers).toContain("VERSION_MISMATCH");
    expect(broken.records[0]?.algorithmVersion).not.toBe(HUMAN_EVALUATION_VERSION);
  });

  it("K. Fixture excluded from REAL report", () => {
    const fixtureStore = eligibleFixtureBundle().store;
    const fixture = analyzeRealWorldDataQuality({
      dataSource: "FIXTURE",
      store: fixtureStore,
    });
    expect(fixture.dataSource).toBe("FIXTURE");
    expect(fixture.sources.fixtureCount).toBeGreaterThan(0);
    const real = analyzeProductionDataQuality(isolatedStorage());
    expect(real.dataSource).toBe("REAL");
    expect(real.volume.totalEventCount).toBe(0);
    expect(real.diversity.uniqueSongCount).toBe(0);
    expect(fixture.diversity.uniqueSongCount).toBeGreaterThan(0);
  });

  it("L. Collaborative change path observed", () => {
    const storage = isolatedStorage();
    captureInto(storage, new Set(["cue-v"]));
    observeEditorProjectChange(projectWithCandidate("ARC"));
    const session = new HumanFeedbackSession(storage);
    expect(session.events.some((e) => e.action === "FORMATION_EDIT")).toBe(true);
    const report = analyzeRealWorldDataQuality({
      dataSource: "REAL",
      persisted: {
        schemaVersion: "9.0.0-feedback-capture",
        evaluatorId: session.evaluatorId,
        origins: session.origins,
        events: session.events,
        records: session.evaluationRecords,
      },
    });
    expect(report.collaboration.note).toContain("observeEditorProjectChange");
    expect(report.collaboration.localEditorObservedChanges).toBeGreaterThan(0);
  });

  it("M. Buffer utilization is deterministic", () => {
    const session = captureInto(isolatedStorage(), new Set(["cue-v"]));
    const input = {
      dataSource: "REAL" as const,
      persisted: {
        schemaVersion: "9.0.0-feedback-capture",
        evaluatorId: session.evaluatorId,
        origins: session.origins,
        events: session.events,
        records: session.evaluationRecords,
      },
    };
    const a = analyzeRealWorldDataQuality(input);
    const b = analyzeRealWorldDataQuality(input);
    expect(a).toEqual(b);
    expect(a.buffer.bufferCapacity).toBe(DATA_QUALITY_BUFFER_CAPACITY);
    expect(a.buffer.bufferUtilization).toBe(a.buffer.currentEventCount / DATA_QUALITY_BUFFER_CAPACITY);
    expect(a.buffer.droppedDueToCapacity).toBe(0);
    expect(formatRealWorldDataQualityReport(a)).toBe(formatRealWorldDataQualityReport(b));
  });

  it("N. No Production V2 activation", () => {
    const before = { ...FORMATION_INTELLIGENCE_WEIGHTS };
    analyzeProductionDataQuality(isolatedStorage());
    expect(FORMATION_INTELLIGENCE_WEIGHTS).toEqual(before);
    expect(TRANSITION_SCORE_WEIGHTS).toEqual(TRANSITION_SCORE_WEIGHTS);
  });

  it("O. No Canary activation", () => {
    analyzeProductionDataQuality(isolatedStorage());
    expect(getProductionCanaryActivation()).toBeNull();
    expect(RELEASE_CANARY_ENABLED).toBe(false);
  });

  it("empty real data stays WATCH, not a release signal", () => {
    const report = analyzeProductionDataQuality(isolatedStorage());
    expect(report.status).toBe("WATCH");
    expect(report.volume.totalEventCount).toBe(0);
    expect(report.warnings).toContain("REAL_SAMPLE_COUNT_ZERO");
  });
});
