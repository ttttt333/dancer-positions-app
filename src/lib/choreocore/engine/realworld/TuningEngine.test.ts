/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  applyParameterChangesToOutput,
  cartesianGrid,
  evaluateTuningCandidate,
  generateTuningCandidates,
  paretoFrontier,
  recordTuningHistory,
  summarizeAgainstAnnotations,
} from "./TuningEngine";
import { compareBenchmarkRuns } from "./RealWorldBenchmark";
import { realWorldPilotDataset } from "./pilotDataset";
import { REALWORLD_VERSION } from "../types/RealWorldTypes";
import type { BenchmarkSummary } from "../types/EvaluationTypes";
import type { TuningCandidate } from "../types/RealWorldTypes";

function summary(partial: Partial<BenchmarkSummary> = {}): BenchmarkSummary {
  return {
    songsEvaluated: 10,
    overallScore: 80,
    grade: "B",
    status: "PROMISING",
    cuePrecision: 0.8,
    cueRecall: 0.8,
    cueF1: 0.8,
    majorCueRecall: 0.85,
    sectionAccuracy: 0.8,
    formationTop1: 0.7,
    formationTop3: 0.8,
    transitionCorrelation: 0.8,
    unsafeRecommendationRate: 0.01,
    sequenceCorrelation: 0.8,
    criticalFailureCount: 0,
    qualityGates: {},
    failures: [],
    byDifficulty: {},
    byCategory: {},
    ...partial,
  };
}

