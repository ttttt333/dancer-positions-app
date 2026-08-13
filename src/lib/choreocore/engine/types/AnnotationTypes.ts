import type {
  HumanCueAnnotation,
  HumanFormationRating,
  HumanSectionAnnotation,
  HumanSequenceRating,
  SongGroundTruth,
} from "./EvaluationTypes";
import type { HumanFormationTop3 } from "./RealWorldTypes";

export const ANNOTATION_WORKFLOW_VERSION = "2.0.0";

export type AnnotationMode = "BLIND" | "AI_ASSISTED";

export type CueStrength = "REQUIRED" | "RECOMMENDED" | "OPTIONAL";

export type CueImportanceBand = "MAJOR" | "STRONG" | "MODERATE" | "MINOR";

export type ConsensusMethod = "AUTO" | "REVIEWED";

export type GroundTruthConfidenceBand = "HIGH" | "MEDIUM" | "LOW";

export type AnnotationQaStatus = "PASS" | "REVIEW" | "FAIL";

export type ConsensusReviewKind = "SECTION" | "CUE" | "FORMATION" | "SEQUENCE";

export type AnnotationSession = {
  id: string;
  songId: string;
  annotatorId: string;
  mode: AnnotationMode;
  startedAt: string;
  completedAt?: string;
  version: string;
  duration: number;
  bpm: number;
  sections: HumanSectionAnnotation[];
  cues: HumanCueAnnotation[];
  formations: HumanFormationRating[];
  formationTop3?: HumanFormationTop3[];
  sequence: HumanSequenceRating[];
  notes?: string;
};

export type AnnotationWarning = {
  field: string;
  message: string;
  kind: "INVALID" | "WARNING" | "CONTRADICTION";
};

export type AnnotationQualityReport = {
  sessionId: string;
  invalidCount: number;
  warningCount: number;
  contradictionCount: number;
  completionRate: number;
  qualityScore: number;
  status: AnnotationQaStatus;
  warnings: AnnotationWarning[];
};

export type CueAgreement = {
  timeAgreement: number;
  actionAgreement: number;
  magnitudeAgreement: number;
  importanceAgreement: number;
  overall: number;
};

export type InterRaterAgreement = {
  cue: CueAgreement;
  cueKappa: number;
  sectionBoundaryMae: number;
  formationTop3Overlap: number;
  sequenceSpearman: number;
  ratingPearson: number;
  overall: number;
  pairs: number;
};

export type ConsensusReviewItem = {
  songId: string;
  time?: number;
  type: ConsensusReviewKind;
  severity: "LOW" | "MEDIUM" | "HIGH";
  annotators: string[];
  reasons: string[];
};

export type GroundTruthSet = {
  songId: string;
  annotationVersion: string;
  sections: HumanSectionAnnotation[];
  cues: HumanCueAnnotation[];
  formations: HumanFormationRating[];
  sequence: HumanSequenceRating[];
  consensusMethod: ConsensusMethod;
  annotatorCount: number;
  agreementScore: number;
  confidence: number;
  confidenceBand: GroundTruthConfidenceBand;
  reviewedBy?: string;
  groundTruthUncertainty: boolean;
  reviews: ConsensusReviewItem[];
};

export type CalibrationResult = {
  songIds: string[];
  annotatorCount: number;
  agreement: number;
  passed: boolean;
  reason: string;
};

export type AnnotatorStats = {
  annotatorId: string;
  sessionCount: number;
  cueCount: number;
  averageConfidence: number;
  formationSpread: number;
  averageCompletedSongs: number;
};

export type ConsensusConfig = {
  matchingBeats: number;
  disagreementBeats: number;
  sequenceOverallDiff: number;
  contradictionWindowSec: number;
};

export const DEFAULT_CONSENSUS_CONFIG: ConsensusConfig = {
  matchingBeats: 1,
  disagreementBeats: 2,
  sequenceOverallDiff: 20,
  contradictionWindowSec: 5,
};

export type AnnotationContext = {
  songId: string;
  duration: number;
  bpm: number;
};

export function cueImportanceBand(importance: number): CueImportanceBand {
  if (importance >= 90) return "MAJOR";
  if (importance >= 70) return "STRONG";
  if (importance >= 40) return "MODERATE";
  return "MINOR";
}

export function cueStrengthFromImportance(importance: number): CueStrength {
  if (importance >= 70) return "REQUIRED";
  if (importance >= 40) return "RECOMMENDED";
  return "OPTIONAL";
}

export function groundTruthConfidenceBand(score: number): GroundTruthConfidenceBand {
  if (score >= 0.85) return "HIGH";
  if (score >= 0.65) return "MEDIUM";
  return "LOW";
}

export type { SongGroundTruth };
