/**
 * FLY Music Intelligence Engine — public API
 *
 * Phase 1–3: 既存 librosa / All-In-One / chroma-SSM を抽象レイヤの下へ移す。
 * Phase 4: Analyzer Adapter + Essentia + multi-analyzer Fusion（Formation 非直結）。
 * Formation Engine は StructureResultV2 経由で従来どおり接続する。
 */

export type * from "./types";
export {
  DEFAULT_FLY_FUSION_WEIGHTS,
  DEFAULT_FORMATION_SCORE_WEIGHTS,
} from "./types";
export {
  FLY_FUSION_VERSION,
  FLY_DANCE_MODEL_VERSION,
  FLY_FORMATION_MODEL_VERSION,
  FLY_STRUCTURE_V2_VERSION,
  FLY_AIO_VERSION,
  currentFlyVersions,
} from "./versions";
export {
  flyAnalysisFromStructureV2,
  type FlyFromLegacyInput,
} from "./fromStructureV2";
export { structureV2FromFlyAnalysis } from "./toStructureV2";
export { fuseToFlyAnalysis, fuseToStructureV2, type FusionInput } from "./fusion";
export {
  fuseAnalyzerResults,
  type FlyFusionInput,
  type FlyFusionResult,
} from "./fusionMulti";
export {
  fuseWithOptionalEssentia,
  type EnsembleAnalyzeOpts,
} from "./ensemble";
export {
  analyzeSongWithFly,
  type FlyAnalyzeSongOpts,
  type FlyAnalyzeSongBundle,
} from "./client";
export {
  isFlyEssentiaEnabled,
  isFlyEssentiaEnabledResolved,
  setFlyEssentiaEnabledForTests,
} from "./featureFlags";
export type {
  FlyAnalyzerAdapter,
  FlyAnalyzerCapability,
  FlyAudioInput,
  FlyAnalyzerResult,
  FlyMetricProvenance,
} from "./adapters/types";
export {
  createEssentiaAdapter,
  EssentiaAnalyzerAdapter,
  ESSENTIA_ADAPTER_ID,
  ESSENTIA_ADAPTER_VERSION,
  mapEssentiaRawToFlyAnalyzerResult,
  createMockEssentiaRuntime,
  createUnavailableEssentiaRuntime,
} from "./adapters/essentia";
export {
  LibrosaStructureAdapter,
  librosaResultFromStructureV2,
  LIBROSA_ADAPTER_ID,
} from "./adapters/librosa/adapter";
