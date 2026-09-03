import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../../projectDefaults";
import type { Cue, Formation } from "../../../types/choreography";
import {
  extraSongCardFromProject,
  inferFormationTypeFromName,
  isChoreographyProjectJson,
  projectToAnnotationSession,
} from "./projectToAnnotation";
import {
  peaksFromAnnotatedSections,
  runQualityGatesForSong,
  scoreAiAgainstProject,
  scoreAiAgainstSessions,
} from "./realSongQualityGate";
import { makeSession } from "../engine/annotation/annotationFixtures";
import type { AiEvaluationOutput } from "../engine/types/EvaluationTypes";
import { ANALYSIS_VERSION } from "../engine/constants";

function formation(id: string, name: string, dancerIds: string[]): Formation {
  return {
    id,
    name,
    dancers: dancerIds.map((did, i) => ({
      id: did,
      label: String(i + 1),
      xPct: 20 + i * 15,
      yPct: 50,
      colorIndex: i,
    })),
  };
}

function cue(id: string, formationId: string, t0: number, t1: number, name?: string): Cue {
  return { id, formationId, tStartSec: t0, tEndSec: t1, name };
}

describe("projectToAnnotationSession", () => {
  it("keeps dancer ids in layout and infers types from names", () => {
    expect(inferFormationTypeFromName("サビ · V字")).toBe("V");
    const base = createEmptyProject();
    const f1 = formation("f-line", "横一列", ["keep-a", "keep-b"]);
    const f2 = formation("f-v", "サビ · V字", ["keep-a", "keep-b"]);
    const project = {
      ...base,
      pieceTitle: "実曲テスト",
      formations: [f1, f2],
      cues: [
        cue("c1", "f-line", 0, 16, "Aメロ"),
        cue("c2", "f-v", 16, 32, "サビ"),
      ],
      trimEndSec: 32,
    };
    expect(isChoreographyProjectJson(project)).toBe(true);
    const session = projectToAnnotationSession(project, {
      annotatorId: "choreographer-a",
    });
    expect(session.songId).toBe("proj-実曲テスト");
    expect(session.cues.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(session.formations[1]?.formationType).toBe("V");
    expect(session.formations[0]?.layout?.positions.map((p) => p.id)).toEqual([
      "keep-a",
      "keep-b",
    ]);
    expect(extraSongCardFromProject(project).id).toBe("proj-実曲テスト");
  });
});

describe("peaksFromAnnotatedSections", () => {
  it("raises energy in chorus", () => {
    const peaks = peaksFromAnnotatedSections(32, [
      {
        songId: "s",
        annotatorId: "a",
        startTime: 0,
        endTime: 16,
        type: "VERSE",
        confidence: 1,
      },
      {
        songId: "s",
        annotatorId: "a",
        startTime: 16,
        endTime: 32,
        type: "CHORUS",
        confidence: 1,
      },
    ]);
    const midVerse = peaks[Math.floor(peaks.length * 0.2)]!;
    const midChorus = peaks[Math.floor(peaks.length * 0.7)]!;
    expect(midChorus).toBeGreaterThan(midVerse);
  });
});

function matchingAi(session: ReturnType<typeof makeSession>): AiEvaluationOutput {
  return {
    bpm: session.bpm,
    cues: session.cues.map((c, i) => ({
      id: c.id ?? `ai-${i}`,
      rawTime: c.time,
      beatTime: null,
      barTime: null,
      action: c.action,
      magnitude: c.magnitude,
      priority: 80,
      confidence: 0.9,
      reasonCodes: [],
      sourceEventClusterId: "e",
      sourceChangePointIds: [],
      energyBefore: 40,
      energyAfter: 80,
      deltaEnergy: 40,
      isMajor: c.importance >= 90,
      isLocked: false,
      suppressed: false,
    })),
    sections: session.sections.map((s, i) => ({
      id: `sec-${i}`,
      type: s.type,
      startTime: s.startTime,
      endTime: s.endTime,
      startBar: 0,
      endBar: 4,
      barCount: 4,
      energyMean: 50,
      energyPeak: 70,
      energyDelta: 10,
      rhythmicDensity: 0.5,
      spectralProfile: { bass: 0.2, lowMid: 0.2, mid: 0.2, highMid: 0.2, high: 0.2 },
      confidence: 0.9,
    })),
    formationRankings: session.formations.map((f) => ({
      cueId: f.cueId,
      formationType: f.formationType,
      score: f.score,
    })),
    transitions: session.formations.map((f) => ({
      cueId: f.cueId,
      formationType: f.formationType,
      transitionScore: 80,
      feasible: true,
      unsafe: false,
    })),
    sequence: {
      formationTypes: session.sequence[0]?.formationIds ?? session.formations.map((f) => f.formationType),
      totalScore: 80,
    },
    analysisVersion: ANALYSIS_VERSION,
  };
}

describe("scoreAiAgainstSessions", () => {
  it("passes cue F1 when AI times match the annotation", () => {
    const session = makeSession({ songId: "real-song", annotatorId: "a" });
    const report = scoreAiAgainstSessions([session], matchingAi(session));
    expect(report.songId).toBe("real-song");
    expect(report.annotatorCount).toBe(1);
    expect(report.ceilingEstimated).toBe(true);
    const cueF1 = report.gates.find((g) => g.id === "cueF1");
    expect(cueF1?.verdict).toBe("PASS");
    expect(report.overall === "PASS" || report.overall === "WATCH" || report.overall === "FAIL").toBe(
      true
    );
  });
});

describe("scoreAiAgainstProject", () => {
  it("returns null when the project has no cues", () => {
    expect(scoreAiAgainstProject(createEmptyProject(), matchingAi(makeSession({ songId: "x", annotatorId: "a" })))).toBeNull();
  });
});

describe("runQualityGatesForSong", () => {
  it("runs the live engine against a real-song annotation", () => {
    const session = makeSession({ songId: "live-gate", annotatorId: "a", cueTime: 16 });
    const report = runQualityGatesForSong({ sessions: [session] });
    expect(report.gates).toHaveLength(8);
    expect(report.evaluation.cueMetrics.f1).toBeGreaterThanOrEqual(0);
  });
});
