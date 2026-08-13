/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { runRealSongPilot } from "./PilotRunner";
import { generatePilotReport, exportPilotJson, importPilotJson } from "./PilotReport";
import { classifyCeilingRatio, classifySafety } from "./PilotAgreement";
import { generateDisagreementHeatmap } from "./PilotDisagreement";
import { generateLayerDiagnostics } from "./PilotLayers";
import { realSongPilotFixture } from "./pilotFixtures";
import { makeSession } from "../annotation/annotationFixtures";
import { PILOT_VERSION } from "../types/PilotTypes";
import { ANNOTATION_WORKFLOW_VERSION } from "../types/AnnotationTypes";
import { EVALUATION_VERSION } from "../types/EvaluationTypes";
import { calculateHumanCeilingRatio } from "../realworld/HumanCeiling";

describe("Phase 10 Real Song Pilot", () => {
  it("Calibration pass", async () => {
    const fx = realSongPilotFixture({ mainSongs: 2 });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 2 });
    expect(result.calibration.passed).toBe(true);
    expect(result.calibration.overallAgreement).toBeGreaterThanOrEqual(0.65);
    expect(result.calibration.byDomain.cue).toBeGreaterThan(0.5);
  });

  it("Calibration fail", async () => {
    const fx = realSongPilotFixture({ calibrationPass: false, mainSongs: 2 });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 2 });
    expect(result.calibration.passed).toBe(false);
    expect(result.status).toBe("CALIBRATION_FAIL");
    expect(result.songsEvaluated).toBe(0);
    expect(result.calibration.reasons.length).toBeGreaterThan(0);
    expect(result.groundTruth).toHaveLength(0);
  });

  it("2 annotators", async () => {
    const fx = realSongPilotFixture({ annotators: 2, mainSongs: 2 });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 2 });
    expect(result.annotators).toBe(2);
  });

  it("3 annotators", async () => {
    const fx = realSongPilotFixture({ annotators: 3, mainSongs: 2 });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 2 });
    expect(result.annotators).toBe(3);
  });

  it("10 songs", async () => {
    const fx = realSongPilotFixture({ annotators: 2 });
    const result = await runRealSongPilot(fx);
    expect(result.songsEvaluated).toBe(10);
    expect(result.status).toBe("PILOT_COMPLETE");
  });

  it("Partial dataset", async () => {
    const fx = realSongPilotFixture({ mainSongs: 7 });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 10 });
    expect(result.songsEvaluated).toBe(7);
    expect(result.status).toBe("PARTIAL_DATA");
    expect(generatePilotReport(result)).toContain("PARTIAL_DATA");
  });

  it("Empty dataset", async () => {
    const result = await runRealSongPilot({
      dataset: { annotationVersion: "2.0.0", items: [] },
      calibrationSessions: [],
      mainSessions: [],
    });
    expect(result.status).toBe("NO_DATA");
    expect(result.songsEvaluated).toBe(0);
    expect(generatePilotReport(result)).toContain("NO_DATA");
  });

  it("Human agreement", async () => {
    const fx = realSongPilotFixture({ mainSongs: 3 });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 3 });
    expect(result.humanHumanAgreement).toBeGreaterThan(0.5);
    expect(result.calibration.byDomain.formation).toBeGreaterThan(0);
  });

  it("AI agreement", async () => {
    const fx = realSongPilotFixture({ mainSongs: 3 });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 3 });
    expect(result.aiHumanAgreement).toBeGreaterThan(0);
    expect(result.benchmark.cueF1).toBeGreaterThan(0);
  });

  it("Ceiling ratio", async () => {
    const fx = realSongPilotFixture({ mainSongs: 3 });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 3 });
    expect(result.humanCeilingRatio).toBeGreaterThan(0);
    const ratio = calculateHumanCeilingRatio(
      { cue: 0.76, formationTop3: 0.8, sequence: 0.7, overall: 0.76 },
      { cueMatchRate: 0.84, formationTop3: 0.84, sequenceCorrelation: 0.84, overall: 0.84, pairs: 3 }
    );
    expect(ratio.overall).toBeCloseTo(0.76 / 0.84, 5);
  });

  it("Disagreement detection", async () => {
    const fx = realSongPilotFixture({ mainSongs: 1 });
    fx.mainSessions = [
      makeSession({ songId: "real-001", annotatorId: "annotator-a", cueTime: 8, formations: [["WIDE_V", 90], ["PYRAMID", 80], ["ARC", 70]] }),
      makeSession({ songId: "real-001", annotatorId: "annotator-b", cueTime: 24, formations: [["GRID", 90], ["CLUSTER", 80], ["LINE", 70]] }),
    ];
    const result = await runRealSongPilot({
      dataset: fx.dataset,
      calibrationSessions: fx.calibrationSessions,
      mainSessions: fx.mainSessions,
      expectedMainSongs: 1,
    });
    expect(result.disagreements.length).toBeGreaterThan(0);
    expect(result.disagreements.some((d) => d.type.includes("CUE") || d.type.includes("FORMATION"))).toBe(true);
  });

  it("Consensus", async () => {
    const fx = realSongPilotFixture({ mainSongs: 2 });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 2 });
    expect(result.groundTruth.length).toBe(2);
    expect(result.groundTruth.every((g) => g.cues.length > 0)).toBe(true);
    expect(result.groundTruth[0]?.annotatorCount).toBeGreaterThanOrEqual(2);
  });

  it("Review required", async () => {
    const fx = realSongPilotFixture({ mainSongs: 1 });
    fx.mainSessions = [
      makeSession({ songId: "real-001", annotatorId: "annotator-a", cueTime: 8, overall: 95 }),
      makeSession({ songId: "real-001", annotatorId: "annotator-b", cueTime: 24, overall: 40 }),
    ];
    const result = await runRealSongPilot({
      dataset: fx.dataset,
      calibrationSessions: fx.calibrationSessions,
      mainSessions: fx.mainSessions,
      expectedMainSongs: 1,
    });
    expect(result.disagreements.some((d) => d.status === "REVIEW_REQUIRED")).toBe(true);
    expect(result.groundTruth[0]?.confidenceBand).toBe("LOW");
  });

  it("Song report", async () => {
    const fx = realSongPilotFixture({ mainSongs: 2 });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 2 });
    expect(result.songReports).toHaveLength(2);
    expect(result.songReports[0]?.songId).toBe("real-001");
    expect(result.songReports[0]?.cueF1).toBeGreaterThanOrEqual(0);
    expect(generatePilotReport(result)).toContain("SONG: real-001");
  });

  it("Category report", async () => {
    const fx = realSongPilotFixture();
    const result = await runRealSongPilot(fx);
    const keys = result.categoryReports.map((r) => r.key);
    expect(keys).toContain("ENERGY_DRIVEN");
    expect(keys).toContain("BEAT_DRIVEN");
    expect(keys).toContain("DROP_HEAVY");
    expect(keys).toContain("COMPLEX_STRUCTURE");
    expect(keys).toContain("MINIMAL_STABLE");
  });

  it("BPM report", async () => {
    const fx = realSongPilotFixture();
    const result = await runRealSongPilot(fx);
    const keys = result.bpmReports.map((r) => r.key);
    expect(keys.length).toBeGreaterThanOrEqual(3);
    expect(keys).toContain("60-90");
    expect(keys).toContain("150+");
  });

  it("Layer diagnostics", async () => {
    const fx = realSongPilotFixture({ mainSongs: 3 });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 3 });
    expect(result.layerDiagnostics.phase1).toBeGreaterThan(0);
    expect(result.layerDiagnostics.phase5).toBeGreaterThan(0);
    const mapped = generateLayerDiagnostics({
      phase1Audio: result.layerDiagnostics.phase1,
      phase2Structure: result.layerDiagnostics.phase2,
      phase3Cue: result.layerDiagnostics.phase3,
      phase4Formation: result.layerDiagnostics.phase4,
      phase5Movement: result.layerDiagnostics.phase5,
      phase6Sequence: result.layerDiagnostics.phase6,
    });
    expect(mapped.phase3).toBe(result.layerDiagnostics.phase3);
  });

  it("Advisor integration", async () => {
    const fx = realSongPilotFixture({ mainSongs: 3 });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 3 });
    expect(result.improvementAdvice.priority1).toMatch(/Phase/);
    expect(result.improvementAdvice.cards.length).toBeGreaterThanOrEqual(1);
    expect(generatePilotReport(result)).toContain("Priority 1:");
  });

  it("Safety pass", async () => {
    const fx = realSongPilotFixture({ mainSongs: 2 });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 2 });
    expect(result.safetyClass).toBe("PASS");
    expect(result.benchmark.unsafeRecommendationRate).toBeLessThanOrEqual(0.02);
  });

  it("Safety fail", async () => {
    const fx = realSongPilotFixture({ mainSongs: 2, unsafe: true });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 2 });
    expect(result.safetyClass).toBe("FAIL");
    expect(result.improvementAdvice.priority1).toBe("Phase 5 Movement");
  });

  it("Pilot status", async () => {
    const fx = realSongPilotFixture();
    const result = await runRealSongPilot(fx);
    expect(result.status).toBe("PILOT_COMPLETE");
    expect(result.status).not.toBe("PRODUCTION_READY" as never);
    expect(generatePilotReport(result)).toContain("PILOT_COMPLETE");
  });

  it("Version", async () => {
    const fx = realSongPilotFixture({ mainSongs: 1 });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 1 });
    expect(result.version.pilotVersion).toBe(PILOT_VERSION);
    expect(result.version.pilotVersion).toBe("1.0.0");
    expect(result.version.annotationVersion).toBe(ANNOTATION_WORKFLOW_VERSION);
    expect(result.version.evaluationVersion).toBe(EVALUATION_VERSION);
    expect(result.version.engineVersion).toBeTruthy();
  });

  it("Determinism", async () => {
    const fx = realSongPilotFixture({ mainSongs: 3 });
    const a = await runRealSongPilot({ ...fx, expectedMainSongs: 3 });
    const b = await runRealSongPilot({ ...fx, expectedMainSongs: 3 });
    expect(a.humanHumanAgreement).toBe(b.humanHumanAgreement);
    expect(a.aiHumanAgreement).toBe(b.aiHumanAgreement);
    expect(JSON.stringify(a.layerDiagnostics)).toBe(JSON.stringify(b.layerDiagnostics));
    expect(JSON.stringify(a.groundTruth.map((g) => g.cues))).toBe(JSON.stringify(b.groundTruth.map((g) => g.cues)));
  });

  it("JSON export", async () => {
    const fx = realSongPilotFixture({ mainSongs: 1 });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 1 });
    const json = exportPilotJson(result);
    expect(json).toContain("\"pilotVersion\": \"1.0.0\"");
    expect(json).toContain("humanHumanAgreement");
  });

  it("JSON import", async () => {
    const fx = realSongPilotFixture({ mainSongs: 1 });
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 1 });
    const parsed = importPilotJson(exportPilotJson(result));
    expect(parsed.status).toBe(result.status);
    expect(parsed.songsEvaluated).toBe(1);
  });

  it("Critical error propagation", async () => {
    const fx = realSongPilotFixture({ mainSongs: 1 });
    const item = fx.dataset.items.find((i) => i.song.id === "real-001")!;
    item.ai = {
      ...item.ai,
      cues: item.ai.cues.map((c) => ({ ...c, rawTime: 2, isMajor: false })),
      sections: item.ai.sections.map((s) => ({ ...s, type: "UNKNOWN" })),
    };
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 1 });
    expect(result.criticalErrors.length + result.benchmark.criticalFailureCount).toBeGreaterThan(0);
  });

  it("Human-like classification", () => {
    expect(classifyCeilingRatio(0.905)).toBe("HUMAN_LIKE");
    expect(classifyCeilingRatio(0.9)).toBe("HUMAN_LIKE");
  });

  it("Needs-tuning classification", () => {
    expect(classifyCeilingRatio(0.75)).toBe("NEEDS_TUNING");
    expect(classifyCeilingRatio(0.8)).toBe("PROMISING");
  });

  it("Major-tuning classification", () => {
    expect(classifyCeilingRatio(0.69)).toBe("MAJOR_TUNING_REQUIRED");
    expect(classifySafety(0.01)).toBe("PASS");
    expect(classifySafety(0.03)).toBe("WATCH");
    expect(classifySafety(0.06)).toBe("FAIL");
  });

  it("Full pilot pipeline", async () => {
    const fx = realSongPilotFixture({ annotators: 3 });
    const result = await runRealSongPilot(fx);
    expect(result.calibration.passed).toBe(true);
    expect(result.songsEvaluated).toBe(10);
    expect(result.annotators).toBe(3);
    expect(result.humanHumanAgreement).toBeGreaterThan(0);
    expect(result.aiHumanAgreement).toBeGreaterThan(0);
    expect(result.groundTruth).toHaveLength(10);
    expect(result.songReports).toHaveLength(10);
    expect(result.categoryReports.length).toBe(5);
    expect(result.layerDiagnostics.phase1).toBeGreaterThan(0);
    expect(result.improvementAdvice.cards.length).toBeGreaterThanOrEqual(1);
    expect(result.status).toBe("PILOT_COMPLETE");
    const report = generatePilotReport(result);
    expect(report).toContain("CHOREOCORE REAL SONG PILOT");
    expect(report).toContain("Human-Human:");
    expect(report).toContain("PILOT_COMPLETE");
    expect(generateDisagreementHeatmap(result.disagreements).every((p) => p.annotatorCount >= 0)).toBe(true);
  });

  it("AI-assisted sessions are isolated from ground truth", async () => {
    const fx = realSongPilotFixture({ mainSongs: 1 });
    const assisted = {
      ...fx.mainSessions[0]!,
      id: "ann-ai",
      annotatorId: "ai-helper",
      mode: "AI_ASSISTED" as const,
    };
    const result = await runRealSongPilot({
      ...fx,
      mainSessions: [...fx.mainSessions, assisted],
      expectedMainSongs: 1,
    });
    expect(result.annotators).toBe(2);
    expect(result.groundTruth[0]?.annotatorCount).toBe(2);
  });

  it("Heatmap structure", async () => {
    const fx = realSongPilotFixture({ mainSongs: 1 });
    fx.mainSessions = [
      makeSession({ songId: "real-001", annotatorId: "a", cueTime: 8 }),
      makeSession({ songId: "real-001", annotatorId: "b", cueTime: 24 }),
    ];
    const result = await runRealSongPilot({ ...fx, expectedMainSongs: 1 });
    expect(result.heatmap.length).toBeGreaterThan(0);
    expect(result.heatmap[0]?.severity).toMatch(/LOW|MEDIUM|HIGH/);
    expect(["SECTION", "CUE", "FORMATION", "SEQUENCE"]).toContain(result.heatmap[0]?.type);
  });
});
