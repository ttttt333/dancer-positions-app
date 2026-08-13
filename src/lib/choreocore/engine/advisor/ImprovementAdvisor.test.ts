/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { adviseImprovement } from "./ImprovementAdvisor";
import { formatQualityReport } from "./QualityReport";
import { layerPriorityScore } from "./PriorityModel";
import { evaluateQualityGates } from "./QualityGates";
import { emptyFailureMatrix } from "../realworld/FailureMatrix";
import { runRealWorldBenchmark } from "../realworld/RealWorldBenchmark";
import { realWorldPilotDataset } from "../realworld/pilotDataset";
import { ADVISOR_VERSION, QUALITY_GATE_TARGETS } from "../types/AdvisorTypes";
import type { RealWorldBenchmarkResult } from "../types/RealWorldTypes";
import type { BenchmarkSummary } from "../types/EvaluationTypes";
import type { LayerScores } from "../types/RealWorldTypes";

function summary(partial: Partial<BenchmarkSummary> = {}): BenchmarkSummary {
  return {
    songsEvaluated: 10,
    overallScore: 82.6,
    grade: "B",
    status: "PROMISING",
    cuePrecision: 0.8,
    cueRecall: 0.8,
    cueF1: 0.8,
    majorCueRecall: 0.85,
    sectionAccuracy: 0.68,
    formationTop1: 0.7,
    formationTop3: 0.82,
    transitionCorrelation: 0.86,
    unsafeRecommendationRate: 0.011,
    sequenceCorrelation: 0.79,
    criticalFailureCount: 0,
    qualityGates: {},
    failures: [],
    byDifficulty: {},
    byCategory: {},
    ...partial,
  };
}

function layers(partial: Partial<LayerScores> = {}): LayerScores {
  return {
    phase1Audio: 91,
    phase2Structure: 67,
    phase3Cue: 75,
    phase4Formation: 82,
    phase5Movement: 94,
    phase6Sequence: 78,
    ...partial,
  };
}

function baseResult(partial: Partial<RealWorldBenchmarkResult> = {}): RealWorldBenchmarkResult {
  const matrix = emptyFailureMatrix();
  matrix.buckets.STRUCTURE.HARD = 3;
  matrix.buckets.ENERGY.HARD = 1;
  matrix.buckets.CUE_DENSITY.MEDIUM = 2;
  return {
    songsEvaluated: 10,
    annotatorCount: 3,
    humanHumanAgreement: 0.86,
    aiHumanAgreement: 0.81,
    humanCeiling: {
      cueMatchRate: 0.86,
      formationTop3: 0.84,
      sequenceCorrelation: 0.8,
      overall: 0.86,
      pairs: 3,
    },
    humanCeilingRatio: { cue: 0.94, formationTop3: 0.93, sequence: 0.95, overall: 0.81 / 0.86 },
    overall: 82.6,
    grade: "B",
    status: "PROMISING",
    summary: summary(),
    layerScores: layers(),
    weakestBucket: "STRUCTURE",
    strongestBucket: "SAFETY",
    weakestLayer: "phase2Structure",
    strongestLayer: "phase5Movement",
    categoryBreakdown: {},
    difficultyBreakdown: {},
    bpmBreakdown: {},
    failureMatrix: matrix,
    diagnostics: [
      {
        songId: "real-003",
        failedAt: "PHASE_2_STRUCTURE",
        timingError: 1.21,
        probableCause: "SECTION_BOUNDARY_THRESHOLD",
        rootCause: "SECTION_BOUNDARY",
        severity: "HIGH",
      },
    ],
    consensusReviews: [],
    groundTruthConfidence: {},
    recommendations: [],
    evaluationVersion: "3.0.0-phase8",
    ...partial,
  };
}

