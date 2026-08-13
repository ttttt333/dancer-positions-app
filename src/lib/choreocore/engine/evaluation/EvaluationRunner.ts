import { ANALYSIS_VERSION } from "../constants";
import { CUE_ANALYSIS_VERSION } from "../cue/cueConfig";
import { STRUCTURE_ANALYSIS_VERSION } from "../music/structureConfig";
import { FORMATION_CANDIDATE_VERSION } from "../types/FormationTypes";
import { MOVEMENT_ANALYSIS_VERSION } from "../types/MovementTypes";
import { FORMATION_SEQUENCE_VERSION } from "../types/ScoringTypes";
import {
  ANNOTATION_VERSION,
  EVALUATION_VERSION,
  type AiEvaluationOutput,
  type BenchmarkConfig,
  type CriticalError,
  type EvaluationResult,
  type SongGroundTruth,
} from "../types/EvaluationTypes";
import { REALWORLD_VERSION } from "../types/RealWorldTypes";
import { resolveBenchmarkConfig } from "./EvaluationConfig";
import { evaluateCues } from "./CueEvaluator";
import { evaluateSections } from "./SectionEvaluator";
import { evaluateFormations } from "./FormationEvaluator";
import { evaluateTransitions } from "./TransitionEvaluator";
import { evaluateSequence } from "./SequenceEvaluator";
import { applySafetyCap, overallQualityScore, qualityGrade } from "./QualityGrade";

export type EvaluateSongInput = {
  songId: string;
  duration: number;
  groundTruth: SongGroundTruth;
  ai: AiEvaluationOutput;
  config?: Partial<BenchmarkConfig>;
};

function extraCriticalErrors(result: Omit<EvaluationResult, "criticalErrors" | "grade" | "overallScore">): CriticalError[] {
  const errors: CriticalError[] = [];
  if (result.cueMetrics.timingErrorMean > 1.2) {
    errors.push({
      type: "TIMING_MISS",
      severity: "HIGH",
      message: `mean timing error ${result.cueMetrics.timingErrorMean.toFixed(2)}s`,
      songId: result.songId,
    });
  }
  if (result.cueMetrics.overgenerationRate > 0.35) {
    errors.push({
      type: "EXCESSIVE_CHANGES",
      severity: "MEDIUM",
      message: "cue overgeneration",
      songId: result.songId,
    });
  }
  if (result.sectionMetrics.classificationAccuracy < 0.5) {
    errors.push({
      type: "WRONG_SECTION",
      severity: "HIGH",
      message: "section classification mismatch",
      songId: result.songId,
    });
  }
  if (result.formationMetrics.top3Agreement < 0.5 && result.cueMetrics.f1 > 0.7) {
    errors.push({
      type: "MUSIC_MISMATCH",
      severity: "MEDIUM",
      message: "formation ranking disagrees with human",
      songId: result.songId,
    });
  }
  if (result.sequenceMetrics.absoluteGap > 30) {
    errors.push({
      type: "LOW_IMPACT",
      severity: "MEDIUM",
      message: "human vs AI sequence gap",
      songId: result.songId,
    });
  }
  return errors;
}

export function evaluateSong(input: EvaluateSongInput): EvaluationResult {
  const config = resolveBenchmarkConfig(input.config);
  const bpm = input.ai.bpm > 0 ? input.ai.bpm : 120;
  const cueMetrics = evaluateCues(
    input.ai.cues,
    input.groundTruth.cues,
    bpm,
    config.matchingBeats,
    config.majorImportance
  );
  const sectionMetrics = evaluateSections(input.ai.sections, input.groundTruth.sections, bpm);
  const formationMetrics = evaluateFormations(
    input.ai.formationRankings,
    input.groundTruth.formations
  );
  const transition = evaluateTransitions(
    input.ai.transitions,
    input.groundTruth.formations,
    input.songId
  );
  const sequenceMetrics = evaluateSequence(input.ai.sequence, input.groundTruth.sequence);
  const overallScore = overallQualityScore(
    cueMetrics,
    sectionMetrics,
    formationMetrics,
    transition.metrics,
    sequenceMetrics,
    config
  );
  const base = {
    songId: input.songId,
    cueMetrics,
    sectionMetrics,
    formationMetrics,
    transitionMetrics: transition.metrics,
    sequenceMetrics,
    annotationVersion: input.groundTruth.annotationVersion || ANNOTATION_VERSION,
    analysisVersion: input.ai.analysisVersion,
    evaluationVersion: EVALUATION_VERSION,
  };
  const criticalErrors = [...transition.errors, ...extraCriticalErrors(base)];
  const grade = applySafetyCap(
    qualityGrade(overallScore),
    transition.metrics.unsafeRecommendationRate,
    config.safetyCaps
  );
  return { ...base, overallScore, grade, criticalErrors };
}

export const ENGINE_VERSIONS = {
  phase1: ANALYSIS_VERSION,
  phase2: STRUCTURE_ANALYSIS_VERSION,
  phase3: CUE_ANALYSIS_VERSION,
  phase4: FORMATION_CANDIDATE_VERSION,
  phase5: MOVEMENT_ANALYSIS_VERSION,
  phase6: FORMATION_SEQUENCE_VERSION,
  phase7: EVALUATION_VERSION,
  phase8: REALWORLD_VERSION,
};
