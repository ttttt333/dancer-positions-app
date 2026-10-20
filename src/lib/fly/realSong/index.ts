export {
  FLY_REAL_SONG_DATASET_VERSION,
  FLY_ANNOTATION_CONTRACT_VERSION,
  FLY_WEAKNESS_VERSION,
  FLY_MUSICAL_CHANGE_VERSION,
  FLY_REAL_SONG_PROVENANCE_VERSION,
  PHASE46_FREEZE,
} from "./versions";
export type * from "./types";
export {
  validateManifest,
  validateAnnotation,
  validateMusicalChange,
  isValidAudioSha256,
  assertNoCopyrightedAudioPaths,
} from "./validation";
export { computeHumanAgreement } from "./agreement";
export { buildConsensus } from "./consensus";
export {
  annotationToFlyGroundTruth,
  hypothesisFileToFly,
  tempoClassToCategory,
} from "./bridge";
export { detectWeaknesses, planActiveExpansion } from "./weakness";
export {
  runRealSongBenchmarkPipeline,
  type RealSongBenchmarkBundle,
} from "./pipeline";
export {
  deriveBeatPattern,
  deriveDownbeatPattern,
  deriveTimingPattern,
  auditBeatPattern,
  auditDownbeatPattern,
  beatIntervalVsBpmError,
  type DerivedTimingPattern,
  type PatternAuditStatus,
} from "./beatPattern";
export {
  scoreTimingPattern,
  gridResidualSec,
  type BeatPatternScore,
  type PatternAxisVerdict,
} from "./scoreBeatPattern";
export {
  classifyBeatPattern,
  summarizeFindingClasses,
  type FindingClass,
  type DimensionFinding,
} from "./findingClass";
export {
  loadAllGroundTruth,
  loadGroundTruthForSong,
  loadCatalog,
  resolveRealSongRoot,
  DEFAULT_REAL_SONG_ROOT,
} from "./loadGt";
export {
  signedPhaseResidualSec,
  classifyHalfBeatBin,
  summarizePhaseOffset,
  classifyAnalyzerRelation,
  circularPhaseDistanceSec,
  type HalfBeatBin,
  type PhaseRelationClass,
} from "./phaseReferenceAudit";
export {
  offsetFromRef,
  fitFractionalBeat,
  nearestFormCue,
  hypothesizeOriginStructure,
  type OriginHypothesisLabel,
  type OriginProbeId,
} from "./dancePhaseOriginAudit";
export {
  FLY_PHASE_ANCHOR_ANNOTATION_VERSION,
  PHASE_ANCHOR_TYPE_CANDIDATES,
  PHASE_ANCHOR_PILOT_SONG_IDS,
  validatePhaseAnchorMark,
  validatePhaseAnchorAnnotation,
  type PhaseAnchorAnnotation,
  type PhaseAnchorMark,
} from "./phaseAnchor";
