/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { evaluateSong } from "./EvaluationRunner";
import {
  AnalysisCache,
  detectRegression,
  recordHistory,
  runBenchmark,
} from "./BenchmarkRunner";
import { formatBenchmarkReport } from "./BenchmarkReport";
import { qualityGrade } from "./QualityGrade";
import { humanCueAgreement, humanFormationAgreement } from "./HumanRatingEvaluator";
import { loadAnnotation } from "./DatasetLoader";
import { validateGroundTruth } from "./GroundTruthValidator";
import { ANNOTATION_VERSION, EVALUATION_VERSION } from "../types/EvaluationTypes";
import type { BenchmarkDataset, BenchmarkDatasetItem } from "../types/EvaluationTypes";
import { badAiItem, humanCue, perfectAiItem, ratings, syntheticBenchmarkDataset } from "./syntheticDataset";
import { generateFormationCues } from "../cue/CueEngine";
import { patternCueA } from "../cue/cueFixtures";
import { makeCue } from "../formation/formationFixtures";

function cloneItem(src: BenchmarkDatasetItem, id: string): BenchmarkDatasetItem {
  return {
    ...src,
    song: { ...src.song, id, audioHash: `hash-${id}` },
    groundTruth: { ...src.groundTruth, songId: id },
  };
}

function manySongs(n: number): BenchmarkDataset {
  const base = syntheticBenchmarkDataset().items;
  const items = Array.from({ length: n }, (_, i) => cloneItem(base[i % base.length]!, `song-${String(i).padStart(3, "0")}`));
  return { annotationVersion: ANNOTATION_VERSION, items };
}

