import type { FormationCue, StageConfig } from "../types/CueTypes";
import type { Formation, Point } from "../types/FormationTypes";
import type { MovementTiming } from "../types/MovementTypes";
import type { TRANSITION_ASSIGNMENTS, TRANSITION_PATH_KINDS, TRANSITION_PHASES } from "./transitionIntelligenceConfig";

export type TransitionPathKind = (typeof TRANSITION_PATH_KINDS)[number];
export type TransitionAssignmentKind = (typeof TRANSITION_ASSIGNMENTS)[number];
export type TransitionPhase = (typeof TRANSITION_PHASES)[number];
export type TransitionHumanRating = "natural" | "acceptable" | "awkward" | "impossible";

export type TransitionIntelligenceConstraints = {
  lockedDancerIds?: string[];
  availableSeconds?: number;
  bpm?: number;
};

export type TransitionIntelligenceRequest = {
  from: Formation;
  to: Formation;
  cue: FormationCue;
  previousCue?: FormationCue;
  stage: StageConfig;
  timing?: MovementTiming;
  constraints?: TransitionIntelligenceConstraints;
};

export type DancerTransitionPath = {
  dancerId: string;
  from: Point;
  to: Point;
  pathKind: TransitionPathKind;
  pathLength: number;
  samples: Point[];
};

export type TransitionEvaluation = {
  feasible: boolean;
  pathCost: number;
  collisionRisk: number;
  crossingRisk: number;
  speedPressure: number;
  smoothness: number;
  arrivalSync: number;
  score: number;
  reasonCodes: string[];
};

export type RankedTransitionCandidate = {
  id: string;
  pathKind: TransitionPathKind;
  assignment: TransitionAssignmentKind;
  targetPositions: Record<string, Point>;
  paths: DancerTransitionPath[];
  evaluation: TransitionEvaluation;
  transitionCost: number;
  transitionQuality: number;
  transitionEfficiency: number;
  distanceCost: number;
  speedCost: number;
  accelerationCost: number;
  turnCost: number;
  crossingCost: number;
  collisionCost: number;
  timingPressure: number;
  groupCoherence: number;
  spacing: number;
  maxRequiredSpeed: number;
  phases: TransitionPhase[];
  humanRating?: TransitionHumanRating;
};

export type TransitionRecommendation = {
  fromFormationId: string;
  toFormationId: string;
  cueId: string;
  availableSeconds: number;
  availableBeats: number;
  primary: RankedTransitionCandidate | null;
  alternatives: RankedTransitionCandidate[];
  ranked: RankedTransitionCandidate[];
  discardedCount: number;
};

export type TransitionIntelligenceReport = {
  analysisVersion: string;
  recommendations: TransitionRecommendation[];
};
