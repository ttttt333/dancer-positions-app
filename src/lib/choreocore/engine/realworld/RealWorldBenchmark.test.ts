/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { runRealWorldBenchmark, compareBenchmarkRuns } from "./RealWorldBenchmark";
import { formatRealWorldReport } from "./RealWorldReport";
import { clonePilotSongs, realWorldPilotDataset } from "./pilotDataset";
import { generateFailureMatrix, strongestBucket, weakestBucket } from "./FailureMatrix";
import { ANNOTATION_VERSION } from "../types/EvaluationTypes";
import { REALWORLD_VERSION } from "../types/RealWorldTypes";
import { detectRegression } from "../evaluation/BenchmarkRunner";

describe("RealWorldBenchmark", () => {
  it("TEST 17: category breakdown", async () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const result = await runRealWorldBenchmark(dataset, annotations);
    expect(Object.keys(result.categoryBreakdown).length).toBe(5);
    expect(result.categoryBreakdown.ENERGY_DRIVEN?.count).toBe(2);
    expect(result.categoryBreakdown.MINIMAL_STABLE?.count).toBe(2);
  });

  it("TEST 18: difficulty breakdown", async () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const result = await runRealWorldBenchmark(dataset, annotations);
    expect(result.difficultyBreakdown.EASY?.count).toBeGreaterThan(0);
    expect(result.difficultyBreakdown.VERY_HARD?.count).toBe(1);
  });

  it("TEST 19: BPM breakdown", async () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const result = await runRealWorldBenchmark(dataset, annotations);
    expect(result.bpmBreakdown["60-90"]?.count).toBeGreaterThan(0);
    expect(result.bpmBreakdown["150+"]?.count).toBeGreaterThan(0);
  });

  it("TEST 20: failure matrix", async () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const result = await runRealWorldBenchmark(dataset, annotations);
    expect(result.failureMatrix.buckets.TIMING).toBeTruthy();
    expect(result.failureMatrix.buckets.SAFETY.EASY).toBeGreaterThanOrEqual(0);
    const empty = generateFailureMatrix([], () => "EASY");
    expect(weakestBucket(empty)).toBe("NONE");
    expect(strongestBucket(empty)).toBeTruthy();
  });

  it("TEST 25: determinism", async () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const a = await runRealWorldBenchmark(dataset, annotations);
    const b = await runRealWorldBenchmark(dataset, annotations);
    expect(a.overall).toBe(b.overall);
    expect(a.humanCeiling.overall).toBe(b.humanCeiling.overall);
    expect(JSON.stringify(a.layerScores)).toBe(JSON.stringify(b.layerScores));
  });

  it("TEST 26: 10 song benchmark", async () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const result = await runRealWorldBenchmark(dataset, annotations);
    expect(result.songsEvaluated).toBe(10);
    expect(result.annotatorCount).toBe(2);
    expect(result.evaluationVersion).toBe(REALWORLD_VERSION);
  });

  it("TEST 27: 20 song benchmark", async () => {
    const { dataset, annotations } = clonePilotSongs(20);
    const result = await runRealWorldBenchmark(dataset, annotations);
    expect(result.songsEvaluated).toBe(20);
  });

  it("TEST 28: 50 song benchmark fixture", async () => {
    const { dataset, annotations } = clonePilotSongs(50);
    const result = await runRealWorldBenchmark(dataset, annotations);
    expect(result.songsEvaluated).toBe(50);
  });

  it("TEST 29: empty dataset is safe", async () => {
    const result = await runRealWorldBenchmark({ annotationVersion: ANNOTATION_VERSION, items: [] }, []);
    expect(result.songsEvaluated).toBe(0);
    expect(result.grade).toBe("F");
    expect(result.status).toBe("NOT_READY");
  });

  it("TEST 42: cue density regression is detected", () => {
    const before = { overallScore: 88, majorCueRecall: 0.9, unsafeRecommendationRate: 0.01, cueF1: 0.9 } as Awaited<
      ReturnType<typeof runRealWorldBenchmark>
    >["summary"];
    const after = { ...before, cueF1: 0.6, overallScore: 70 };
    expect(compareBenchmarkRuns(before, after).status).toBe("REGRESSION");
  });

  it("TEST 43: formation regression is detected", () => {
    const before = { overallScore: 88, majorCueRecall: 0.9, unsafeRecommendationRate: 0.01, formationTop3: 0.9 } as Awaited<
      ReturnType<typeof runRealWorldBenchmark>
    >["summary"];
    const after = { ...before, formationTop3: 0.4, overallScore: 70 };
    expect(compareBenchmarkRuns(before, after).status).toBe("REGRESSION");
  });

  it("TEST 44: sequence regression is detected", () => {
    const before = {
      overallScore: 88,
      majorCueRecall: 0.9,
      unsafeRecommendationRate: 0.01,
      sequenceCorrelation: 0.9,
    } as Awaited<ReturnType<typeof runRealWorldBenchmark>>["summary"];
    const after = { ...before, sequenceCorrelation: 0.2, overallScore: 70 };
    expect(compareBenchmarkRuns(before, after).status).toBe("REGRESSION");
    expect(detectRegression(before, after).isRegression).toBe(true);
  });

  it("TEST 49: full real benchmark pipeline", async () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const result = await runRealWorldBenchmark(dataset, annotations);
    expect(result.humanCeiling.pairs).toBeGreaterThan(0);
    expect(result.humanCeilingRatio.overall).toBeGreaterThan(0);
    expect(result.layerScores.phase5Movement).toBeGreaterThan(50);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.consensusReviews.length).toBeGreaterThan(0);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("TEST 50: full benchmark report", async () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const result = await runRealWorldBenchmark(dataset, annotations);
    const report = formatRealWorldReport(result);
    expect(report).toContain("ChoreoCore Real World Benchmark");
    expect(report).toContain("Human-Human Agreement");
    expect(report).toContain("Weakest");
    expect(report).toContain("Phase 2 Structure");
  });

  it("skips songs without rights", async () => {
    const { dataset, annotations } = realWorldPilotDataset();
    dataset.items[0]!.song.rightsConfirmed = false;
    const result = await runRealWorldBenchmark(dataset, annotations);
    expect(result.songsEvaluated).toBe(9);
  });

  it("progress callback counts songs", async () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const seen: number[] = [];
    await runRealWorldBenchmark(dataset, annotations, undefined, {
      onProgress: (p) => seen.push(p.completed),
    });
    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBe(10);
  });
});
