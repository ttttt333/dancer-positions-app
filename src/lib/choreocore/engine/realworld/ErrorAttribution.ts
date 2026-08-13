import type { AiEvaluationOutput, EvaluationResult, HumanFormationRating } from "../types/EvaluationTypes";
import type {
  DiagnosticFinding,
  DiagnosticSeverity,
  FailedAtLayer,
  RootCause,
} from "../types/RealWorldTypes";

function severityForTiming(error: number, majorMiss: boolean): DiagnosticSeverity {
  if (majorMiss && error >= 1.5) return "CRITICAL";
  if (error >= 1.5) return "HIGH";
  if (error >= 0.6) return "MEDIUM";
  return "LOW";
}

function formationRootCause(
  human: HumanFormationRating[],
  aiType: string | undefined,
  humanType: string | undefined
): RootCause {
  if (!aiType || !humanType || aiType === humanType) return "MUSIC_FIT";
  const h = human.find((r) => r.formationType === humanType);
  const a = human.find((r) => r.formationType === aiType);
  if (!h || !a) return "FORMATION_DIVERSITY";
  const musicGap = h.musicFit - a.musicFit;
  const transGap = h.transitionQuality - a.transitionQuality;
  if (transGap > musicGap && transGap > 4) return "TRANSITION";
  if (musicGap > 4) return "MUSIC_FIT";
  return "FORMATION_DIVERSITY";
}

export function attributeErrors(
  result: EvaluationResult,
  ai: AiEvaluationOutput,
  formations: HumanFormationRating[],
  humanCueTimes: number[] = []
): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];
  const songId = result.songId;

  if (result.cueMetrics.timingErrorMean > 0.6 || result.cueMetrics.majorCueRecall < 0.85) {
    const majorMiss = result.cueMetrics.majorCueRecall < 0.5;
    const expectedTime = humanCueTimes[0];
    const aiTime = ai.cues[0]?.rawTime;
    const timingError = result.cueMetrics.timingErrorMean;
    const snapping = timingError >= 1.5;
    findings.push({
      songId,
      failedAt: "PHASE_3_CUE",
      expectedTime,
      aiTime,
      timingError,
      probableCause: snapping ? "BAR_SNAPPING_TOO_AGGRESSIVE" : "CUE_TIMING_OFFSET",
      rootCause: snapping ? "BAR_SNAPPING_TOO_AGGRESSIVE" : "CUE_TIMING",
      severity: severityForTiming(timingError, majorMiss),
    });
    if (majorMiss) {
      findings.push({
        songId,
        failedAt: "PHASE_3_CUE",
        probableCause: "MAJOR_CUE_MISSED",
        rootCause: "CUE_TIMING",
        severity: "CRITICAL",
      });
    }
  }

  if (result.cueMetrics.overgenerationRate > 0.3) {
    findings.push({
      songId,
      failedAt: "PHASE_3_CUE",
      probableCause: "MINOR_HIT_THRESHOLD_TOO_LOW",
      rootCause: "CUE_DENSITY",
      severity: result.cueMetrics.overgenerationRate > 0.6 ? "HIGH" : "MEDIUM",
    });
  }

  if (result.sectionMetrics.classificationAccuracy < 0.7 || result.sectionMetrics.meanBoundaryError > 0.5) {
    findings.push({
      songId,
      failedAt: "PHASE_2_STRUCTURE",
      timingError: result.sectionMetrics.meanBoundaryError,
      probableCause: "SECTION_BOUNDARY_THRESHOLD",
      rootCause: "SECTION_BOUNDARY",
      severity: result.sectionMetrics.meanBoundaryError > 1.2 ? "HIGH" : "MEDIUM",
    });
  }

  if (result.formationMetrics.top3Agreement < 1) {
    const humanOrder = [...formations].sort((a, b) => b.score - a.score || a.formationType.localeCompare(b.formationType));
    const aiOrder = [...ai.formationRankings].sort(
      (a, b) => b.score - a.score || a.formationType.localeCompare(b.formationType)
    );
    const humanType = humanOrder[0]?.formationType;
    const aiType = aiOrder[0]?.formationType;
    findings.push({
      songId,
      failedAt: "PHASE_4_FORMATION",
      probableCause: `AI=${aiType ?? "none"} HUMAN=${humanType ?? "none"}`,
      rootCause: formationRootCause(formations, aiType, humanType),
      severity: result.formationMetrics.top3Agreement < 0.5 ? "HIGH" : "MEDIUM",
    });
  }

  if (result.transitionMetrics.unsafeRecommendationRate > 0) {
    findings.push({
      songId,
      failedAt: "PHASE_5_MOVEMENT",
      probableCause: "UNSAFE_MARKED_FEASIBLE",
      rootCause: "UNSAFE_MOVEMENT",
      severity: "CRITICAL",
    });
  }

  if (result.sequenceMetrics.absoluteGap > 12 || result.sequenceMetrics.correlation < 0.75) {
    findings.push({
      songId,
      failedAt: "PHASE_6_SEQUENCE",
      probableCause: "SEQUENCE_STORY_WEIGHT",
      rootCause: "SEQUENCE_STORY",
      severity: result.sequenceMetrics.absoluteGap > 30 ? "HIGH" : "MEDIUM",
    });
  }

  findings.sort((a, b) => a.failedAt.localeCompare(b.failedAt) || a.rootCause.localeCompare(b.rootCause));
  return findings;
}

export function layerFromRootCause(cause: RootCause): FailedAtLayer {
  switch (cause) {
    case "SECTION_BOUNDARY":
      return "PHASE_2_STRUCTURE";
    case "CUE_TIMING":
    case "CUE_DENSITY":
    case "BAR_SNAPPING_TOO_AGGRESSIVE":
      return "PHASE_3_CUE";
    case "MUSIC_FIT":
    case "FORMATION_DIVERSITY":
      return "PHASE_4_FORMATION";
    case "TRANSITION":
    case "UNSAFE_MOVEMENT":
      return "PHASE_5_MOVEMENT";
    case "SEQUENCE_STORY":
      return "PHASE_6_SEQUENCE";
    default:
      return "PHASE_3_CUE";
  }
}
