import type { RealWorldPilotResult } from "../types/PilotTypes";
import { formatDisagreementReport } from "./PilotDisagreement";

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function n1(value: number): string {
  return value.toFixed(1);
}

function n3(value: number): string {
  return value.toFixed(3);
}

export function generatePilotReport(result: RealWorldPilotResult): string {
  const lines: string[] = [
    "========================================",
    "CHOREOCORE REAL SONG PILOT",
    "==========================",
    "",
    `Songs:`,
    `${result.songsEvaluated}`,
    "",
    `Annotators:`,
    `${result.annotators}`,
    "",
    `Calibration:`,
    `${result.calibration.passed ? "PASS" : "FAILED"}`,
  ];

  if (!result.calibration.passed) {
    lines.push("", "CALIBRATION FAILED", "", "Reasons:");
    for (const reason of result.calibration.reasons) lines.push(`* ${reason}`);
    lines.push(
      "",
      `Cue:`,
      n3(result.calibration.byDomain.cue),
      "",
      `Section:`,
      n3(result.calibration.byDomain.section),
      "",
      `Formation:`,
      n3(result.calibration.byDomain.formation),
      "",
      `Sequence:`,
      n3(result.calibration.byDomain.sequence)
    );
  }

  lines.push(
    "",
    `Human-Human:`,
    pct(result.humanHumanAgreement),
    "",
    `AI-Human:`,
    pct(result.aiHumanAgreement),
    "",
    `Human Ceiling Ratio:`,
    n3(result.humanCeilingRatio),
    "",
    "---",
    "",
    `Cue F1:`,
    pct(result.benchmark.cueF1),
    "",
    `Major Cue Recall:`,
    pct(result.benchmark.majorCueRecall),
    "",
    `Section Accuracy:`,
    pct(result.benchmark.sectionAccuracy),
    "",
    `Formation Top3:`,
    pct(result.benchmark.formationTop3),
    "",
    `Transition:`,
    result.benchmark.transitionCorrelation.toFixed(2),
    "",
    `Sequence:`,
    result.benchmark.sequenceCorrelation.toFixed(2),
    "",
    `Unsafe:`,
    pct(result.benchmark.unsafeRecommendationRate),
    "",
    "---",
    "",
    "Layer Scores",
    "",
    `Phase 1 Audio:`,
    n1(result.layerDiagnostics.phase1),
    "",
    `Phase 2 Structure:`,
    n1(result.layerDiagnostics.phase2),
    "",
    `Phase 3 Cue:`,
    n1(result.layerDiagnostics.phase3),
    "",
    `Phase 4 Formation:`,
    n1(result.layerDiagnostics.phase4),
    "",
    `Phase 5 Movement:`,
    n1(result.layerDiagnostics.phase5),
    "",
    `Phase 6 Sequence:`,
    n1(result.layerDiagnostics.phase6),
    "",
    "---",
    "",
    `Priority 1:`,
    result.improvementAdvice.priority1 ?? "n/a",
    "",
    `Priority 2:`,
    result.improvementAdvice.priority2 ?? "n/a",
    "",
    `Priority 3:`,
    result.improvementAdvice.priority3 ?? "n/a",
    "",
    "---",
    "",
    `Status:`,
    result.status,
    "",
    `Ceiling class: ${result.ceilingClass}`,
    `Safety: ${result.safetyClass}`,
    `Version: ${result.version.pilotVersion}`,
    "",
    "========================================"
  );

  if (result.songReports.length > 0) {
    lines.push("", "Song reports");
    for (const song of result.songReports) {
      lines.push(
        "",
        `SONG: ${song.songId}`,
        `Human-Human: ${n3(song.humanHuman)}`,
        `AI-Human: ${n3(song.aiHuman)}`,
        `Ceiling Ratio: ${n3(song.ceilingRatio)}`,
        `Cue F1: ${n3(song.cueF1)}`,
        `Major Recall: ${n3(song.majorRecall)}`,
        `Formation Top3: ${n3(song.formationTop3)}`,
        `Sequence: ${n3(song.sequence)}`,
        `Safety: ${n3(song.safety)}`,
        `Status: ${song.status}`
      );
    }
  }

  if (result.disagreements.length > 0) {
    lines.push("", "Human Disagreement Report", "", formatDisagreementReport(result.disagreements));
  }

  return lines.join("\n");
}

export function exportPilotJson(result: RealWorldPilotResult): string {
  return JSON.stringify(result, null, 2);
}

export function importPilotJson(raw: unknown): RealWorldPilotResult {
  const obj = (typeof raw === "string" ? JSON.parse(raw) : raw) as RealWorldPilotResult;
  if (!obj || typeof obj !== "object") throw new Error("invalid pilot JSON");
  if (!obj.version?.pilotVersion) throw new Error("missing pilotVersion");
  return obj;
}
