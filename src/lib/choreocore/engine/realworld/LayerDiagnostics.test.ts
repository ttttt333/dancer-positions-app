/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { attributeErrors, layerFromRootCause } from "./ErrorAttribution";
import { layerScoresFromResult, meanLayerScores, strongestLayer, weakestLayer } from "./LayerDiagnostics";
import { evaluateSong } from "../evaluation/EvaluationRunner";
import { realWorldPilotDataset } from "./pilotDataset";
import { makeCue } from "../formation/formationFixtures";
import { ANNOTATION_VERSION } from "../types/EvaluationTypes";
import { generateTuningRecommendations } from "./TuningRecommendations";

describe("Layer diagnostics", () => {
  it("TEST 07: layer diagnostics are 0-100", () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const item = dataset.items[0]!;
    const ann = annotations.find((a) => a.songId === item.song.id)!;
    const result = evaluateSong({
      songId: item.song.id,
      duration: item.song.duration,
      groundTruth: {
        songId: item.song.id,
        annotationVersion: ANNOTATION_VERSION,
        sections: ann.sections,
        cues: ann.cues,
        formations: ann.formations,
        sequence: ann.sequence,
      },
      ai: item.ai,
    });
    const layers = layerScoresFromResult(result);
    for (const v of Object.values(layers)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("TEST 08: root cause is classified", () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const item = dataset.items.find((i) => i.song.id === "real-003")!;
    const ann = annotations.find((a) => a.songId === "real-003" && a.annotatorId === "annotator-a")!;
    const result = evaluateSong({
      songId: item.song.id,
      duration: item.song.duration,
      groundTruth: {
        songId: item.song.id,
        annotationVersion: ANNOTATION_VERSION,
        sections: ann.sections,
        cues: ann.cues,
        formations: ann.formations,
        sequence: ann.sequence,
      },
      ai: item.ai,
    });
    const findings = attributeErrors(result, item.ai, ann.formations, ann.cues.map((c) => c.time));
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.rootCause).toBeTruthy();
  });

  it("TEST 09: severity includes CRITICAL for unsafe", () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const item = dataset.items[0]!;
    const ann = annotations.find((a) => a.songId === item.song.id)!;
    item.ai.transitions = [{ transitionScore: 90, feasible: true, unsafe: true }];
    ann.formations[0]!.execution = 10;
    const result = evaluateSong({
      songId: item.song.id,
      duration: item.song.duration,
      groundTruth: {
        songId: item.song.id,
        annotationVersion: ANNOTATION_VERSION,
        sections: ann.sections,
        cues: ann.cues,
        formations: ann.formations,
        sequence: ann.sequence,
      },
      ai: item.ai,
    });
    const findings = attributeErrors(result, item.ai, ann.formations);
    expect(findings.some((f) => f.severity === "CRITICAL" && f.rootCause === "UNSAFE_MOVEMENT")).toBe(true);
  });

  it("TEST 35: Phase 2 diagnostic on section mismatch", () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const item = dataset.items[0]!;
    const ann = annotations.find((a) => a.songId === item.song.id)!;
    item.ai.sections = item.ai.sections.map((s) => ({ ...s, type: "VERSE" as const, startTime: s.startTime + 2 }));
    const result = evaluateSong({
      songId: item.song.id,
      duration: item.song.duration,
      groundTruth: {
        songId: item.song.id,
        annotationVersion: ANNOTATION_VERSION,
        sections: ann.sections,
        cues: ann.cues,
        formations: ann.formations,
        sequence: ann.sequence,
      },
      ai: item.ai,
    });
    const findings = attributeErrors(result, item.ai, ann.formations);
    expect(findings.some((f) => f.failedAt === "PHASE_2_STRUCTURE")).toBe(true);
  });

  it("TEST 36: Phase 3 diagnostic on cue miss", () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const item = dataset.items[0]!;
    const ann = annotations.find((a) => a.songId === item.song.id)!;
    item.ai.cues = [makeCue("MICRO_SHIFT", "SMALL", { rawTime: 1, isMajor: false })];
    const result = evaluateSong({
      songId: item.song.id,
      duration: item.song.duration,
      groundTruth: {
        songId: item.song.id,
        annotationVersion: ANNOTATION_VERSION,
        sections: ann.sections,
        cues: ann.cues,
        formations: ann.formations,
        sequence: ann.sequence,
      },
      ai: item.ai,
    });
    expect(attributeErrors(result, item.ai, ann.formations).some((f) => f.failedAt === "PHASE_3_CUE")).toBe(true);
  });

  it("TEST 37: Phase 4 diagnostic on formation mismatch", () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const item = dataset.items[0]!;
    const ann = annotations.find((a) => a.songId === item.song.id)!;
    item.ai.formationRankings = [
      { formationType: "GRID", score: 99 },
      { formationType: "CLUSTER", score: 10 },
    ];
    const result = evaluateSong({
      songId: item.song.id,
      duration: item.song.duration,
      groundTruth: {
        songId: item.song.id,
        annotationVersion: ANNOTATION_VERSION,
        sections: ann.sections,
        cues: ann.cues,
        formations: ann.formations,
        sequence: ann.sequence,
      },
      ai: item.ai,
    });
    const findings = attributeErrors(result, item.ai, ann.formations);
    expect(findings.some((f) => f.failedAt === "PHASE_4_FORMATION")).toBe(true);
    expect(layerFromRootCause("MUSIC_FIT")).toBe("PHASE_4_FORMATION");
  });

  it("TEST 38: Phase 5 diagnostic", () => {
    expect(layerFromRootCause("UNSAFE_MOVEMENT")).toBe("PHASE_5_MOVEMENT");
    expect(layerFromRootCause("TRANSITION")).toBe("PHASE_5_MOVEMENT");
  });

  it("TEST 39: Phase 6 diagnostic", () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const item = dataset.items[0]!;
    const ann = annotations.find((a) => a.songId === item.song.id)!;
    item.ai.sequence = { formationTypes: ["GRID"], totalScore: 20 };
    const result = evaluateSong({
      songId: item.song.id,
      duration: item.song.duration,
      groundTruth: {
        songId: item.song.id,
        annotationVersion: ANNOTATION_VERSION,
        sections: ann.sections,
        cues: ann.cues,
        formations: ann.formations,
        sequence: ann.sequence,
      },
      ai: item.ai,
    });
    expect(attributeErrors(result, item.ai, ann.formations).some((f) => f.failedAt === "PHASE_6_SEQUENCE")).toBe(true);
  });

  it("TEST 40: safety critical", () => {
    expect(layerFromRootCause("UNSAFE_MOVEMENT")).toBe("PHASE_5_MOVEMENT");
  });

  it("TEST 41: critical timing on a severe miss", () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const item = dataset.items[0]!;
    const ann = annotations.find((a) => a.songId === item.song.id)!;
    item.ai.cues = [makeCue("MAJOR_CHANGE", "MAX", { rawTime: ann.cues[0]!.time + 2, isMajor: true, priority: 90 })];
    const result = evaluateSong({
      songId: item.song.id,
      duration: item.song.duration,
      groundTruth: {
        songId: item.song.id,
        annotationVersion: ANNOTATION_VERSION,
        sections: ann.sections,
        cues: ann.cues,
        formations: ann.formations,
        sequence: ann.sequence,
      },
      ai: item.ai,
      config: { matchingBeats: 8 },
    });
    const findings = attributeErrors(result, item.ai, ann.formations, ann.cues.map((c) => c.time));
    expect(findings.some((f) => f.rootCause === "BAR_SNAPPING_TOO_AGGRESSIVE" || f.timingError === 2)).toBe(true);
  });

  it("weakest/strongest layer are deterministic", () => {
    const layers = meanLayerScores([]);
    expect(weakestLayer(layers)).toBe("phase1Audio");
    expect(strongestLayer(layers)).toBe("phase1Audio");
    const recs = generateTuningRecommendations(layers, {});
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(3);
  });
});
