export {
  STAGE_WIDTH_M,
  STAGE_DEPTH_M,
  METERS_PER_COUNT,
  COUNTS_PER_FOUR_EIGHT_BLOCK,
  EIGHTS_PER_BLOCK,
} from "./types";
export type {
  Position,
  Performer,
  Formation,
  ChangeTier,
  ChangePoint,
  SectionType,
  Template,
  EightGridEntry,
  SongAnalysisResult,
  GeneratedCue,
  GenerateFormationsResult,
} from "./types";
export {
  TEMPLATES_25P,
  templatesForTier,
  resamplePositions,
  mirrorTemplate,
} from "./templates_25p";
export { generateAppFormationsFromChangePoints } from "./appBridge";
export {
  assignPerformers,
  assignPerformersOrdered,
  totalTravelMeters,
  maxTravelMeters,
} from "./assignment";
export {
  generateFormations,
  pickFormationPushingLimit,
  availableCountsBetween,
  availableCountsForFourEightBlock,
  computeMaxFeasibleDistance,
  songPhaseAt,
  moodFromSection,
  sectionAt,
  resolveSectionType,
  snapEightIndexToBlock,
} from "./formation_generator";
export { buildRealisticLayouts } from "./layouts_realistic";
export {
  selectChangePointsForCueCount,
  suggestedCueCountForDuration,
  clampTargetCueCount,
  AI_SUGGEST_CUE_PRESETS,
  AI_SUGGEST_CUE_MIN,
  AI_SUGGEST_CUE_MAX,
} from "./selectChangePoints";
export * from "./tier1";
export * as lightingSync from "./lightingSync";
export {
  generateLightingSyncSuggestion,
  lightingSyncPayloadToApp,
  CLASS_PROFILE_PRESETS,
  CLASS_TODDLER,
  CLASS_ADVANCED_MON7,
  CLASS_ELEMENTARY,
  getClassProfile,
  corpusSummary,
  LIGHTING_PLAN_SHOWS,
  suggestClassProfileId,
} from "./lightingSync";
