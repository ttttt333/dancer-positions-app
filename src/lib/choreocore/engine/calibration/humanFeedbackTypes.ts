import type {
  AiScoreSnapshot,
  HumanEditSignal,
  HumanEvalSubject,
  HumanEvaluationRecord,
} from "./humanEvaluationTypes";

export type HumanFeedbackKind = "EXPLICIT" | "IMPLICIT";

export type HumanFeedbackAction =
  | "ACCEPT"
  | "EDIT"
  | "REJECT"
  | "FORMATION_EDIT"
  | "POSITION_EDIT"
  | "ASSIGNMENT_EDIT"
  | "PATH_EDIT"
  | "TIMING_EDIT"
  | "SWAP"
  | "LOCK"
  | "UNLOCK";

export type HumanFeedbackEvent = {
  evaluationId: string;
  candidateId: string;
  transitionId?: string;
  evaluatorId?: string;
  kind: HumanFeedbackKind;
  action: HumanFeedbackAction;
  layer: "formation" | "transition";
  editSignal?: HumanEditSignal;
  timestamp: string;
};

export type AiCandidateOrigin = {
  formationId: string;
  cueId: string;
  candidateId: string;
  transitionId?: string;
  musicId?: string;
  intent?: string;
  formationName: string;
  dancerIds: string[];
  positions: Record<string, { xPct: number; yPct: number }>;
  tStartSec: number;
  tEndSec: number;
  gapApproachFromPrev?: string;
  customPathKeys: string[];
  snapshot: AiScoreSnapshot;
  algorithmVersion: string;
  analysisVersion: string;
  intentVersion?: string;
  candidateVersion?: string;
  transitionVersion?: string;
  weightsVersion: string;
  lastEditFingerprint?: string;
};

export type HumanFeedbackPersisted = {
  schemaVersion: string;
  evaluatorId: string;
  origins: AiCandidateOrigin[];
  events: HumanFeedbackEvent[];
  records: HumanEvaluationRecord[];
};

export type CaptureSuggestionInput = {
  musicId?: string;
  acceptedCueIds: string[];
  cues: Array<{
    id: string;
    formationId: string;
    tStartSec: number;
    tEndSec: number;
    gapApproachFromPrev?: string;
    dancerCustomPaths?: Record<string, { cpX: number; cpY: number }>;
  }>;
  formations: Array<{
    id: string;
    name: string;
    dancers: Array<{ id: string; xPct: number; yPct: number }>;
  }>;
  scoreByFormationId?: Record<string, AiScoreSnapshot>;
  createdAt?: string;
};

export type { HumanEvalSubject };