describe("TuningEngine", () => {
  it("TEST 10: tuning candidate status", () => {
    const cand = evaluateTuningCandidate(summary({ overallScore: 80 }), summary({ overallScore: 90 }), {
      microShiftThreshold: 50,
    });
    expect(cand.status).toBe("IMPROVEMENT");
    expect(cand.parameterChanges.microShiftThreshold).toBe(50);
  });

  it("TEST 11: grid search enumerates combinations", () => {
    const combos = cartesianGrid({ a: [1, 2], b: [3, 4] });
    expect(combos).toHaveLength(4);
    expect(combos[0]).toEqual({ a: 1, b: 3 });
  });

  it("TEST 12: safety rejection is not IMPROVEMENT", () => {
    const cand = evaluateTuningCandidate(
      summary({ overallScore: 80, unsafeRecommendationRate: 0.01 }),
      summary({ overallScore: 90, unsafeRecommendationRate: 0.05 }),
      { softViolationRatio: 0.5 }
    );
    expect(cand.status).not.toBe("IMPROVEMENT");
    expect(["TRADEOFF", "REGRESSION"]).toContain(cand.status);
  });

  it("TEST 13: regression when overall drops", () => {
    const cmp = compareBenchmarkRuns(summary({ overallScore: 90 }), summary({ overallScore: 80 }));
    expect(cmp.status).toBe("REGRESSION");
  });

  it("TEST 14: improvement when overall rises and safety holds", () => {
    const cmp = compareBenchmarkRuns(summary({ overallScore: 80 }), summary({ overallScore: 90 }));
    expect(cmp.status).toBe("IMPROVEMENT");
  });

  it("TEST 15: tradeoff when quality up and safety down", () => {
    const cmp = compareBenchmarkRuns(
      summary({ overallScore: 80, unsafeRecommendationRate: 0.01 }),
      summary({ overallScore: 90, unsafeRecommendationRate: 0.04 })
    );
    expect(cmp.status).toBe("TRADEOFF");
  });

  it("TEST 16: pareto frontier keeps non-dominated candidates", () => {
    const cands: TuningCandidate[] = [
      evaluateTuningCandidate(summary(), summary({ cueF1: 0.9, formationTop3: 0.7, unsafeRecommendationRate: 0.02 }), { a: 1 }),
      evaluateTuningCandidate(summary(), summary({ cueF1: 0.7, formationTop3: 0.95, unsafeRecommendationRate: 0.01 }), { a: 2 }),
      evaluateTuningCandidate(summary(), summary({ cueF1: 0.6, formationTop3: 0.6, unsafeRecommendationRate: 0.05 }), { a: 3 }),
    ];
    const front = paretoFrontier(cands);
    expect(front.length).toBeGreaterThanOrEqual(2);
    expect(front.some((c) => c.parameterChanges.a === 3)).toBe(false);
  });

  it("TEST 23: before/after comparison", () => {
    const cmp = compareBenchmarkRuns(summary({ cueF1: 0.7 }), summary({ cueF1: 0.9, overallScore: 88 }));
    expect(cmp.cueF1Delta).toBeCloseTo(0.2, 8);
    expect(cmp.overallDelta).toBe(8);
  });

  it("TEST 24: tuning history records versions", () => {
    const history = recordTuningHistory(summary(), summary({ overallScore: 88 }), { microShiftThreshold: 50 }, new Date("2026-08-14T00:00:00.000Z"));
    expect(history.baselineVersion).toBe(REALWORLD_VERSION);
    expect(history.createdAt).toBe("2026-08-14T00:00:00.000Z");
    expect(history.parametersChanged.microShiftThreshold).toBe(50);
  });

  it("TEST 45: tuning no-op is inconclusive", () => {
    const before = summary({ overallScore: 80 });
    const after = summary({ overallScore: 80 });
    expect(evaluateTuningCandidate(before, after, {}).status).toBe("INCONCLUSIVE");
  });

  it("TEST 46: tuning improves by dropping extra micro cues", async () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const over = dataset.items.find((i) => i.song.id === "real-006")!;
    const slim = { annotationVersion: dataset.annotationVersion, items: [over] };
    const anns = annotations.filter((a) => a.songId === "real-006");
    const baseline = summarizeAgainstAnnotations(slim, anns, (ai) => ai);
    const cands = generateTuningCandidates(slim, anns, baseline, { microShiftThreshold: [35, 65] });
    const raised = cands.find((c) => c.parameterChanges.microShiftThreshold === 65);
    expect(raised).toBeTruthy();
    expect(raised!.score.cueF1).toBeGreaterThanOrEqual(baseline.cueF1);
  });

  it("TEST 47: tuning worsens with anticipation shift", () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const item = dataset.items.find((i) => i.song.id === "real-001")!;
    const slim = { annotationVersion: dataset.annotationVersion, items: [item] };
    const anns = annotations.filter((a) => a.songId === "real-001");
    const baseline = summarizeAgainstAnnotations(slim, anns, (ai) => ai);
    const worse = summarizeAgainstAnnotations(
      slim,
      anns,
      (ai) => applyParameterChangesToOutput(ai, { anticipationBeats: 12 })
    );
    expect(evaluateTuningCandidate(baseline, worse, { anticipationBeats: 12 }).status).toBe("REGRESSION");
  });

  it("TEST 48: tuning tradeoff is preserved", () => {
    const cand = evaluateTuningCandidate(
      summary({ overallScore: 80, unsafeRecommendationRate: 0.01, cueF1: 0.8 }),
      summary({ overallScore: 92, unsafeRecommendationRate: 0.03, cueF1: 0.95 }),
      { novelty: 0.2 }
    );
    expect(cand.status).toBe("TRADEOFF");
  });

  it("filters unsafe-worsening sets away from IMPROVEMENT in grid search", async () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const item = { ...dataset.items[0]! };
    item.ai = {
      ...item.ai,
      transitions: item.ai.transitions.map((t) => ({ ...t, unsafe: false, feasible: true })),
    };
    const slim = { annotationVersion: dataset.annotationVersion, items: [item] };
    const anns = annotations.filter((a) => a.songId === item.song.id);
    const baseline = summarizeAgainstAnnotations(slim, anns, (ai) => ai);
    const cands = generateTuningCandidates(slim, anns, baseline, { softViolationRatio: [1.05, 0.5] });
    const unsafe = cands.find((c) => c.parameterChanges.softViolationRatio === 0.5);
    expect(unsafe?.status).not.toBe("IMPROVEMENT");
  });
});
