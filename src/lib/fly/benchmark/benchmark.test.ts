import { describe, expect, it } from "vitest";
import {
  evidenceConfidenceFromSampleCount,
  parseGroundTruthSong,
  runFlyBenchmark,
  scoreBeats,
  scoreEightCounts,
  scoreSections,
  scoreTempo,
  scoreAnalyzerAgreement,
  buildReliabilityProfiles,
  matchTimesGreedy,
} from "./index";
import { loadFlyBenchmarkGoldenDataset } from "../../../../fixtures/fly/benchmark/dataset";

describe("FLY Benchmark Phase 4.5 — metrics", () => {
  it("tempo handles half/double as class-correct, not total error", () => {
    const half = scoreTempo(100, 50);
    expect(half.status).toBe("OK");
    expect(half.equivalenceRatio).toBe(0.5);
    expect(half.tempoClassError).toBe(false);

    const dbl = scoreTempo(100, 200);
    expect(dbl.equivalenceRatio).toBe(2);
    expect(dbl.tempoClassError).toBe(false);

    const wrong = scoreTempo(100, 140);
    expect(wrong.tempoClassError).toBe(true);
    expect(wrong.absoluteErrorBpm).toBe(40);
  });

  it("tempo NOT_AVAILABLE / EMPTY / 0 bpm edges", () => {
    expect(scoreTempo(null, 120).status).toBe("NOT_AVAILABLE");
    expect(scoreTempo(120, null).status).toBe("EMPTY");
    expect(scoreTempo(0, 120).status).toBe("NOT_AVAILABLE");
  });

  it("beat F1 with tolerances and empty arrays", () => {
    const ref = [0, 0.5, 1.0, 1.5];
    const hyp = [0.01, 0.51, 1.02]; // missing last
    const m = scoreBeats(ref, hyp);
    expect(m.status).toBe("OK");
    expect(m.byThreshold["40"]!.f1).toBeGreaterThan(0.5);
    expect(scoreBeats([], []).status).toBe("EMPTY");
    expect(scoreBeats(null, [0]).status).toBe("NOT_AVAILABLE");
  });

  it("matchTimesGreedy is deterministic", () => {
    const a = matchTimesGreedy([1, 2, 3], [1.01, 2.02], 0.05);
    const b = matchTimesGreedy([1, 2, 3], [1.01, 2.02], 0.05);
    expect(a).toEqual(b);
    expect(a.length).toBe(2);
  });

  it("section IoU works with different section counts", () => {
    const ref = [
      { startTime: 0, endTime: 8, label: "INTRO" },
      { startTime: 8, endTime: 16, label: "CHORUS" },
    ];
    const hyp = [{ startTime: 0.2, endTime: 16, label: "CHORUS" }];
    const s = scoreSections(ref, hyp);
    expect(s.status).toBe("OK");
    expect(s.nRef).toBe(2);
    expect(s.nHyp).toBe(1);
    expect(s.meanIoU).toBeGreaterThan(0);
  });

  it("overlapping / zero-duration flagged by parser", () => {
    const bad = parseGroundTruthSong({
      songId: "x",
      audioHash: "h",
      durationSeconds: 10,
      genre: "pop",
      tempoCategory: "medium",
      datasetVersion: "1.0.0",
      groundTruthVersion: "1.0.0",
      conditions: { genre: "pop", tempoCategory: "medium" },
      bpm: 120,
      sections: [
        {
          startTime: 0,
          endTime: 0,
          label: "INTRO",
          confidence: 1,
          annotatorId: "a",
          annotationVersion: "1",
        },
      ],
      beats: [],
    });
    expect(bad.ok).toBe(false);
  });

  it("eight-count detects off-by-one-count tendency", () => {
    const ref = [
      { startTime: 0, endTime: 4 },
      { startTime: 4, endTime: 8 },
    ];
    const hyp = [
      { startTime: 0.5, endTime: 4.5 }, // ~1 beat at 120bpm
      { startTime: 4.5, endTime: 8.5 },
    ];
    const m = scoreEightCounts(ref, hyp, 0.5);
    expect(m.status).toBe("OK");
    expect(m.offByOneCountRate).toBeGreaterThan(0);
  });

  it("evidence confidence bands", () => {
    expect(evidenceConfidenceFromSampleCount(0)).toBe("NONE");
    expect(evidenceConfidenceFromSampleCount(3)).toBe("LOW");
    expect(evidenceConfidenceFromSampleCount(10)).toBe("MEDIUM");
    expect(evidenceConfidenceFromSampleCount(30)).toBe("HIGH");
  });

  it("agreement is not treated as accuracy (separate API)", () => {
    const a = {
      analyzerId: "librosa",
      analyzerVersion: "v1",
      bpm: 120,
      beats: [0, 0.5, 1],
      sections: [{ startTime: 0, endTime: 8, label: "INTRO" }],
    };
    const b = {
      analyzerId: "essentia",
      analyzerVersion: "v1",
      bpm: 120,
      beats: [0.01, 0.51, 1.01],
      sections: [{ startTime: 0, endTime: 8, label: "INTRO" }],
    };
    const agr = scoreAnalyzerAgreement("s", a, b);
    expect(agr.note).toBe("agreement_is_not_accuracy");
    expect(agr.tempoAgreement).toBe(1);
  });
});

