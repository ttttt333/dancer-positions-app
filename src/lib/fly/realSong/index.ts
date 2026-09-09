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
