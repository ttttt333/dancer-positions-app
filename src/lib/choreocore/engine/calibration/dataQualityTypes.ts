import type { EvidenceQualityWarning } from "./realWorldEvidenceTypes";
import type { ReleaseDecisionDataSource } from "./releaseDecisionTypes";

export type DataQualityStatus = "HEALTHY" | "WATCH" | "DEGRADED" | "BLOCKED";

export type DataQualityDimensionVerdict = "PASS" | "WATCH" | "DEGRADED" | "BLOCKED";

export type DataQualitySourceKind = "REAL_EDITOR" | "FIXTURE" | "OTHER_VALID_SOURCE" | "INVALID";

export type DataQualityVolume = {
  totalEventCount: number;
  formationEventCount: number;
  transitionEventCount: number;
  cueEventCount: number;
  acceptCount: number;
  rejectCount: number;
  editCount: number;
  unchangedCount: number;
  positionEditCount: number;
  formationEditCount: number;
  assignmentEditCount: number;
  swapCount: number;
  pathEditCount: number;
  timingEditCount: number;
};

export type DataQualityDiversity = {
  uniqueProjectCount: number;
  uniqueSessionCount: number;
  uniqueUserCount: number;
  uniqueSongCount: number;
  uniqueActionCount: number;
  warnings: EvidenceQualityWarning[];
};

export type DataQualityCompleteness = {
  missingProjectKeyCount: number;
  missingSessionKeyCount: number;
  missingCandidateIdCount: number;
  missingEvaluatorIdCount: number;
  missingPieceTitleCount: number;
  missingVersionCount: number;
  unknownSongCount: number;
};

export type DataQualitySongIdentity = {
  knownSongCount: number;
  unknownSongCount: number;
  songIdentityCoverage: number | null;
};

export type DataQualityDuplicates = {
  duplicateEventCount: number;
  duplicateFingerprintCount: number;
};

export type DataQualityVersions = {
  versionMismatchCount: number;
};

export type DataQualitySources = {
  realEditorCount: number;
  fixtureCount: number;
  otherValidSourceCount: number;
  invalidCount: number;
};

export type DataQualityObservationCoverage = {
  acceptCount: number;
  rejectCount: number;
  historyEditCount: number;
  applyOutcomeCount: number;
};

export type DataQualityCollaboration = {
  localEditorObservedChanges: number;
  collaborativeObservedChanges: number | null;
  note: "Collaboration uses the same observeEditorProjectChange path; events are not separately tagged.";
};

export type DataQualityBuffer = {
  bufferCapacity: number;
  currentEventCount: number;
  bufferUtilization: number;
  droppedDueToCapacity: number | null;
};

export type DataQualityDimensions = {
  volume: DataQualityDimensionVerdict;
  diversity: DataQualityDimensionVerdict;
  completeness: DataQualityDimensionVerdict;
  duplicateIntegrity: DataQualityDimensionVerdict;
  versionIntegrity: DataQualityDimensionVerdict;
  sourceIntegrity: DataQualityDimensionVerdict;
  observationCoverage: DataQualityDimensionVerdict;
};

export type RealWorldDataQualityReport = {
  analysisVersion: string;
  dataSource: ReleaseDecisionDataSource;
  status: DataQualityStatus;
  volume: DataQualityVolume;
  diversity: DataQualityDiversity;
  completeness: DataQualityCompleteness;
  songIdentity: DataQualitySongIdentity;
  duplicates: DataQualityDuplicates;
  versions: DataQualityVersions;
  sources: DataQualitySources;
  observationCoverage: DataQualityObservationCoverage;
  collaboration: DataQualityCollaboration;
  buffer: DataQualityBuffer;
  storageResetDetected: null;
  dimensions: DataQualityDimensions;
  blockers: string[];
  warnings: string[];
  notes: string[];
};