describe("FLY Benchmark Phase 4.5 — runner + golden fixtures", () => {
  it("runs deterministically on golden dataset", () => {
    const dataset = loadFlyBenchmarkGoldenDataset();
    expect(dataset.length).toBe(5);
    const a = runFlyBenchmark({ dataset });
    const b = runFlyBenchmark({ dataset });
    expect(a.reports.json).toBe(b.reports.json);
    expect(a.songResults.length).toBe(10); // 5 songs × 2 analyzers
    expect(a.profiles.length).toBeGreaterThan(0);
    expect(a.reports.markdown).toContain("Reliability profiles");
    // half-time librosa on complex should be class-correct
    const complexLib = a.songResults.find(
      (r) => r.songId === "gt-complex" && r.analyzerId === "librosa"
    );
    expect(complexLib?.metrics.tempo.equivalenceRatio).toBe(0.5);
    expect(complexLib?.metrics.tempo.tempoClassError).toBe(false);
  });

  it("profiles carry sampleCount and evidenceConfidence (no invented scores)", () => {
    const out = runFlyBenchmark({
      dataset: loadFlyBenchmarkGoldenDataset(),
    });
    const profiles = buildReliabilityProfiles(out.songResults);
    expect(profiles.every((p) => p.sampleCount >= 1)).toBe(true);
    const lowOrBetter = profiles.every(
      (p) =>
        p.evidenceConfidence === "LOW" ||
        p.evidenceConfidence === "MEDIUM" ||
        p.evidenceConfidence === "HIGH"
    );
    expect(lowOrBetter).toBe(true);
    // With only 5 songs, "all" beat profiles should still be LOW evidence
    const allBeat = profiles.find(
      (p) =>
        p.analyzerId === "essentia" &&
        p.signalType === "beat" &&
        p.condition === "all"
    );
    expect(allBeat?.evidenceConfidence).toBe("LOW");
  });

  it("downbeat / event NOT_AVAILABLE when GT missing", () => {
    const out = runFlyBenchmark({
      dataset: loadFlyBenchmarkGoldenDataset(),
    });
    const hip = out.songResults.find(
      (r) => r.songId === "gt-hiphop" && r.analyzerId === "librosa"
    );
    expect(hip?.metrics.event.status).toBe("NOT_AVAILABLE");
    expect(hip?.metrics.onset.status).toBe("NOT_AVAILABLE");
  });
});

describe("FLY Benchmark Phase 4.5 — production isolation", () => {
  it("does not change Formation / Structure contracts (smoke)", async () => {
    const { fuseToStructureV2 } = await import("../fusion");
    const v2 = fuseToStructureV2({
      structureV2: {
        bpm: 120,
        duration: 8,
        eight_times: [0, 4],
        sections: [],
        change_points: [],
        source: "test",
        beats: [0, 0.5, 1, 1.5],
      },
    });
    expect(v2.bpm).toBe(120);
  });
});
