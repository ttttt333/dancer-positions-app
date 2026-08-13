import type { ConsensusReviewItem } from "./AnnotationTypes";
import type { GroundTruthSet } from "./AnnotationTypes";
import type { BenchmarkSummary, CriticalError } from "./EvaluationTypes";
import type { PriorityCard } from "./AdvisorTypes";
import type { BpmBucket, RealSongCategory } from "./RealWorldTypes";

export const PILOT_VERSION = "1.0.0";
export const EXPECTED_MAIN_SONGS = 10;
export const CALIBRATION_AGREEMENT_GATE = 0.65;

export type PilotStatus = "NO_DATA" | "CALIBRATION_FAIL" | "PARTIAL_DATA" | "PILOT_COMPLETE";

export type CeilingClass = "HUMAN_LIKE" | "PROMISING" | "NEEDS_TUNING" | "MAJOR_TUNING_REQUIRED";

export type SafetyClass = "PASS" | "WATCH" | "FAIL";

export type SongPilotStatus = "PASS" | "WATCH" | "FAIL";

export type DisagreementKind =
  | "CUE_TIME_DISAGREEMENT"
  | "CUE_ACTION_DISAGREEMENT"
  | "SECTION_BOUNDARY_DISAGREEMENT"
  | "SECTION_TYPE_DISAGREEMENT"
  | "FORMATION_RANK_DISAGREEMENT"
  | "SEQUENCE_DISAGREEMENT";

export type DomainAgreement = {
  cue: number;
  section: number;
  formation: number;
  sequence: number;
};

export type PilotDisagreement = {
  songId: string;
  time?: number;
  type: DisagreementKind;
  severity: "LOW" | "MEDIUM" | "HIGH";
  annotators: string[];
  choices: Array<{ annotatorId: string; value: string }>;
  reason: string;
  status: "REVIEW_REQUIRED" | "AUTO_CONSENSUS";
};

export type DisagreementHeatmapPoint = {
  songId: string;
  time: number;
  type: "SECTION" | "CUE" | "FORMATION" | "SEQUENCE";
  annotatorCount: number;
  severity: "LOW" | "MEDIUM" | "HIGH";
};

export type PilotSongReport = {
  songId: string;
  humanHuman: number;
  aiHuman: number;
  ceilingRatio: number;
  cueF1: number;
  majorRecall: number;
  formationTop3: number;
  sequence: number;
  safety: number;
  status: SongPilotStatus;
  groundTruthConfidence: "HIGH" | "MEDIUM" | "LOW";
};

export type PilotSliceReport = {
  key: string;
  count: number;
  humanHuman: number;
  aiHuman: number;
  ceilingRatio: number;
  cueF1: number;
  formationTop3: number;
  sequence: number;
  safety: number;
};

export type ImprovementAdvice = {
  priority1?: string;
  priority2?: string;
  priority3?: string;
  cards: PriorityCard[];
};

export type PilotCalibrationBlock = {
  passed: boolean;
  overallAgreement: number;
  byDomain: DomainAgreement;
  disagreements: ConsensusReviewItem[];
  reasons: string[];
  songIds: string[];
};

export type RealWorldPilotResult = {
  calibration: PilotCalibrationBlock;
  songsEvaluated: number;
  expectedSongs: number;
  annotators: number;
  humanHumanAgreement: number;
  aiHumanAgreement: number;
  humanCeilingRatio: number;
  ceilingClass: CeilingClass;
  safetyClass: SafetyClass;
  status: PilotStatus;
  benchmark: BenchmarkSummary;
  layerDiagnostics: {
    phase1: number;
    phase2: number;
    phase3: number;
    phase4: number;
    phase5: number;
    phase6: number;
  };
  improvementAdvice: ImprovementAdvice;
  criticalErrors: CriticalError[];
  songReports: PilotSongReport[];
  categoryReports: PilotSliceReport[];
  bpmReports: PilotSliceReport[];
  disagreements: PilotDisagreement[];
  heatmap: DisagreementHeatmapPoint[];
  groundTruth: GroundTruthSet[];
  version: {
    annotationVersion: string;
    evaluationVersion: string;
    engineVersion: string;
    pilotVersion: string;
  };
};

export type { BpmBucket, RealSongCategory };
