export type {
  Position,
  Performer,
  Formation,
  ChangeTier,
  ChangePoint,
  Template,
  EightGridEntry,
  SongAnalysisResult,
  GeneratedCue,
  GenerateFormationsResult,
} from "./types";
export {
  STAGE_WIDTH_M,
  STAGE_DEPTH_M,
  METERS_PER_COUNT,
} from "./types";
export { TEMPLATES_25P, templatesForTier, resamplePositions } from "./templates_25p";
export { generateAppFormationsFromChangePoints } from "./appBridge";
export {
  assignPerformers,
  totalTravelMeters,
  maxTravelMeters,
} from "./assignment";
export {
  generateFormations,
  pickFormationPushingLimit,
  availableCountsBetween,
  computeMaxFeasibleDistance,
} from "./formation_generator";
export {
  selectChangePointsForCueCount,
  suggestedCueCountForDuration,
  clampTargetCueCount,
  AI_SUGGEST_CUE_PRESETS,
  AI_SUGGEST_CUE_MIN,
  AI_SUGGEST_CUE_MAX,
} from "./selectChangePoints";
