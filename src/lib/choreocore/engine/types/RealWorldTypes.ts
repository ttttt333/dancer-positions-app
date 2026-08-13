import type { MusicPhrase } from "./MusicTypes";
import type {
  AiEvaluationOutput,
  BenchmarkSummary,
  HumanCueAnnotation,
  HumanFormationRating,
  HumanSectionAnnotation,
  HumanSequenceRating,
  QualityGrade,
  SongDifficulty,
} from "./EvaluationTypes";

export const REALWORLD_VERSION = "3.0.0-phase8";

export type RealSongCategory =
  | "ENERGY_DRIVEN"
  | "BEAT_DRIVEN"
  | "DROP_HEAVY"
  | "COMPLEX_STRUCTURE"
  | "MINIMAL_STABLE";

export const REAL_SONG_CATEGORIES: RealSongCategory[] = [
  "ENERGY_DRIVEN",
  "BEAT_DRIVEN",
  "DROP_HEAVY",
  "COMPLEX_STRUCTURE",
  "MINIMAL_STABLE",
];

export const SONG_DIFFICULTIES: SongDifficulty[] = ["EASY", "MEDIUM", "HARD", "VERY_HARD"];

export type BpmBucket = "60-90" | "90-120" | "120-150" | "150+";

export type RealSongMetadata = {
  id: string;
  title: string;
  artist?: string;
  genre?: string;
  bpm?: number;
  duration: number;
  category: RealSongCategory;
  difficulty: SongDifficulty;
  audioHash: string;
  audioPath?: string;
  rightsConfirmed: boolean;
  notes?: string;
};

export type HumanPhraseAnnotation = {
  songId: string;
  annotatorId: string;
  startTime: number;
  endTime: number;
  type?: MusicPhrase["type"];
  confidence: number;
};

export type FormationTop3Rank = {
  formationType: string;
  score: number;
  rank: 1 | 2 | 3;
};

export type HumanFormationTop3 = {
  songId: string;
  cueId: string;
  annotatorId: string;
  ranks: FormationTop3Rank[];
  musicFit: number;
  visualImpact: number;
  transitionQuality: number;
  execution: number;
  originality: number;
  overall: number;
  notes?: string;
};

export type RealSongAnnotations = {
  songId: string;
  annotatorId: string;
  annotationVersion: string;
  sections: HumanSectionAnnotation[];
  phrases: HumanPhraseAnnotation[];
  cues: HumanCueAnnotation[];
  formations: HumanFormationRating[];
  formationTop3?: HumanFormationTop3[];
  sequence: HumanSequenceRating[];
};

export type RealWorldDatasetItem = {
  song: RealSongMetadata;
  ai: AiEvaluationOutput;
  phrases?: MusicPhrase[];
};

export type RealWorldDataset = {
  annotationVersion: string;
  items: RealWorldDatasetItem[];
};

export type LayerScores = {
  phase1Audio: number;
  phase2Structure: number;
  phase3Cue: number;
  phase4Formation: number;
  phase5Movement: number;
  phase6Sequence: number;
};

export type FailedAtLayer =
  | "PHASE_1_AUDIO"
  | "PHASE_2_STRUCTURE"
  | "PHASE_3_CUE"
  | "PHASE_4_FORMATION"
  | "PHASE_5_MOVEMENT"
  | "PHASE_6_SEQUENCE";

export type RootCause =
  | "MUSIC_FIT"
  | "TRANSITION"
  | "FORMATION_DIVERSITY"
  | "CUE_TIMING"
  | "CUE_DENSITY"
  | "SECTION_BOUNDARY"
  | "UNSAFE_MOVEMENT"
  | "SEQUENCE_STORY"
  | "BAR_SNAPPING_TOO_AGGRESSIVE";

export type DiagnosticSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type DiagnosticFinding = {
  songId: string;
  failedAt: FailedAtLayer;
  expectedTime?: number;
  aiTime?: number;
  timingError?: number;
  probableCause: string;
  rootCause: RootCause;
  severity: DiagnosticSeverity;
};

export type RealWorldFailureBucket =
  | "TIMING"
  | "STRUCTURE"
  | "ENERGY"
  | "HIT"
  | "CUE_DENSITY"
  | "FORMATION"
  | "MOVEMENT"
  | "COLLISION"
  | "VARIETY"
  | "SEQUENCE"
  | "SAFETY";

export type HumanCeiling = {
  cueMatchRate: number;
  formationTop3: number;
  sequenceCorrelation: number;
  overall: number;
  pairs: number;
};

export type HumanCeilingRatio = {
  cue: number;
  formationTop3: number;
  sequence: number;
  overall: number;
};

export type GroundTruthConfidence = "HIGH" | "MEDIUM" | "LOW";

export type ConsensusReviewItem = {
  songId: string;
  cueId: string;
  time?: number;
  humanChoices: Array<{ annotatorId: string; formationType: string; score: number }>;
};

export type FailureMatrix = {
  buckets: Record<RealWorldFailureBucket, Record<SongDifficulty, number>>;
};

export type SliceMetrics = {
  count: number;
  overall: number;
  cueF1: number;
  majorCueRecall: number;
  formationTop3: number;
  sequenceCorrelation: number;
  unsafeRate: number;
};

export type TuningCandidateStatus = "IMPROVEMENT" | "REGRESSION" | "TRADEOFF" | "INCONCLUSIVE";

export type TuningCandidate = {
  parameterChanges: Record<string, number>;
  score: {
    overall: number;
    cueF1: number;
    majorCueRecall: number;
    formationTop3: number;
    sequenceCorrelation: number;
    unsafeRate: number;
  };
  deltaFromBaseline: {
    overall: number;
    safety: number;
  };
  status: TuningCandidateStatus;
};

export type TuningHistory = {
  baselineVersion: string;
  candidateVersion: string;
  parametersChanged: Record<string, number>;
  before: BenchmarkSummary;
  after: BenchmarkSummary;
  status: string;
  createdAt: string;
};

export type TuningRecommendation = {
  rank: number;
  title: string;
  detail: string;
  layer: FailedAtLayer;
  parameterHint: string;
};

export type BenchmarkRunComparison = {
  overallDelta: number;
  safetyDelta: number;
  cueF1Delta: number;
  majorCueRecallDelta: number;
  formationTop3Delta: number;
  sequenceDelta: number;
  status: TuningCandidateStatus;
};

export type RealWorldBenchmarkResult = {
  songsEvaluated: number;
  annotatorCount: number;
  humanHumanAgreement: number;
  aiHumanAgreement: number;
  humanCeiling: HumanCeiling;
  humanCeilingRatio: HumanCeilingRatio;
  overall: number;
  grade: QualityGrade;
  status: BenchmarkSummary["status"];
  summary: BenchmarkSummary;
  layerScores: LayerScores;
  weakestBucket: RealWorldFailureBucket | "NONE";
  strongestBucket: RealWorldFailureBucket | "NONE";
  weakestLayer: keyof LayerScores;
  strongestLayer: keyof LayerScores;
  categoryBreakdown: Partial<Record<RealSongCategory, SliceMetrics>>;
  difficultyBreakdown: Partial<Record<SongDifficulty, SliceMetrics>>;
  bpmBreakdown: Partial<Record<BpmBucket, SliceMetrics>>;
  failureMatrix: FailureMatrix;
  diagnostics: DiagnosticFinding[];
  consensusReviews: ConsensusReviewItem[];
  groundTruthConfidence: Record<string, GroundTruthConfidence>;
  recommendations: TuningRecommendation[];
  evaluationVersion: string;
};

export type TuningGrid = Record<string, number[]>;
