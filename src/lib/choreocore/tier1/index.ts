/**
 * CHOREOCORE Tier 1 v6.1 — 公開 API
 */

export type {
  Position,
  Performer,
  Formation,
  Tier,
  TemplateSlot,
  FormationTemplate,
  PerformerMobilityProfile,
  PathCrossing,
  FormationWeights,
  FormationScore,
  AssignmentResult,
  PickResult,
  SuggestFeedback,
} from "./types";
export {
  DEFAULT_FORMATION_WEIGHTS,
  BASE_WALK_RUN_SPEED_MPS,
} from "./types";
export { euclideanDistance, segmentsIntersect } from "./geometry";
export { detectPathCrossings } from "./crossing";
export { computePersonalMaxDist } from "./mobility";
export { computeFormationScore, explainFormationScore } from "./score";
export {
  solveMinDisplacementAssignment,
  assignmentToFormation,
} from "./assignment";
export {
  pickBestScoredFormation,
  pickResultToFormation,
  type PickFormationOptions,
} from "./pick";