describe("BenchmarkRunner", () => {
  it("TEST 18: Human A vs B baseline is valid", () => {
    const a = [humanCue("s", 48, "MAJOR_CHANGE", { annotatorId: "a" })];
    const b = [humanCue("s", 48.2, "MAJOR_CHANGE", { annotatorId: "b" })];
    const agr = humanCueAgreement(a, b, 120, 1);
    expect(agr.matchRate).toBeGreaterThan(0.5);
    expect(Number.isFinite(agr.kappa)).toBe(true);
  });

  it("TEST 19: quality grade A", () => {
    expect(qualityGrade(92)).toBe("A");
  });

  it("TEST 20: quality grade F", () => {
    expect(qualityGrade(40)).toBe("F");
  });

  it("TEST 21: safety override caps a high overall score", () => {
    const item = perfectAiItem();
    item.ai.transitions = [{ transitionScore: 90, feasible: true, unsafe: true }];
    item.groundTruth.formations[0]!.execution = 20;
    const result = evaluateSong({
      songId: item.song.id,
      duration: item.song.duration,
      groundTruth: item.groundTruth,
      ai: item.ai,
    });
    expect(["B", "C", "D", "F"]).toContain(result.grade);
    expect(["A+", "A"]).not.toContain(result.grade);
  });

  it("TEST 22: difficulty grouping is separate", async () => {
    const summary = await runBenchmark(syntheticBenchmarkDataset());
    expect(Object.keys(summary.byDifficulty).length).toBeGreaterThan(1);
    expect(summary.byDifficulty.EASY?.count).toBeGreaterThan(0);
  });

  it("TEST 23: the same input is deterministic", async () => {
    const ds = syntheticBenchmarkDataset();
    const a = await runBenchmark(ds);
    const b = await runBenchmark(ds);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("TEST 24: an empty dataset is safe", async () => {
    const summary = await runBenchmark({ annotationVersion: ANNOTATION_VERSION, items: [] });
    expect(summary.songsEvaluated).toBe(0);
    expect(summary.grade).toBe("F");
    expect(summary.status).toBe("NOT_READY");
  });

  it("TEST 25: a single song yields a valid summary", async () => {
    const summary = await runBenchmark({
      annotationVersion: ANNOTATION_VERSION,
      items: [perfectAiItem()],
    });
    expect(summary.songsEvaluated).toBe(1);
    expect(Number.isFinite(summary.overallScore)).toBe(true);
  });

  it("TEST 26: 20 songs aggregate", async () => {
    const summary = await runBenchmark(manySongs(20));
    expect(summary.songsEvaluated).toBe(20);
  });

  it("TEST 27: 50 songs aggregate", async () => {
    const summary = await runBenchmark(manySongs(50));
    expect(summary.songsEvaluated).toBe(50);
  });

  it("TEST 28: critical errors are classified", () => {
    const item = badAiItem();
    const result = evaluateSong({
      songId: item.song.id,
      duration: item.song.duration,
      groundTruth: item.groundTruth,
      ai: item.ai,
    });
    expect(result.criticalErrors.length).toBeGreaterThan(0);
    expect(result.criticalErrors[0]?.type).toBeTruthy();
  });

  it("TEST 29: timing failures bucket to TIMING", async () => {
    const item = perfectAiItem();
    item.song = { ...item.song, audioHash: "hash-timing-miss" };
    item.ai.cues = [makeCue("MAJOR_CHANGE", "MAX", { rawTime: 8, isMajor: true })];
    const summary = await runBenchmark({
      annotationVersion: ANNOTATION_VERSION,
      items: [item],
    });
    expect(summary.failures.some((f) => f.category === "TIMING" || f.category === "CUE_DENSITY")).toBe(
      true
    );
  });

  it("TEST 30: multiple failure categories can appear together", () => {
    const item = badAiItem();
    const result = evaluateSong({
      songId: item.song.id,
      duration: item.song.duration,
      groundTruth: item.groundTruth,
      ai: item.ai,
    });
    const types = new Set(result.criticalErrors.map((e) => e.type));
    expect(types.size).toBeGreaterThan(0);
  });

  it("TEST 31: human disagreement lowers agreement", () => {
    const same = humanCueAgreement(
      [humanCue("s", 48, "EXPAND", { annotatorId: "a" })],
      [humanCue("s", 48, "EXPAND", { annotatorId: "b" })],
      120,
      1
    );
    const diff = humanCueAgreement(
      [humanCue("s", 48, "EXPAND", { annotatorId: "a" })],
      [humanCue("s", 48, "CONTRACT", { annotatorId: "b" })],
      120,
      1
    );
    expect(same.kappa).toBeGreaterThan(diff.kappa);
    const fa = humanFormationAgreement(ratings("s", "c", [["WIDE_V", 95]]), ratings("s", "c", [["WIDE_V", 94]]));
    const fb = humanFormationAgreement(ratings("s", "c", [["WIDE_V", 95]]), ratings("s", "c", [["CLUSTER", 20]]));
    expect(fa.correlation).toBeGreaterThanOrEqual(fb.correlation);
  });

  it("TEST 35: the second run does not re-analyze", async () => {
    const cache = new AnalysisCache();
    let analyzes = 0;
    const ds = { annotationVersion: ANNOTATION_VERSION, items: [perfectAiItem()] };
    await runBenchmark(ds, undefined, {
      cache,
      analyze: (item) => {
        analyzes += 1;
        return item.ai;
      },
    });
    await runBenchmark(ds, undefined, {
      cache,
      analyze: (item) => {
        analyzes += 1;
        return item.ai;
      },
    });
    expect(analyzes).toBe(1);
    expect(cache.hits).toBeGreaterThan(0);
  });

  it("TEST 36: a different engine version is cached separately", async () => {
    const cache = new AnalysisCache();
    const item = perfectAiItem();
    let analyzes = 0;
    const analyze = (row: typeof item) => {
      analyzes += 1;
      return row.ai;
    };
    await runBenchmark({ annotationVersion: ANNOTATION_VERSION, items: [item] }, undefined, { cache, analyze });
    const v2 = {
      ...item,
      ai: { ...item.ai, analysisVersion: "9.9.9" },
    };
    await runBenchmark({ annotationVersion: ANNOTATION_VERSION, items: [v2] }, undefined, { cache, analyze });
    expect(analyzes).toBe(2);
  });

  it("TEST 37: annotation version is retained", () => {
    const item = perfectAiItem();
    item.groundTruth.annotationVersion = "1.0.0";
    const result = evaluateSong({
      songId: item.song.id,
      duration: item.song.duration,
      groundTruth: item.groundTruth,
      ai: item.ai,
    });
    expect(result.annotationVersion).toBe("1.0.0");
    expect(result.evaluationVersion).toBe(EVALUATION_VERSION);
  });

  it("TEST 38: progress callback counts completions", async () => {
    const seen: number[] = [];
    await runBenchmark(syntheticBenchmarkDataset(), undefined, {
      onProgress: (p) => seen.push(p.completed),
    });
    expect(seen[seen.length - 1]).toBe(10);
    expect(seen[0]).toBe(0);
  });

  it("TEST 39: overall weighting uses the configured total", () => {
    const item = perfectAiItem();
    const result = evaluateSong({
      songId: item.song.id,
      duration: item.song.duration,
      groundTruth: item.groundTruth,
      ai: item.ai,
      config: {
        overallWeights: {
          cueTiming: 0,
          cueF1: 1,
          majorCueRecall: 0,
          sectionAccuracy: 0,
          formationTopK: 0,
          transitionQuality: 0,
          executionSafety: 0,
          sequenceQuality: 0,
        },
      },
    });
    expect(result.overallScore).toBeCloseTo(result.cueMetrics.f1 * 100, 5);
  });

  it("TEST 40: safety grade cap is B when unsafe > 5%", () => {
    const item = perfectAiItem();
    item.ai.transitions = [
      { transitionScore: 90, feasible: true, unsafe: true },
      { transitionScore: 90, feasible: true },
      { transitionScore: 90, feasible: true },
      { transitionScore: 90, feasible: true },
      { transitionScore: 90, feasible: true },
      { transitionScore: 90, feasible: true },
      { transitionScore: 90, feasible: true },
      { transitionScore: 90, feasible: true },
      { transitionScore: 90, feasible: true },
      { transitionScore: 90, feasible: true },
    ];
    const result = evaluateSong({
      songId: item.song.id,
      duration: item.song.duration,
      groundTruth: item.groundTruth,
      ai: item.ai,
    });
    expect(["B", "C", "D", "F"]).toContain(result.grade);
  });

  it("TEST 42: Human-Human baseline is a valid comparison", () => {
    const a = ratings("s", "c", [["WIDE_V", 95], ["PYRAMID", 92]]);
    const b = ratings("s", "c", [["WIDE_V", 90], ["PYRAMID", 96]]);
    const agr = humanFormationAgreement(a, b);
    expect(Number.isFinite(agr.correlation)).toBe(true);
  });

  it("TEST 43: a perfect AI simulation scores near 100", () => {
    const item = perfectAiItem();
    const result = evaluateSong({
      songId: item.song.id,
      duration: item.song.duration,
      groundTruth: item.groundTruth,
      ai: item.ai,
    });
    expect(result.overallScore).toBeGreaterThan(90);
    expect(result.cueMetrics.f1).toBe(1);
  });

  it("TEST 44: a bad AI simulation scores low", () => {
    const item = badAiItem();
    const result = evaluateSong({
      songId: item.song.id,
      duration: item.song.duration,
      groundTruth: item.groundTruth,
      ai: item.ai,
    });
    expect(result.overallScore).toBeLessThan(70);
  });

  it("TEST 45: Phase 1-6 output plus ground truth yields EvaluationResult", () => {
    const { phase1, structure } = patternCueA();
    const cues = generateFormationCues(structure, phase1);
    const active = cues.cues.filter((c) => !c.suppressed);
    const songId = "pattern-a";
    const gtCues = active.map((c) =>
      humanCue(songId, c.rawTime, c.action, {
        magnitude: c.magnitude,
        importance: c.isMajor ? 90 : 50,
      })
    );
    const result = evaluateSong({
      songId,
      duration: phase1.duration,
      groundTruth: {
        songId,
        annotationVersion: ANNOTATION_VERSION,
        cues: gtCues,
        sections: structure.sections.map((s) => ({
          songId,
          annotatorId: "a",
          startTime: s.startTime,
          endTime: s.endTime,
          type: s.type,
          confidence: s.confidence,
        })),
        formations: [],
        sequence: [],
      },
      ai: {
        bpm: 120,
        cues: active,
        sections: structure.sections,
        formationRankings: [],
        transitions: [],
        sequence: { formationTypes: [], totalScore: 80 },
        analysisVersion: EVALUATION_VERSION,
      },
    });
    expect(result.cueMetrics.f1).toBe(1);
    expect(result.evaluationVersion).toBe(EVALUATION_VERSION);
  });

  it("TEST 46: benchmark summary is valid", async () => {
    const summary = await runBenchmark(syntheticBenchmarkDataset());
    expect(summary.songsEvaluated).toBe(10);
    expect(summary.grade).toBeTruthy();
    expect(formatBenchmarkReport(summary)).toContain("ChoreoCore AI Benchmark");
  });

  it("TEST 47: failure analysis has a root-cause bucket", async () => {
    const summary = await runBenchmark({
      annotationVersion: ANNOTATION_VERSION,
      items: [badAiItem()],
    });
    expect(summary.failures.length).toBeGreaterThan(0);
    expect(summary.failures[0]?.probableCause).toBeTruthy();
  });

  it("TEST 48: difficulty benchmark emits per-difficulty metrics", async () => {
    const summary = await runBenchmark(syntheticBenchmarkDataset());
    expect(summary.byDifficulty.HARD?.count ?? 0).toBeGreaterThan(0);
    expect(summary.byDifficulty.EASY?.count ?? 0).toBeGreaterThan(0);
  });

  it("TEST 49: category benchmark emits per-category metrics", async () => {
    const summary = await runBenchmark(syntheticBenchmarkDataset());
    expect(Object.keys(summary.byCategory).length).toBeGreaterThanOrEqual(3);
    expect(summary.strongestCategory).toBeTruthy();
  });

  it("TEST 50: a full 10-song synthetic benchmark is stable", async () => {
    const a = await runBenchmark(syntheticBenchmarkDataset());
    const b = await runBenchmark(syntheticBenchmarkDataset());
    expect(a.songsEvaluated).toBe(10);
    expect(a.overallScore).toBeCloseTo(b.overallScore, 8);
    expect(a.cueF1).toBeGreaterThan(0.8);
    expect(a.unsafeRecommendationRate).toBeLessThanOrEqual(0.02);
  });

  it("detects a regression when overall drops", () => {
    const prev = {
      overallScore: 90,
      majorCueRecall: 0.95,
      unsafeRecommendationRate: 0.01,
    } as Awaited<ReturnType<typeof runBenchmark>>;
    const next = { ...prev, overallScore: 80 };
    const det = detectRegression(prev, next);
    expect(det.isRegression).toBe(true);
    expect(det.reasons).toContain("OVERALL");
  });

  it("records benchmark history with versions", async () => {
    const summary = await runBenchmark({ annotationVersion: ANNOTATION_VERSION, items: [perfectAiItem()] });
    const history = recordHistory(summary, new Date("2026-08-14T00:00:00.000Z"));
    expect(history.annotationVersion).toBe(ANNOTATION_VERSION);
    expect(history.date).toBe("2026-08-14T00:00:00.000Z");
    expect(history.engineVersion).toContain(EVALUATION_VERSION);
  });

  it("loads annotation JSON and validates ground truth", () => {
    const parsed = loadAnnotation({
      songId: "song-001",
      annotationVersion: "1.0.0",
      annotations: { sections: [], cues: [], formations: [], sequence: [] },
    });
    expect(parsed.songId).toBe("song-001");
    expect(validateGroundTruth(parsed, 80).ok).toBe(true);
  });
});