describe("ImprovementAdvisor", () => {
  it("Priority 1 is leverage, not the lowest layer score", () => {
    const result = baseResult({
      layerScores: layers({ phase2Structure: 67, phase6Sequence: 50, phase4Formation: 82 }),
    });
    result.failureMatrix.buckets.SEQUENCE.HARD = 0;
    result.failureMatrix.buckets.VARIETY.HARD = 0;
    const report = adviseImprovement(result);
    expect(report.cards[0]?.layer).toBe("phase2Structure");
    expect(report.layerPriorities.find((p) => p.layer === "phase2Structure")!.rank).toBeLessThan(
      report.layerPriorities.find((p) => p.layer === "phase6Sequence")!.rank
    );
  });

  it("matches the Structure vs Formation example ranking", () => {
    const p2 = layerPriorityScore(67, 0.32, "phase2Structure");
    const p4 = layerPriorityScore(82, 0.08, "phase4Formation");
    expect(p2).toBeGreaterThan(p4);
  });

  it("safety breach forces Phase 5 to Priority 1", () => {
    const result = baseResult({
      summary: summary({ unsafeRecommendationRate: 0.05 }),
      layerScores: layers({ phase5Movement: 96, phase2Structure: 40 }),
    });
    result.failureMatrix.buckets.SAFETY.HARD = 3;
    const report = adviseImprovement(result);
    expect(report.cards[0]?.layer).toBe("phase5Movement");
    expect(report.cards[0]?.safetyForced).toBe(true);
    expect(report.safetyConstraintHeld).toBe(false);
    expect(report.cards[0]?.fixes.every((f) => f.neverLoosenSafety)).toBe(true);
  });

  it("quality gates include Human Ceiling Ratio and Unsafe", () => {
    const rows = evaluateQualityGates(summary(), { cue: 0.94, formationTop3: 0.93, sequence: 0.9, overall: 0.942 });
    expect(rows.find((r) => r.id === "humanCeilingRatio")?.verdict).toBe("PASS");
    expect(rows.find((r) => r.id === "unsafeRecommendation")?.verdict).toBe("PASS");
    expect(rows.find((r) => r.id === "sectionAccuracy")?.verdict).toBe("FAIL");
    expect(rows).toHaveLength(8);
  });

  it("Human Ceiling Ratio 0.942 is near the human disagreement floor", () => {
    const report = adviseImprovement(
      baseResult({
        humanHumanAgreement: 0.86,
        aiHumanAgreement: 0.81,
        humanCeilingRatio: { cue: 0.94, formationTop3: 0.93, sequence: 0.95, overall: 0.81 / 0.86 },
      })
    );
    expect(report.humanCeilingRatio).toBeCloseTo(0.9419, 3);
    expect(report.gates.find((g) => g.id === "humanCeilingRatio")?.verdict).toBe("PASS");
  });

  it("low ceiling ratio is FAIL and leaves improvement room", () => {
    const report = adviseImprovement(
      baseResult({
        humanHumanAgreement: 0.86,
        aiHumanAgreement: 0.58,
        humanCeilingRatio: { cue: 0.6, formationTop3: 0.6, sequence: 0.6, overall: 0.58 / 0.86 },
      })
    );
    expect(report.humanCeilingRatio).toBeCloseTo(0.674, 2);
    expect(report.gates.find((g) => g.id === "humanCeilingRatio")?.verdict).toBe("FAIL");
  });

  it("human Top-1 disagreement is not treated as formation failure", () => {
    const result = baseResult({
      summary: summary({ formationTop3: 0.92 }),
      layerScores: layers({ phase4Formation: 90 }),
      consensusReviews: [
        {
          songId: "real-008",
          cueId: "cue-main",
          humanChoices: [
            { annotatorId: "a", formationType: "WIDE_V", score: 95 },
            { annotatorId: "b", formationType: "PYRAMID", score: 96 },
          ],
        },
      ],
    });
    const report = adviseImprovement(result);
    expect(report.disagreements[0]?.choices).toContain("PYRAMID");
    expect(report.disagreements[0]?.interpretation).toContain("誤りではない");
    const formation = report.layerPriorities.find((p) => p.layer === "phase4Formation")!;
    expect(formation.frequency).toBeLessThan(0.1);
  });

  it("emits expected impact ranges and recommended fixes", () => {
    const report = adviseImprovement(
      baseResult(),
      { meanBoundaryError: 1.21, dropRecall: 0.71, breakRecall: 0.64 }
    );
    const card = report.cards.find((c) => c.layer === "phase2Structure");
    expect(card).toBeTruthy();
    expect(card!.problems.some((p) => p.includes("1.21"))).toBe(true);
    expect(card!.problems.some((p) => p.includes("Drop"))).toBe(true);
    expect(card!.fixes[0]?.parameterHint).toContain("beatSnapTolerance");
    expect(card!.expectedImpact.overallPointsHigh).toBeGreaterThan(card!.expectedImpact.overallPointsLow);
    expect(card!.expectedImpact.unsafeDelta).toBe(0);
  });

  it("formats the quality report with PRIORITY 1", () => {
    const text = formatQualityReport(adviseImprovement(baseResult(), { meanBoundaryError: 1.21 }));
    expect(text).toContain("CHOREOCORE AI QUALITY REPORT");
    expect(text).toContain("PRIORITY 1");
    expect(text).toContain("Human Ceiling Ratio");
    expect(text).toContain("Do not auto-apply");
    expect(text).toContain("説明可能な提案");
  });

  it("empty benchmark is safe", async () => {
    const empty = await runRealWorldBenchmark({ annotationVersion: "1.0.0", items: [] }, []);
    const report = adviseImprovement(empty);
    expect(report.cards.length).toBeLessThanOrEqual(3);
    expect(Number.isFinite(report.overall)).toBe(true);
    expect(report.advisorVersion).toBe(ADVISOR_VERSION);
  });

  it("pilot dataset produces a deterministic advisor report", async () => {
    const { dataset, annotations } = realWorldPilotDataset();
    const bench = await runRealWorldBenchmark(dataset, annotations);
    const a = adviseImprovement(bench);
    const b = adviseImprovement(bench);
    expect(JSON.stringify(a.layerPriorities.map((p) => p.layer))).toBe(
      JSON.stringify(b.layerPriorities.map((p) => p.layer))
    );
    expect(a.cards.length).toBeGreaterThan(0);
    expect(a.safetyConstraintHeld).toBe(true);
    expect(formatQualityReport(a)).toContain("Quality gates");
  });

  it("never recommends loosening safety", () => {
    const report = adviseImprovement(baseResult());
    for (const card of report.cards) {
      expect(card.fixes.every((f) => f.neverLoosenSafety)).toBe(true);
      expect(card.expectedImpact.unsafeDelta).toBeLessThanOrEqual(0);
    }
  });

  it("roadmap levels follow Music → Cue → Spatial → Physical → Choreographic", () => {
    const report = adviseImprovement(baseResult());
    expect(report.layerPriorities.find((p) => p.layer === "phase2Structure")?.level).toBe(
      "LEVEL_1_MUSIC_UNDERSTANDING"
    );
    expect(report.layerPriorities.find((p) => p.layer === "phase3Cue")?.level).toBe("LEVEL_2_CUE_INTELLIGENCE");
    expect(report.layerPriorities.find((p) => p.layer === "phase4Formation")?.level).toBe(
      "LEVEL_3_SPATIAL_INTELLIGENCE"
    );
    expect(report.layerPriorities.find((p) => p.layer === "phase5Movement")?.level).toBe(
      "LEVEL_4_PHYSICAL_INTELLIGENCE"
    );
    expect(report.layerPriorities.find((p) => p.layer === "phase6Sequence")?.level).toBe(
      "LEVEL_5_CHOREOGRAPHIC_INTELLIGENCE"
    );
  });

  it("gate targets match the 100-point table", () => {
    expect(QUALITY_GATE_TARGETS.cueF1).toBe(0.8);
    expect(QUALITY_GATE_TARGETS.majorCueRecall).toBe(0.85);
    expect(QUALITY_GATE_TARGETS.unsafeRecommendation).toBe(0.02);
    expect(QUALITY_GATE_TARGETS.humanCeilingRatio).toBe(0.9);
  });
});
