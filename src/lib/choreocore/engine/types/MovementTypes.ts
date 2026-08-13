import type { FormationCue, StageConfig } from "./CueTypes";
import type { Formation, Point } from "./FormationTypes";

export type MovementAbility = {
  baseSpeed: number;
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
  agility: number;
  crossingPenalty: number;
};

export type MovementTiming = {
  startTime: number;
  endTime: number;
  availableSeconds: number;
  availableBeats: number;
  bpm: number;
};

export type DancerMovement = {
  dancerId: string;
  from: Point;
  to: Point;
  distance: number;
  requiredSeconds: number;
  availableSeconds: number;
  requiredBeats: number;
  availableBeats: number;
  directFeasible: boolean;
  speedRatio: number;
  pushingLimit: number;
  risk: number;
};

export type CollisionPair = {
  dancerA: string;
  dancerB: string;
  minDistance: number;
  collisionTime?: number;
};

export type CollisionResult = {
  hasCollision: boolean;
  collisionPairs: CollisionPair[];
  risk: number;
};

export type MovementPlan = {
  movements: DancerMovement[];
  totalDistance: number;
  maxDistance: number;
  averageDistance: number;
  collision: CollisionResult;
  stageBoundaryViolation: boolean;
  pushingLimitViolation: boolean;
  feasible: boolean;
  risk: number;
  score: number;
};

export type TransitionContext = {
  currentFormation: Formation;
  nextFormation: Formation;
  cue: FormationCue;
  bpm: number;
  timing: MovementTiming;
  stage: StageConfig;
  previousCue?: FormationCue;
  dancerAbilities?: Record<string, MovementAbility>;
};

export type TransitionAnalysis = {
  candidateId: string;
  movementPlan: MovementPlan;
  feasibility: number;
  risk: number;
  transitionScore: number;
  rejectionReason?: string;
  warnings: string[];
  band: "A" | "B" | "C" | "D";
};

export type PathModel = {
  sample: (from: Point, to: Point, t: number) => Point;
};

export type AssignmentTarget = {
  id?: string;
  to: Point;
  visualWeight?: number;
  role?: "CENTER" | "MAIN" | "WING" | "GROUP" | "DEFAULT";
};

export type AssignmentDancer = {
  id: string;
  from: Point;
  role?: "CENTER" | "MAIN" | "WING" | "GROUP" | "DEFAULT";
  visualWeight?: number;
};

export type MovementEngineConfig = {
  sampleCount: number;
  softViolationRatio: number;
  pathCollisionSamples: number;
};

export const MOVEMENT_ANALYSIS_VERSION = "3.0.0-phase5";

export const DEFAULT_MOVEMENT_ABILITY: MovementAbility = {
  baseSpeed: 1,
  maxSpeed: 1.8,
  acceleration: 1,
  deceleration: 1,
  agility: 1,
  crossingPenalty: 0.15,
};
