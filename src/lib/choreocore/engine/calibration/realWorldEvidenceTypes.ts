import type { CandidateOutcomeKind } from "./discrepancyTypes";

export type EvidenceReadiness =
  | "INSUFFICIENT"
  | "OBSERVATION_READY"
  | "EVIDENCE_READY"
  | "RELEASE_CANDIDATE"
  | "UNAVAILABLE";

export type EvidenceQualityWarning =
  | "LOW_PROJECT_DIVERSITY"
  | "LOW_USER_DIVERSITY"
  | "LOW_SONG_DIVERSITY"
  | "LOW_SESSION_DIVERSITY"
  | "LOW_ACTION_DIVERSITY"
  | "VERSION_MISMATCH"
  | "SHADOW_UNAVAILABLE"
  | "INSUFFICIENT_SAMPLE";

export type LayerEvidenceCounts = {
  candidateCount: number;
  acceptCount: number;
  rejectCount: number;
  acceptEditCount: number;
  acceptUnchangedCount: number;
  acceptRate: number | null;
  rejectRate: number | null;
  editRate: number | null;
  unchangedRate: number | null;
};

export type FormationEvidence = LayerEvidenceCounts & {
  formationEditCount: number;
  positionEditCount: number;
  assignmentEditCount: number;
  swapCount: number;
};

export type TransitionEvidence = LayerEvidenceCounts & {
  pathEditCount: number;
  timingEditCount: number;
  assignmentEditCount: number;
  impossibleCount: number;
};

export type CueEvidence = {
  cueAcceptCount: number;
  cueRejectCount: number;
  timingEditCount: number;
  cueRelatedEditCount: number;
};

export type ShadowEvidenceSummary = {
  packageId?: string;
  domain?: string;
  productionVersion?: string;
  shadowVersion?: string;
  evaluatedCount: number;
  availableCount: number;
  unavailableCount: number;
  top1ChangedCount: number;
  top3ChangedCount: number;
  meanScoreDelta: number | null;
  meanRankDelta: number | null;
  humanOutcomeIsProduction: true;
  counterfactual: "unknown";
};

export type EvidenceQuality = {
  sampleCount: number;
  uniqueProjectCount: number;
  uniqueSessionCount: number;
  uniqueUserCount: number;
  uniqueSongCount: number;
  actionDiversity: number;
  dimensions: {
    SAMPLE_COUNT: number;
    PROJECT_DIVERSITY: number;
    SESSION_DIVERSITY: number;
    USER_DIVERSITY: number;
    SONG_DIVERSITY: number;
    ACTION_DIVERSITY: number;
  };
};

export type ReadinessAssessment = {
  status: EvidenceReadiness;
  blockers: EvidenceQualityWarning[];
  warnings: EvidenceQualityWarning[];
  canReleaseFormationV2: false;
};

export type RealWorldEvidenceReport = {
  analysisVersion: string;
  datasetVersion: string;
  integrity: "OK" | "UNAVAILABLE";
  formation: FormationEvidence;
  transition: TransitionEvidence;
  cue: CueEvidence;
  shadow: ShadowEvidenceSummary;
  evidenceQuality: EvidenceQuality;
  readiness: ReadinessAssessment;
  notes: string[];
};

export type ShadowEvidenceRow = {
  packageId?: string;
  domain: "formation" | "transition";
  productionVersion: string;
  shadowVersion: string;
  projectKey?: string;
  candidateId: string;
  productionScore: number;
  shadowScore: number;
  scoreDelta: number | null;
  rankDelta: number | null;
  productionTop1?: string | null;
  shadowTop1?: string | null;
  top1Changed: boolean;
  top3Changed: boolean;
  humanOutcome?: CandidateOutcomeKind;
  counterfactual: "unknown";
};
