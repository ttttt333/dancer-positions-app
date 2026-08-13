import type { AnnotationSession, CalibrationResult } from "../types/AnnotationTypes";
import { calculateInterRaterAgreement } from "./ConsensusEngine";

export const CALIBRATION_AGREEMENT_MIN = 0.65;

export function runCalibration(sessions: AnnotationSession[]): CalibrationResult {
  const songIds = [...new Set(sessions.map((s) => s.songId))].sort();
  const annotatorCount = new Set(sessions.map((s) => s.annotatorId)).size;
  if (songIds.length < 2) {
    return {
      songIds,
      annotatorCount,
      agreement: 0,
      passed: false,
      reason: "calibration requires 2 songs",
    };
  }
  if (annotatorCount < 2) {
    return {
      songIds,
      annotatorCount,
      agreement: 0,
      passed: false,
      reason: "calibration requires 2 annotators",
    };
  }
  const scores = songIds.map((songId) => calculateInterRaterAgreement(sessions.filter((s) => s.songId === songId)).overall);
  const agreement = scores.reduce((s, v) => s + v, 0) / scores.length;
  const passed = agreement >= CALIBRATION_AGREEMENT_MIN;
  return {
    songIds,
    annotatorCount,
    agreement,
    passed,
    reason: passed
      ? "annotators share the rubric"
      : "Human-Human agreement too low — explain the annotation rules before tuning AI",
  };
}
