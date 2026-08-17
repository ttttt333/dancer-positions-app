import type {
  FormationChangeMagnitude,
  FormationCue,
  FormationCueAction,
} from "./CueTypes";
import type { MusicSectionType } from "./MusicTypes";
import type { MusicSection } from "./MusicTypes";

export const EVALUATION_VERSION = "3.0.0-phase7";
export const ANNOTATION_VERSION = "1.0.0";

export type SongDifficulty = "EASY" | "MEDIUM" | "HARD" | "VERY_HARD";

export type MusicStructureCategory =
  | "ENERGY_DRIVEN"
  | "BEAT_DRIVEN"
  | "DYNAMIC_CONTRAST"
  | "BREAK_DROP_HEAVY"
  | "COMPLEX_ARRANGEMENT";

export type QualityGrade = "A+" | "A" | "B" | "C" | "D" | "F";

export type BenchmarkStatus =
  | "NOT_READY"
  | "PROMISING"
  | "PRODUCTION_CANDIDATE"
  | "PRODUCTION_READY";

export type CriticalErrorType =
  | "TIMING_MISS"
  | "UNSAFE_MOVEMENT"
  | "EXCESSIVE_CHANGES"
  | "VISUAL_MONOTONY"
  | "MUSIC_MISMATCH"
  | "LOW_IMPACT"
  | "UNREALISTIC_FORMATION"
  | "WRONG_SECTION";

export type FailureBucket =
  | "TIMING"
  | "STRUCTURE"
  | "ENERGY"
  | "CUE_DENSITY"
  | "FORMATION"
  | "MOVEMENT"
  | "COLLISION"
  | "VARIETY"
  | "SEQUENCE"
  | "SAFETY";

export type EvaluationSong = {
  id: string;
  title?: string;
  genre?: string;
  bpm?: number;
  duration: number;
  audioHash: string;
  audioPath?: string;
  metadata: {
    source?: string;
    artist?: string;
    notes?: string;
  };
  expectedDifficulty?: number;
};

export type HumanCueAnnotation = {
  songId: string;
  annotatorId: string;
  /** Stable id so formation layouts survive time edits. */
  id?: string;
  /** When this formation is reached (hold starts). Consensus still keys off this. */
  time: number;
  /**
   * When this formation hold ends and travel to the next cue starts.
   * Movement is [holdEnd, next.time). If omitted, hold runs until the next cue.
   */
  holdEnd?: number;
  action: FormationCueAction;
  magnitude: FormationChangeMagnitude;
  importance: number;
  confidence: number;
  strength?: "REQUIRED" | "RECOMMENDED" | "OPTIONAL";
  notes?: string;
};

export type HumanSectionAnnotation = {
  songId: string;
  annotatorId: string;
  startTime: number;
  endTime: number;
  type: MusicSectionType;
  confidence: number;
};

/** Human-drawn stage placement. xPct/yPct are 0–100, y=0 upstage, y=100 audience. */
export type HumanFormationLayout = {
  dancerCount: number;
  positions: Array<{ id: string; xPct: number; yPct: number }>;
};

export type HumanFormationRating = {
  songId: string;
  cueId: string;
  annotatorId: string;
  formationType: string;
  score: number;
  musicFit: number;
  visualImpact: number;
  transitionQuality: number;
  execution: number;
  originality: number;
  overall?: number;
  rank?: 1 | 2 | 3;
  formationId?: string;
  notes?: string;
  /** Optional visual placement. Consensus still keys off formationType. */
  layout?: HumanFormationLayout;
};

export type HumanSequenceRating = {
  songId: string;
  annotatorId: string;
  formationIds: string[];
  musicStory: number;
  visualStory: number;
  execution: number;
  variety: number;
  overall: number;
  notes?: string;
};

export type SongGroundTruth = {
  songId: string;
  annotationVersion: string;
  sections: HumanSectionAnnotation[];
  cues: HumanCueAnnotation[];
  formations: HumanFormationRating[];
  sequence: HumanSequenceRating[];
};

export type AiFormationRank = {
  cueId?: string;
  formationType: string;
  score: number;
};

export type AiTransitionEval = {
  cueId?: string;
  formationType?: string;
  transitionScore: number;
  feasible: boolean;
  unsafe?: boolean;
};

