/**
 * FLY Music Intelligence Engine — public API
 *
 * Phase 1–3: 既存 librosa / All-In-One / chroma-SSM を抽象レイヤの下へ移す。
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
  analyzeSongWithFly,
  type FlyAnalyzeSongOpts,
  type FlyAnalyzeSongBundle,
} from "./client";
