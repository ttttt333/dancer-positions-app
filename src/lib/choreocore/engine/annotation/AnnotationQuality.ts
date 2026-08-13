import type { AnnotationQualityReport, AnnotationSession } from "../types/AnnotationTypes";
import { clamp } from "../evaluation/EvaluationMetrics";
import { validateAnnotationSession } from "./AnnotationValidator";

export function calculateAnnotationQuality(session: AnnotationSession): AnnotationQualityReport {
  const { warnings } = validateAnnotationSession(session);
  const invalidCount = warnings.filter((w) => w.kind === "INVALID").length;
  const warningCount = warnings.filter((w) => w.kind === "WARNING").length;
  const contradictionCount = warnings.filter((w) => w.kind === "CONTRADICTION").length;
  const parts = [
    session.sections.length > 0 ? 1 : 0,
    session.cues.length > 0 ? 1 : 0,
    session.formations.length > 0 || (session.formationTop3 ?? []).length > 0 ? 1 : 0,
    session.sequence.length > 0 ? 1 : 0,
  ];
  const completionRate = parts.reduce((s, v) => s + v, 0) / parts.length;
  const qualityScore = clamp(
    100 - invalidCount * 20 - warningCount * 8 - contradictionCount * 15 + completionRate * 10 - 10,
    0,
    100
  );
  let status: AnnotationQualityReport["status"] = "PASS";
  if (invalidCount > 0 || qualityScore < 50) status = "FAIL";
  else if (warningCount + contradictionCount > 0 || completionRate < 1 || qualityScore < 80) status = "REVIEW";
  return {
    sessionId: session.id,
    invalidCount,
    warningCount,
    contradictionCount,
    completionRate,
    qualityScore,
    status,
    warnings,
  };
}

export function annotatorStats(sessions: AnnotationSession[]): import("../types/AnnotationTypes").AnnotatorStats[] {
  const ids = [...new Set(sessions.map((s) => s.annotatorId))].sort();
  return ids.map((annotatorId) => {
    const rows = sessions.filter((s) => s.annotatorId === annotatorId);
    const conf = rows.flatMap((s) => s.cues.map((c) => (c.confidence > 1 ? c.confidence / 100 : c.confidence)));
    const types = new Set(rows.flatMap((s) => s.formations.map((f) => f.formationType)));
    return {
      annotatorId,
      sessionCount: rows.length,
      cueCount: rows.reduce((s, r) => s + r.cues.length, 0),
      averageConfidence: conf.length ? conf.reduce((s, v) => s + v, 0) / conf.length : 0,
      formationSpread: types.size,
      averageCompletedSongs: rows.filter((r) => r.completedAt).length,
    };
  });
}