export type AiSequenceEval = {
  formationTypes: string[];
  totalScore: number;
};

export type AiEvaluationOutput = {
  bpm: number;
  cues: FormationCue[];
  sections: MusicSection[];
  formationRankings: AiFormationRank[];
  transitions: AiTransitionEval[];
  sequence: AiSequenceEval;
  analysisVersion: string;
};

export type CriticalError = {
  type: CriticalErrorType;
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
  songId?: string;
};

export type FailureAnalysis = {
  category: FailureBucket;
  severity: "LOW" | "MEDIUM" | "HIGH";
  affectedSongs: number;
  averageError: number;
  probableCause: string;
};

export type CueMetrics = {
  precision: number;
  recall: number;
  f1: number;
  timingErrorMean: number;
  timingErrorMedian: number;
  beatErrorMean: number;
  overgenerationRate: number;
  underGenerationRate: number;
  majorCueRecall: number;
};

export type SectionMetrics = {
  meanBoundaryError: number;
  medianBoundaryError: number;
  within1BeatRate: number;
  within2BeatRate: number;
  classificationAccuracy: number;
};

export type FormationMetrics = {
  top1Agreement: number;
  top3Agreement: number;
  top5Agreement: number;
  rankCorrelation: number;
};

export type TransitionMetrics = {
  mae: number;
  rmse: number;
  correlation: number;
  unsafeRecommendationRate: number;
};

export type SequenceMetrics = {
  mae: number;
  rmse: number;
  correlation: number;
  topSequenceAgreement: number;
  humanOverall: number;
  normalizedAiScore: number;
  absoluteGap: number;
};

export type EvaluationResult = {
  songId: string;
  cueMetrics: CueMetrics;
  sectionMetrics: SectionMetrics;
  formationMetrics: FormationMetrics;
  transitionMetrics: TransitionMetrics;
  sequenceMetrics: SequenceMetrics;
  overallScore: number;
  grade: QualityGrade;
  criticalErrors: CriticalError[];
  annotationVersion: string;
  analysisVersion: string;
  evaluationVersion: string;
};

export type BenchmarkSummary = {
  songsEvaluated: number;
  overallScore: number;
  grade: QualityGrade;
  status: BenchmarkStatus;
  cuePrecision: number;
  cueRecall: number;
  cueF1: number;
  majorCueRecall: number;
  sectionAccuracy: number;
  formationTop1: number;
  formationTop3: number;
  transitionCorrelation: number;
  unsafeRecommendationRate: number;
  sequenceCorrelation: number;
  hardestCategory?: string;
  strongestCategory?: string;
  criticalFailureCount: number;
  qualityGates: Record<string, boolean>;
  failures: FailureAnalysis[];
  byDifficulty: Partial<Record<SongDifficulty, { count: number; overallScore: number }>>;
  byCategory: Partial<Record<MusicStructureCategory, { count: number; overallScore: number }>>;
};

export type BenchmarkHistory = {
  engineVersion: string;
  annotationVersion: string;
  date: string;
  summary: BenchmarkSummary;
};

export type BenchmarkProgress = {
  completed: number;
  total: number;
  currentSongId: string;
};

export type OverallScoreWeights = {
  cueTiming: number;
  cueF1: number;
  majorCueRecall: number;
  sectionAccuracy: number;
  formationTopK: number;
  transitionQuality: number;
  executionSafety: number;
  sequenceQuality: number;
};

export type QualityGates = {
  majorCueRecall: number;
  unsafeRecommendationRate: number;
  formationTop3: number;
  sequenceCorrelation: number;
  cueF1: number;
};

export type SafetyCaps = {
  capB: number;
  capC: number;
  capD: number;
};

export type BenchmarkConfig = {
  matchingBeats: number;
  majorImportance: number;
  overallWeights: OverallScoreWeights;
  gates: QualityGates;
  safetyCaps: SafetyCaps;
  regression: {
    overallDrop: number;
    majorRecallDrop: number;
    unsafeRise: number;
  };
};

export type BenchmarkDatasetItem = {
  song: EvaluationSong;
  groundTruth: SongGroundTruth;
  ai: AiEvaluationOutput;
  difficulty: SongDifficulty;
  category: MusicStructureCategory;
};

export type BenchmarkDataset = {
  annotationVersion: string;
  items: BenchmarkDatasetItem[];
};
